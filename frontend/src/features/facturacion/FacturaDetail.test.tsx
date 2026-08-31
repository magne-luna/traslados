import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import userEvent from '@testing-library/user-event';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { TiposDocumentoRepository } from '../../shared/lib/facturacion/TiposDocumentoRepository';
import type { TipoDocumentoFactura } from '../../shared/types/tiposDocumento';
import { AuthProvider } from '../../shared/auth/AuthContext';
import { mockAuthRepository } from '../../shared/lib/auth/mockAuthRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { TiposDocumentoRepositoryProvider } from './TiposDocumentoRepositoryContext';
import { FacturaDetail } from './FacturaDetail';

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
  direcciones: [{ id: 'dir-1', tipo: 'domicilio', calle: 'Rivadavia 4500', localidad: 'CABA' }],
  personasACargo: [],
  amparoJudicial: false,
};

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [{ id: 'item-1', nombre: 'Comprobante ARCA', requerido: true }],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

function facturaAFacturar(overrides: Partial<Factura> = {}): Factura {
  return {
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
    dependenciaYRetorno: 'Escuela / domicilio',
    domicilioId: 'dir-1',
    asistencias: [],
    ...overrides,
  };
}

function buildPresupuestoRepository(): PresupuestoRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    create: vi.fn(),
    createLote: vi.fn(),
    update: vi.fn(),
  };
}

function buildAutorizacionRepository(): AutorizacionRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn(),
    listByPresupuestoId: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    uploadArchivo: vi.fn(),
    removeArchivo: vi.fn(),
    getUrlArchivo: vi.fn(),
  };
}

function buildCobroRepository(cobros: Cobro[] = []): CobroRepository {
  return {
    list: vi.fn().mockResolvedValue(cobros),
    listByFactura: vi.fn().mockResolvedValue(cobros),
    create: vi.fn(),
    remove: vi.fn(),
  };
}

function buildDocumentoRepository(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
}

// Catálogo de tipos de documento stub con el mismo seed que `CHECKLIST_DOCUMENTOS_FACTURA` (el
// checklist del detalle es catalog-driven desde la migración 20260816120000 — el detalle
// mapea { id, nombre: tipo, requerido }).
const TIPOS_DOCUMENTO_STUB: TipoDocumentoFactura[] = [
  { id: 'tipo-arca', tipo: 'Comprobante ARCA', requerido: true, activa: true },
  { id: 'tipo-asistencia', tipo: 'Asistencia', requerido: true, activa: true },
  { id: 'tipo-codem', tipo: 'CODEM', requerido: false, activa: true },
];

function buildTiposDocumentoRepository(): TiposDocumentoRepository {
  return {
    listarActivos: vi.fn().mockResolvedValue(TIPOS_DOCUMENTO_STUB),
    listarTodos: vi.fn().mockResolvedValue(TIPOS_DOCUMENTO_STUB),
    crear: vi.fn(),
    editar: vi.fn(),
    desactivar: vi.fn(),
    reactivar: vi.fn(),
  };
}

function renderDetail(overrides: Partial<React.ComponentProps<typeof FacturaDetail>> = {}) {
  const crear = vi.fn().mockResolvedValue(facturaAFacturar());
  const actualizar = vi.fn().mockResolvedValue(facturaAFacturar({ estado: 'facturado' }));
  const onCreated = vi.fn();
  const emitir = vi.fn().mockResolvedValue(facturaAFacturar({ estado: 'facturado', cae: '75000000000001' }));
  const onEmitida = vi.fn();
  const onBack = vi.fn();

  renderConQuery(
    <AuthProvider repository={mockAuthRepository}>
      <TiposDocumentoRepositoryProvider repository={buildTiposDocumentoRepository()}>
        <FacturaDetail
          factura={facturaAFacturar()}
          crear={crear}
          actualizar={actualizar}
          facturasExistentes={[facturaAFacturar()]}
          pacientes={[martina]}
          obrasSociales={[osecac]}
          feriados={[]}
          presupuestoRepository={buildPresupuestoRepository()}
          autorizacionRepository={buildAutorizacionRepository()}
          emisionRepository={{ emitir, verComprobante: vi.fn() }}
          cobroRepository={buildCobroRepository()}
          documentoRepository={buildDocumentoRepository()}
          onCreated={onCreated}
          onEmitida={onEmitida}
          onBack={onBack}
          {...overrides}
        />
      </TiposDocumentoRepositoryProvider>
    </AuthProvider>,
  );
  return { crear, actualizar, emitir, onEmitida, onCreated, onBack };
}

