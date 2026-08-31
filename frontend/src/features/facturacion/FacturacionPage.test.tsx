import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import userEvent from '@testing-library/user-event';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import type { TiposDocumentoRepository } from '../../shared/lib/facturacion/TiposDocumentoRepository';
import type { Factura } from '../../shared/types/factura';
import type { Paciente } from '../../shared/types/paciente';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { mockAuthRepository } from '../../shared/lib/auth/mockAuthRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { CobroRepositoryProvider } from './CobroRepositoryContext';
import { FacturaRepositoryProvider } from './FacturaRepositoryContext';
import { TiposDocumentoRepositoryProvider } from './TiposDocumentoRepositoryContext';
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
  numeroAfiliado: { valor: '45123456' },
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

function buildTiposDocumentoRepository(): TiposDocumentoRepository {
  return {
    listarActivos: vi.fn().mockResolvedValue([
      { id: 'tipo-arca', tipo: 'Comprobante ARCA', requerido: true, activa: true },
      { id: 'tipo-asistencia', tipo: 'Asistencia', requerido: true, activa: true },
      { id: 'tipo-codem', tipo: 'CODEM', requerido: false, activa: true },
    ]),
    listarTodos: vi.fn().mockResolvedValue([]),
    crear: vi.fn(),
    editar: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
  };
}

function renderFacturacionPage(props: ReturnType<typeof buildProps>, conPermiso: boolean | null = null) {
  const page = (
    <FacturaRepositoryProvider repository={buildFacturaRepository()}>
      <CobroRepositoryProvider repository={buildCobroRepository()}>
        <TiposDocumentoRepositoryProvider repository={buildTiposDocumentoRepository()}>
          <FacturacionPage {...props} feriados={[]} />
        </TiposDocumentoRepositoryProvider>
      </CobroRepositoryProvider>
    </FacturaRepositoryProvider>
  );
  return renderConQuery(
    <AuthProvider repository={mockAuthRepository}>
      {conPermiso === null ? page : <PuedeEscribirContext.Provider value={conPermiso}>{page}</PuedeEscribirContext.Provider>}
    </AuthProvider>,
  );
}

