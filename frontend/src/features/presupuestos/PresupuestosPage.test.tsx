import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { Paciente } from '../../shared/types/paciente';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { Presupuesto } from '../../shared/types/presupuesto';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import { AutorizacionRepositoryProvider } from './AutorizacionRepositoryContext';
import { PresupuestoRepositoryProvider } from './PresupuestoRepositoryContext';
import { PresupuestosPage } from './PresupuestosPage';

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

const presupuestoMartina: Presupuesto = {
  id: 'presupuesto-martina-1',
  pacienteId: 'paciente-martina',
  obraSocialId: 'osecac',
  monto: 150_000,
  fechaEmision: '2026-06-01',
};

function buildFakePresupuestoRepository(): PresupuestoRepository {
  return {
    list: vi.fn().mockResolvedValue([presupuestoMartina]),
    getById: vi.fn().mockResolvedValue(presupuestoMartina),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(presupuestoMartina),
  };
}

function buildFakeAutorizacionRepository(): AutorizacionRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    getByPresupuestoId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function buildFakePacienteRepository(): PacienteRepository {
  return {
    list: vi.fn().mockResolvedValue([martina]),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function buildFakeObraSocialRepository(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([osecac]),
    getById: vi.fn().mockResolvedValue(osecac),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function renderPage(presupuestoRepository: PresupuestoRepository, autorizacionRepository: AutorizacionRepository) {
  return render(
    <PresupuestoRepositoryProvider repository={presupuestoRepository}>
      <AutorizacionRepositoryProvider repository={autorizacionRepository}>
        <PresupuestosPage pacienteRepository={buildFakePacienteRepository()} obraSocialRepository={buildFakeObraSocialRepository()} />
      </AutorizacionRepositoryProvider>
    </PresupuestoRepositoryProvider>,
  );
}

describe('PresupuestosPage', () => {
  it('carga y muestra el listado con paciente y obra social resueltos', async () => {
    renderPage(buildFakePresupuestoRepository(), buildFakeAutorizacionRepository());

    expect(await screen.findByText('Gómez, Martina')).toBeInTheDocument();
    expect(await screen.findByText('OSECAC')).toBeInTheDocument();
  });

  it('navega al detalle de alta al hacer click en "Nuevo presupuesto"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakePresupuestoRepository(), buildFakeAutorizacionRepository());

    await screen.findByText('Gómez, Martina');
    await user.click(screen.getByRole('button', { name: /nuevo presupuesto/i }));

    expect(screen.getByText('Nuevo presupuesto')).toBeInTheDocument();
  });

  it('navega al detalle de edición precargado al hacer click en "Editar"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakePresupuestoRepository(), buildFakeAutorizacionRepository());

    await screen.findByText('Gómez, Martina');
    await user.click(screen.getByRole('button', { name: /editar gómez, martina/i }));

    expect((await screen.findAllByText('Gómez, Martina')).length).toBeGreaterThan(0);
  });
});