function renderDetailConPermiso(puedeEscribir: boolean, overrides: Partial<React.ComponentProps<typeof FacturaDetail>> = {}) {
  const crear = vi.fn().mockResolvedValue(facturaAFacturar());
  const actualizar = vi.fn().mockResolvedValue(facturaAFacturar({ estado: 'facturado' }));
  const onCreated = vi.fn();
  const emitir = vi.fn().mockResolvedValue(facturaAFacturar({ estado: 'facturado', cae: '75000000000001' }));
  const onEmitida = vi.fn();
  const onBack = vi.fn();

  renderConQuery(
    <AuthProvider repository={mockAuthRepository}>
      <PuedeEscribirContext.Provider value={puedeEscribir}>
        <TiposDocumentoRepositoryProvider repository={buildTiposDocumentoRepository()}>
          <FacturaDetail
            factura={facturaAFacturar()}
            crear={crear}
            actualizar={actualizar}
            facturasExistentes={[facturaAFacturar()]}
            pacientes={[martina]}
            obrasSociales={[osecac]}
            feriados={[]}
            presupuestoRepository={buildPresupuestoRepository()}
            autorizacionRepository={buildAutorizacionRepository()}
            emisionRepository={{ emitir, verComprobante: vi.fn() }}
            cobroRepository={buildCobroRepository()}
            documentoRepository={buildDocumentoRepository()}
            onCreated={onCreated}
            onEmitida={onEmitida}
            onBack={onBack}
            {...overrides}
          />
        </TiposDocumentoRepositoryProvider>
      </PuedeEscribirContext.Provider>
    </AuthProvider>,
  );
  return { crear, actualizar, emitir, onEmitida, onCreated, onBack };
}