function buildProps() {
  const pacienteRepository: PacienteRepository = {
    list: vi.fn().mockResolvedValue([martina]),
    // select-liviano-selectores: Facturación es el único consumidor que usa `listCompleto()` —
    // necesita `obraSocialId` y le pasa el paciente entero al flujo de emisión. Las otras
    // pantallas se quedaron con `list()`, que ahora devuelve `PacienteResumen`.
    listCompleto: vi.fn().mockResolvedValue([martina]),
    listPage: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const obraSocialRepository: ObraSocialRepository = {
    list: vi.fn().mockResolvedValue([]),
    listPage: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  };
  const presupuestoRepository: PresupuestoRepository = {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    create: vi.fn(),
    createLote: vi.fn(),
    update: vi.fn(),
  };
  const autorizacionRepository: AutorizacionRepository = {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    listByPresupuestoId: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    uploadArchivo: vi.fn(),
    removeArchivo: vi.fn(),
    getUrlArchivo: vi.fn(),
  };
  const documentoRepository: DocumentoRepository = {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
  const emisionRepository = { emitir: vi.fn(), verComprobante: vi.fn() };

  return { pacienteRepository, obraSocialRepository, presupuestoRepository, autorizacionRepository, emisionRepository, documentoRepository };
}

describe('FacturacionPage', () => {
  it('muestra el listado de facturas y navega al detalle al seleccionar una', async () => {
    const props = buildProps();
    renderFacturacionPage(props);

    expect(await screen.findByText('Gómez, Martina', { selector: 'span' })).toBeInTheDocument();

    await userEvent.click(screen.getByText('Gómez, Martina', { selector: 'span' }));

    expect(await screen.findByRole('button', { name: /^emitir/i })).toBeInTheDocument();
  });

  it('vuelve al listado desde el detalle', async () => {
    const props = buildProps();
    renderFacturacionPage(props);

    await userEvent.click(await screen.findByText('Gómez, Martina', { selector: 'span' }));
    const [volverArriba] = screen.getAllByRole('button', { name: /volver al listado/i });
    if (!volverArriba) throw new Error('Debería existir al menos un botón para volver al listado');
    await userEvent.click(volverArriba);

    expect(await screen.findByRole('button', { name: /nueva factura/i })).toBeInTheDocument();
  });
});

// paginacion-listados, Fase 3 (tasks.md 17.5): el selector de obra social de Facturación sigue
// necesitando el catálogo COMPLETO (design.md §D3) — mismo criterio que 17.4/17.5 de
// PacientesPage/PresupuestosPage.
describe('FacturacionPage — no-regresión: el selector de obra social usa list() completo (17.5)', () => {
  it('llama a obraSocialRepository.list() y nunca a listPage()', async () => {
    const props = buildProps();
    renderFacturacionPage(props);

    await screen.findByText('Gómez, Martina', { selector: 'span' });

    expect(props.obraSocialRepository.list).toHaveBeenCalled();
    expect(props.obraSocialRepository.listPage).not.toHaveBeenCalled();
  });
});

function renderPageConPermiso(puedeEscribir: boolean) {
  const props = buildProps();
  return renderFacturacionPage(props, puedeEscribir);
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


// facturacion-listado-comprobantes: el apartado "Comprobantes emitidos" lista las facturas con
// CAE y abre su PDF archivado vía EmisionRepository.verComprobante (la misma signed URL efímera
// que el detalle). Solo lectura — no toca la emisión.
describe('FacturacionPage — comprobantes emitidos', () => {
  const facturaEmitida: Factura = {
    ...factura,
    id: 'factura-emitida',
    estado: 'facturado',
    cae: '75012345678901',
    caeVencimiento: '2026-09-10',
    cbteNro: 7,
    ptoVta: 1,
    arcaAmbiente: 'homologacion',
    comprobantePdfUrl: 'factura-emitida/FACTURA_A-1-7.pdf',
    fechaFactura: '2026-08-30',
  };

  function renderConEmision(verComprobanteImpl: (clave: string) => Promise<string>) {
    const props = buildProps();
    props.emisionRepository.verComprobante.mockImplementation(verComprobanteImpl);
    const facturaRepository: FacturaRepository = {
      list: vi.fn().mockResolvedValue([facturaEmitida]),
      getById: vi.fn().mockResolvedValue(facturaEmitida),
      listByPaciente: vi.fn().mockResolvedValue([facturaEmitida]),
      create: vi.fn(),
      update: vi.fn(),
    };
    renderConQuery(
      <AuthProvider repository={mockAuthRepository}>
        <FacturaRepositoryProvider repository={facturaRepository}>
          <CobroRepositoryProvider repository={buildCobroRepository()}>
            <TiposDocumentoRepositoryProvider repository={buildTiposDocumentoRepository()}>
              <FacturacionPage {...props} feriados={[]} />
            </TiposDocumentoRepositoryProvider>
          </CobroRepositoryProvider>
        </FacturaRepositoryProvider>
      </AuthProvider>,
    );
    return props;
  }

  it('navega al apartado y abre el PDF de un comprobante vía verComprobante', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const props = renderConEmision(() => Promise.resolve('https://signed.example/pdf'));

    await userEvent.click(await screen.findByRole('button', { name: /comprobantes emitidos/i }));
    await userEvent.click(await screen.findByRole('button', { name: /ver pdf/i }));

    expect(props.emisionRepository.verComprobante).toHaveBeenCalledWith('factura-emitida/FACTURA_A-1-7.pdf');
    await waitFor(() =>
      expect(openSpy).toHaveBeenCalledWith('https://signed.example/pdf', '_blank', 'noopener,noreferrer'),
    );
    openSpy.mockRestore();
  });

  it('muestra el error si no se puede resolver la URL firmada', async () => {
    renderConEmision(() =>
      Promise.reject(new Error('No se pudo abrir el comprobante. Verificá que tengas permiso de facturación.')),
    );

    await userEvent.click(await screen.findByRole('button', { name: /comprobantes emitidos/i }));
    await userEvent.click(await screen.findByRole('button', { name: /ver pdf/i }));

    expect(await screen.findByText(/no se pudo abrir el comprobante/i)).toBeInTheDocument();
  });
});
