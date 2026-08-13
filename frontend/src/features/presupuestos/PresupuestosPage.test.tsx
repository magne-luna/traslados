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
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { AutorizacionRepositoryProvider } from './AutorizacionRepositoryContext';
import { PresupuestoRepositoryProvider } from './PresupuestoRepositoryContext';
import { PresupuestosPage } from './PresupuestosPage';

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
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
  numeroAfiliado: { valor: '45123456' },
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
    createLote: vi.fn(),
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
    listPage: vi.fn(),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function buildFakeObraSocialRepository(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([osecac]),
    listPage: vi.fn(),
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

function renderPageConPermiso(
  puedeEscribir: boolean,
  presupuestoRepository: PresupuestoRepository,
  autorizacionRepository: AutorizacionRepository,
) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <PresupuestoRepositoryProvider repository={presupuestoRepository}>
        <AutorizacionRepositoryProvider repository={autorizacionRepository}>
          <PresupuestosPage pacienteRepository={buildFakePacienteRepository()} obraSocialRepository={buildFakeObraSocialRepository()} />
        </AutorizacionRepositoryProvider>
      </PresupuestoRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

// paginacion-listados, Fase 2 (tasks.md 14.1): no-regresión de selectores. El combo de pacientes
// de Presupuestos necesita el padrón COMPLETO (design.md §D3) — nunca debe pasar a `listPage`, que
// solo trae una página. Si algún día PresupuestosPage empieza a llamar `listPage` en vez de
// `list()`, este test lo detecta antes de que el combo muestre "20 de 400 pacientes" sin error.
describe('PresupuestosPage — no-regresión: el combo de pacientes usa list() completo (14.1)', () => {
  it('llama a pacienteRepository.list() y nunca a listPage()', async () => {
    const pacienteRepository = buildFakePacienteRepository();

    render(
      <PresupuestoRepositoryProvider repository={buildFakePresupuestoRepository()}>
        <AutorizacionRepositoryProvider repository={buildFakeAutorizacionRepository()}>
          <PresupuestosPage pacienteRepository={pacienteRepository} obraSocialRepository={buildFakeObraSocialRepository()} />
        </AutorizacionRepositoryProvider>
      </PresupuestoRepositoryProvider>,
    );

    await screen.findByText('Gómez, Martina');

    expect(pacienteRepository.list).toHaveBeenCalled();
    expect(pacienteRepository.listPage).not.toHaveBeenCalled();
  });
});

// paginacion-listados, Fase 3 (tasks.md 17.5): mismo criterio que 14.1 de arriba, ahora para el
// selector de obra social de Presupuestos — sigue necesitando el catálogo COMPLETO.
describe('PresupuestosPage — no-regresión: el selector de obra social usa list() completo (17.5)', () => {
  it('llama a obraSocialRepository.list() y nunca a listPage()', async () => {
    const obraSocialRepository = buildFakeObraSocialRepository();

    render(
      <PresupuestoRepositoryProvider repository={buildFakePresupuestoRepository()}>
        <AutorizacionRepositoryProvider repository={buildFakeAutorizacionRepository()}>
          <PresupuestosPage pacienteRepository={buildFakePacienteRepository()} obraSocialRepository={obraSocialRepository} />
        </AutorizacionRepositoryProvider>
      </PresupuestoRepositoryProvider>,
    );

    await screen.findByText('Gómez, Martina');

    expect(obraSocialRepository.list).toHaveBeenCalled();
    expect(obraSocialRepository.listPage).not.toHaveBeenCalled();
  });
});

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

// Gateo de escritura (gateo-facturacion, tasks.md 7.1/7.3, design.md D5). Mismo patrón que
// ObraSocialesPage/gateo-obrasocial: una sola inserción de `<AvisoSoloLectura />` cubre listado y
// detalle.
describe('PresupuestosPage — gateo de escritura', () => {
  it('sin permiso de escritura: muestra el aviso de modo solo lectura en el listado', async () => {
    renderPageConPermiso(false, buildFakePresupuestoRepository(), buildFakeAutorizacionRepository());

    await screen.findByText('Gómez, Martina');
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('sin permiso de escritura: muestra el aviso también en el detalle', async () => {
    const user = userEvent.setup();
    renderPageConPermiso(false, buildFakePresupuestoRepository(), buildFakeAutorizacionRepository());

    await screen.findByText('Gómez, Martina');
    // "Editar" queda deshabilitado por el gateo — se navega al detalle por la tarjeta, no por el botón.
    await user.click(screen.getByText('Gómez, Martina'));

    expect((await screen.findAllByText('Gómez, Martina')).length).toBeGreaterThan(0);
    const notas = screen.getAllByRole('note').map((nota) => nota.textContent ?? '');
    expect(notas.some((texto) => /modo solo lectura/i.test(texto))).toBe(true);
  });

  it('con permiso de escritura: no muestra ningún aviso', async () => {
    renderPageConPermiso(true, buildFakePresupuestoRepository(), buildFakeAutorizacionRepository());

    await screen.findByText('Gómez, Martina');
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
  });
});
