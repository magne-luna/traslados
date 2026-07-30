import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import type { Factura } from '../../shared/types/factura';
import type { Paciente } from '../../shared/types/paciente';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { CobroRepositoryProvider } from './CobroRepositoryContext';
import { FacturaRepositoryProvider } from './FacturaRepositoryContext';
import { FacturacionPage } from './FacturacionPage';

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

const factura: Factura = {
  id: 'factura-1',
  pacienteId: 'paciente-martina',
  descripcion: '',
  dias: 10,
  valorKm: 300,
  monto: 3000,
  estado: 'a-facturar',
  fechaInicial: '2026-08-01',
  fechaTope: '2026-08-31',
  tipoComprobante: 'A',
  cantidadKm: 10,
  prestacion: 'Kinesiología',
  mesFacturado: 8,
  anioFacturado: 2026,
  dependenciaYRetorno: '',
  domicilioId: '',
  asistencias: [],
};

function buildFacturaRepository(): FacturaRepository {
  return {
    list: vi.fn().mockResolvedValue([factura]),
    getById: vi.fn().mockResolvedValue(factura),
    listByPaciente: vi.fn().mockResolvedValue([factura]),
    create: vi.fn().mockResolvedValue(factura),
    update: vi.fn().mockResolvedValue(factura),
  };
}

function buildCobroRepository(): CobroRepository {
  return { list: vi.fn().mockResolvedValue([]), listByFactura: vi.fn().mockResolvedValue([]), create: vi.fn(), remove: vi.fn() };
}

function buildProps() {
  const pacienteRepository: PacienteRepository = {
    list: vi.fn().mockResolvedValue([martina]),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const obraSocialRepository: ObraSocialRepository = {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const presupuestoRepository: PresupuestoRepository = { list: vi.fn().mockResolvedValue([]), getById: vi.fn(), create: vi.fn(), update: vi.fn() };
  const autorizacionRepository: AutorizacionRepository = {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    getByPresupuestoId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
  const documentoRepository: DocumentoRepository = { listByEntity: vi.fn().mockResolvedValue([]), upload: vi.fn(), remove: vi.fn() };

  return { pacienteRepository, obraSocialRepository, presupuestoRepository, autorizacionRepository, documentoRepository };
}

describe('FacturacionPage', () => {
  it('muestra el listado de facturas y navega al detalle al seleccionar una', async () => {
    const props = buildProps();
    render(
      <FacturaRepositoryProvider repository={buildFacturaRepository()}>
        <CobroRepositoryProvider repository={buildCobroRepository()}>
          <FacturacionPage {...props} feriados={[]} />
        </CobroRepositoryProvider>
      </FacturaRepositoryProvider>,
    );

    expect(await screen.findByText('Gómez, Martina', { selector: 'span' })).toBeInTheDocument();

    await userEvent.click(screen.getByText('Gómez, Martina', { selector: 'span' }));

    expect(await screen.findByRole('button', { name: /^emitir/i })).toBeInTheDocument();
  });

  it('vuelve al listado desde el detalle', async () => {
    const props = buildProps();
    render(
      <FacturaRepositoryProvider repository={buildFacturaRepository()}>
        <CobroRepositoryProvider repository={buildCobroRepository()}>
          <FacturacionPage {...props} feriados={[]} />
        </CobroRepositoryProvider>
      </FacturaRepositoryProvider>,
    );

    await userEvent.click(await screen.findByText('Gómez, Martina', { selector: 'span' }));
    const [volverArriba] = screen.getAllByRole('button', { name: /volver al listado/i });
    if (!volverArriba) throw new Error('Debería existir al menos un botón para volver al listado');
    await userEvent.click(volverArriba);

    expect(await screen.findByRole('button', { name: /nueva factura/i })).toBeInTheDocument();
  });
});

function renderPageConPermiso(puedeEscribir: boolean) {
  const props = buildProps();
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <FacturaRepositoryProvider repository={buildFacturaRepository()}>
        <CobroRepositoryProvider repository={buildCobroRepository()}>
          <FacturacionPage {...props} feriados={[]} />
        </CobroRepositoryProvider>
      </FacturaRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

// Gateo de escritura (gateo-facturacion, tasks.md 7.2/7.3, design.md D5). Mismo patrón que
// ObraSocialesPage/PresupuestosPage: una sola inserción de `<AvisoSoloLectura />` cubre listado y
// detalle.
describe('FacturacionPage — gateo de escritura', () => {
  it('sin permiso de escritura: muestra el aviso de modo solo lectura en el listado', async () => {
    renderPageConPermiso(false);

    await screen.findByText('Gómez, Martina', { selector: 'span' });
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('sin permiso de escritura: muestra el aviso también en el detalle', async () => {
    renderPageConPermiso(false);

    await userEvent.click(await screen.findByText('Gómez, Martina', { selector: 'span' }));

    await screen.findByRole('button', { name: /^emitir/i });
    const notas = screen.getAllByRole('note').map((nota) => nota.textContent ?? '');
    expect(notas.some((texto) => /modo solo lectura/i.test(texto))).toBe(true);
  });

  it('con permiso de escritura: no muestra ningún aviso', async () => {
    renderPageConPermiso(true);

    await screen.findByText('Gómez, Martina', { selector: 'span' });
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
  });
});
