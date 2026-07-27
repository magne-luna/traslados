import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Autorizacion, Presupuesto } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import { PresupuestoDetail } from './PresupuestoDetail';

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: 'osecac',
  numeroAfiliado: { formato: 'numero-documento', valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  plazoCobroDias: 90,
  tipoComprobante: 'A',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

const presupuestoMartina: Presupuesto = {
  id: 'presupuesto-martina-1',
  pacienteId: 'paciente-martina',
  obraSocialId: 'osecac',
  monto: 150_000,
  fechaEmision: '2026-06-01',
};

const autorizacionMartina: Autorizacion = {
  id: 'autorizacion-martina-1',
  presupuestoId: 'presupuesto-martina-1',
  estado: 'autorizada',
  montoAutorizado: 150_000,
};

function buildFakeAutorizacionRepository(overrides: Partial<AutorizacionRepository> = {}): AutorizacionRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    getByPresupuestoId: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(autorizacionMartina),
    update: vi.fn().mockResolvedValue(autorizacionMartina),
    ...overrides,
  };
}

describe('PresupuestoDetail — modo alta (presupuesto null)', () => {
  it('solo muestra el formulario de presupuesto, sin sección de autorización', () => {
    render(
      <PresupuestoDetail
        presupuesto={null}
        crear={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/paciente/i)).toBeInTheDocument();
    expect(screen.queryByText(/autorización/i)).not.toBeInTheDocument();
  });

  it('al guardar, llama a crear() con los datos del form y avisa onCreated', async () => {
    const user = userEvent.setup();
    const creado = { ...presupuestoMartina, id: 'nuevo-1' };
    const crear = vi.fn().mockResolvedValue(creado);
    const onCreated = vi.fn();

    render(
      <PresupuestoDetail
        presupuesto={null}
        crear={crear}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={onCreated}
        onBack={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-martina');
    await user.selectOptions(screen.getByLabelText(/obra social/i), 'osecac');
    await user.type(screen.getByLabelText(/monto/i), '150000');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(crear).toHaveBeenCalledWith(expect.objectContaining({ pacienteId: 'paciente-martina', obraSocialId: 'osecac' }));
    expect(onCreated).toHaveBeenCalledWith(creado);
  });
});

describe('PresupuestoDetail — modo edición', () => {
  it('muestra el resumen resuelto (paciente, obra social, monto) y el botón Editar datos', async () => {
    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect((await screen.findAllByText('Gómez, Martina')).length).toBeGreaterThan(0);
    expect(screen.getByText('OSECAC')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^paciente$/i)).not.toBeInTheDocument();
  });

  it('al apretar "Editar datos" muestra el form precargado y al guardar llama actualizar()', async () => {
    const user = userEvent.setup();
    const actualizar = vi.fn().mockResolvedValue(presupuestoMartina);

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        actualizar={actualizar}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        autorizacionRepository={buildFakeAutorizacionRepository()}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await screen.findAllByText('Gómez, Martina');
    await user.click(screen.getByRole('button', { name: /editar datos/i }));
    const pacienteField = screen.getByLabelText(/^paciente$/i);
    expect(pacienteField).toHaveValue('paciente-martina');

    // Con la autorización todavía sin cargar (getByPresupuestoId resuelve null), la sección de
    // Autorización también muestra su propio form con botón "Guardar" — se acota la búsqueda al
    // form del presupuesto (el que contiene el campo "Paciente").
    const presupuestoForm = pacienteField.closest('form');
    if (!presupuestoForm) throw new Error('No se encontró el form de presupuesto');
    await user.click(within(presupuestoForm).getByRole('button', { name: /guardar/i }));

    expect(actualizar).toHaveBeenCalledWith('presupuesto-martina-1', expect.objectContaining({ monto: 150_000 }));
  });

  it('cuando no hay autorización asociada (getByPresupuestoId resuelve null), muestra el estado vacío y el form para crearla', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue(autorizacionMartina);
    const autorizacionRepository = buildFakeAutorizacionRepository({ create });

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        autorizacionRepository={autorizacionRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText(/no hay autorización/i)).toBeInTheDocument();
    expect(autorizacionRepository.getByPresupuestoId).toHaveBeenCalledWith('presupuesto-martina-1');

    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ presupuestoId: 'presupuesto-martina-1' }));
  });

  it('cuando ya hay autorización asociada, la muestra resuelta y permite editarla vía actualizar()', async () => {
    const user = userEvent.setup();
    const update = vi.fn().mockResolvedValue({ ...autorizacionMartina, estado: 'judicializada' });
    const autorizacionRepository = buildFakeAutorizacionRepository({
      getByPresupuestoId: vi.fn().mockResolvedValue(autorizacionMartina),
      update,
    });

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        autorizacionRepository={autorizacionRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    expect(await screen.findByText(/autorizada/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /editar autorización/i }));
    await user.selectOptions(screen.getByLabelText(/^estado$/i), 'judicializada');
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(update).toHaveBeenCalledWith('autorizacion-martina-1', expect.objectContaining({ estado: 'judicializada' }));
  });

  it('muestra el error del repository de autorizaciones sin ocultar el resto del detalle', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockRejectedValue(new Error('no se pudo crear la autorización'));
    const autorizacionRepository = buildFakeAutorizacionRepository({ create });

    render(
      <PresupuestoDetail
        presupuesto={presupuestoMartina}
        crear={vi.fn()}
        actualizar={vi.fn()}
        pacientes={[martina]}
        obrasSociales={[osecac]}
        autorizacionRepository={autorizacionRepository}
        onCreated={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    await screen.findByText(/no hay autorización/i);
    await user.click(screen.getByRole('button', { name: /guardar/i }));

    expect(await screen.findByText('no se pudo crear la autorización')).toBeInTheDocument();
  });
});