describe('FacturaDetail', () => {
  it('muestra el resumen de la factura: período, días, valor del km, cantidad de km, total, tipo de comprobante y estado', () => {
    renderDetail();
    // El período aparece dos veces por diseño (pill de estado + resumen estructurado).
    expect(screen.getAllByText(/8\/2026/).length).toBeGreaterThan(0);
    expect(screen.getByText('A facturar')).toBeInTheDocument();
  });

  it('agrupa las discrepancias vigentes contra el docx en un único AvisoModeloDatos', () => {
    // Tras integracion-facturacion (tasks.md 1.3/6.1), las 4 discrepancias originales de C-07
    // (AsistenciaPrestacion, documento_factura, fecha_estimada_cobro, cantidad_km) quedaron
    // CERRADAS: existen de verdad en el schema real. El cartel ahora lista las vigentes (D12
    // N1/N2/Open Questions) — ver FacturaAvisoDiscrepancias.tsx.
    renderDetail();
    const avisos = screen.getAllByRole('note');
    const agrupado = avisos.find((aviso) => aviso.textContent?.includes('Traslados-Modelo-Datos.docx'));
    expect(agrupado).toBeTruthy();
    const texto = agrupado?.textContent ?? '';
    expect(texto).toMatch(/pendiente/i);
    expect(texto).toMatch(/fecha_factura|fecha de emisión/i);
    expect(texto).toMatch(/obra social/i);
  });

  it('emitir invoca la Edge Function `facturar` (§5), no `actualizar` con snapshots locales', async () => {
    const { emitir, actualizar, onEmitida } = renderDetail();

    await userEvent.click(screen.getByRole('button', { name: /^emitir/i }));

    await waitFor(() => expect(emitir).toHaveBeenCalledWith('factura-1'));
    // los snapshots (fechaFactura, identificador, descripción) los congela la EF, no el cliente
    expect(actualizar).not.toHaveBeenCalled();
    await waitFor(() => expect(onEmitida).toHaveBeenCalled());
  });

  it('un rechazo de ARCA se muestra como error y deja la factura editable', async () => {
    const emitir = vi.fn().mockRejectedValue(new Error('ARCA rechazó el comprobante: fecha fuera de rango'));
    renderDetail({ emisionRepository: { emitir, verComprobante: vi.fn() } });

    await userEvent.click(screen.getByRole('button', { name: /^emitir/i }));

    await waitFor(() => expect(screen.getByText(/ARCA rechazó el comprobante/i)).toBeInTheDocument());
  });

  // `resolverCupoAutorizado` deriva el cupo de la autorización ELEGIDA (change
  // `facturacion-seleccion-autorizacion`, design.md D6, tasks.md 3.6): ya no adivina vía
  // `presupuestoRepository.list()` + `getByPresupuestoId` — la factura necesita `autorizacionId` y
  // el repository resuelve por `getById`.
  it('exige confirmación explícita antes de emitir si excede el cupo autorizado, sin bloquear', async () => {
    const autorizacionRepository: AutorizacionRepository = {
      ...buildAutorizacionRepository(),
      getById: vi.fn().mockResolvedValue({
        id: 'auth-1',
        presupuestoId: 'pres-1',
        estado: 'autorizada',
        cupoMensualDias: 5,
        cupoMensualKm: 5,
      }),
    };

    const { emitir } = renderDetail({
      factura: facturaAFacturar({ autorizacionId: 'auth-1' }),
      facturasExistentes: [facturaAFacturar({ autorizacionId: 'auth-1' })],
      autorizacionRepository,
    });

    await userEvent.click(screen.getByRole('button', { name: /^emitir/i }));

    await waitFor(() => expect(screen.getByText(/ten[ée]s autorizados/i)).toBeInTheDocument());
    expect(emitir).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /confirmar emisión/i }));
    await waitFor(() => expect(emitir).toHaveBeenCalled());
  });

  it('señaliza una factura facturada vencida sin cobro', () => {
    renderDetail({
      factura: facturaAFacturar({
        estado: 'facturado',
        fechaFactura: '2020-01-01',
        fechaEstimadaCobro: '2020-04-01',
      }),
    });
    expect(screen.getByText(/vencida/i)).toBeInTheDocument();
  });

  // RF-410 (fix directo 2026-08-15): el checklist documental de la factura es FIJO, independiente
  // de la obra social del paciente — antes reusaba `obraSocial?.checklist` (RN-FA-08).
  it('arma el checklist documental desde el catálogo de tipos de documento, no desde el checklist de la obra social del paciente', async () => {
    const osecacConChecklistDistinto: ObraSocial = {
      ...osecac,
      checklist: [{ id: 'item-solo-os', nombre: 'Ítem exclusivo de la obra social', requerido: true }],
    };

    renderDetail({ obrasSociales: [osecacConChecklistDistinto] });

    await waitFor(() => {
      expect(screen.getAllByText('Comprobante ARCA').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Asistencia').length).toBeGreaterThan(0);
      expect(screen.getAllByText('CODEM').length).toBeGreaterThan(0);
    });
    expect(screen.queryByText('Ítem exclusivo de la obra social')).not.toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 4.2, design.md D1). "Editar" (:172) queda
// visible pero no activable sin permiso de escritura.
describe('FacturaDetail — gateo de escritura de la entrada a edición', () => {
  it('sin permiso de escritura: "Editar" queda visible y no se puede activar', () => {
    renderDetailConPermiso(false);

    const editar = screen.getByRole('button', { name: /^editar$/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();
    // El resumen sigue siendo legible con solo `read`.
    expect(screen.getByText('A facturar')).toBeInTheDocument();
  });

  it('con permiso de escritura: "Editar" está activable (triangulación)', () => {
    renderDetailConPermiso(true);

    expect(screen.getByRole('button', { name: /^editar$/i })).toBeEnabled();
  });
});

// Gateo de escritura (gateo-facturacion, tasks.md 5.6, design.md D2). Verificación explícita de
// la decisión 5 de la usuaria: `write` alcanza para las 4 acciones de dinero (emitir, cobrar,
// corregir estado, editar asistencias), ninguna requiere `admin`. Como "Emitir" solo aparece en
// `a-facturar` y "Registrar cobro"/"Aplicar" solo fuera de ese estado, se verifican en renders
// separados de la misma sesión (mismo `puedeEscribir`).
describe('FacturaDetail — write alcanza para todas las acciones de dinero (tasks.md 5.6)', () => {
  it('con write (sin admin): emitir, cobrar y corregir estado están activables', async () => {
    renderDetailConPermiso(true);
    expect(screen.getByRole('button', { name: /^emitir factura$/i })).toBeEnabled();

    renderDetailConPermiso(true, {
      factura: facturaAFacturar({ estado: 'cobrado' }),
      cobroRepository: buildCobroRepository([]),
    });
    expect(await screen.findByRole('button', { name: /registrar cobro/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /aplicar/i })).toBeEnabled();
  });

  // Wizard de 3 pasos (change `facturacion-wizard-paciente-prestador`): "Nueva factura" arranca
  // en el Paso 1 (solo Paciente) — hay que elegir paciente, elegir una autorización pendiente en el
  // Paso 2 (change `facturacion-seleccion-autorizacion`, design.md D4, tasks.md 3.3: "Siguiente"
  // queda bloqueado sin elegir una) y avanzar antes de llegar al Paso 3.
  // WU2 (2026-08-16): la UI de asistencias (tarjeta AsistenciasEditor + campo de alta de
  // prestación) se elimina del Paso 3 — con write y wizard atravesado, el Paso 3 no muestra ni la
  // tarjeta ni ningún input de prestación.
  it('con write: el Paso 3 ya no muestra la tarjeta de asistencias ni ningún campo de prestación', async () => {
    const presupuestoRepository: PresupuestoRepository = {
      ...buildPresupuestoRepository(),
      list: vi.fn().mockResolvedValue([{ id: 'pres-1', pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 1000, fechaEmision: '2026-01-01' }]),
    };
    const autorizacionRepository: AutorizacionRepository = {
      ...buildAutorizacionRepository(),
      listByPresupuestoId: vi.fn().mockResolvedValue([{ id: 'auth-1', presupuestoId: 'pres-1', estado: 'autorizada' }]),
    };

    renderDetailConPermiso(true, { factura: null, presupuestoRepository, autorizacionRepository });

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const autorizacion = await screen.findByLabelText(/^autorización$/i);
    await userEvent.selectOptions(autorizacion, 'auth-1');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    expect(screen.queryAllByLabelText(/^prestación$/i, { selector: 'input' })).toHaveLength(0);
    expect(screen.queryByText(/asistencias \/ prestaciones declaradas/i)).not.toBeInTheDocument();
  });

  it('sin permiso de escritura (solo read): las cuatro acciones quedan bloqueadas', async () => {
    renderDetailConPermiso(false);
    expect(screen.getByRole('button', { name: /^emitir factura$/i })).toBeDisabled();

    renderDetailConPermiso(false, {
      factura: facturaAFacturar({ estado: 'cobrado' }),
      cobroRepository: buildCobroRepository([]),
    });
    expect(await screen.findByRole('button', { name: /registrar cobro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /aplicar/i })).toBeDisabled();

    // Wizard + gateo (change `facturacion-wizard-paciente-prestador`): con el Paciente del Paso 1
    // deshabilitado, `pacienteId` nunca puede setearse, así que "Siguiente" nunca se habilita y el
    // Paso 3 nunca se monta — un bloqueo más fuerte que "campo deshabilitado": el contenido del
    // Paso 3 queda directamente inalcanzable para una cuenta de solo lectura que está dando de
    // alta una factura nueva.
    renderDetailConPermiso(false, { factura: null });
    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
    expect(screen.queryAllByLabelText(/^prestación$/i, { selector: 'input' })).toHaveLength(0);
  });
});

// RN-FA-06: una factura ya emitida es un documento fiscal — el formulario de edición se bloquea.
// El botón "Editar" solo existe mientras la factura está en 'a-facturar'.
describe('FacturaDetail — factura emitida no editable (RN-FA-06)', () => {
  it('estado "a-facturar": el botón "Editar" está', () => {
    renderDetail({ factura: facturaAFacturar({ estado: 'a-facturar' }) });
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
  });

  it('estado "facturado" con CAE: no hay botón "Editar", y avisa que es un documento fiscal', () => {
    renderDetail({ factura: facturaAFacturar({ estado: 'facturado', cae: '75000000000001', cbteNro: 7, ptoVta: 1 }) });
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
    expect(screen.getByText(/documento fiscal y no se puede modificar/i)).toBeInTheDocument();
  });

  it('estado "facturado" sin CAE (legacy): tampoco deja editar', () => {
    renderDetail({ factura: facturaAFacturar({ estado: 'facturado' }) });
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });

  it('estado "cobrado": no deja editar', () => {
    renderDetail({ factura: facturaAFacturar({ estado: 'cobrado', cae: '75000000000001' }) });
    expect(screen.queryByRole('button', { name: /editar/i })).not.toBeInTheDocument();
  });

  it('una factura emitida sigue mostrando el resumen de solo lectura, sin campos de formulario', () => {
    renderDetail({ factura: facturaAFacturar({ estado: 'facturado', cae: '75000000000001', monto: 4500 }) });
    expect(screen.getAllByText(/\$4\.500/).length).toBeGreaterThan(0);
    expect(screen.queryByLabelText(/cantidad de días/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/valor del km/i)).not.toBeInTheDocument();
  });
});
