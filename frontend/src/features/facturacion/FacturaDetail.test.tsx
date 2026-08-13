import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Cobro, Factura } from '../../shared/types/factura';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
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
    getByPresupuestoId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
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

function renderDetail(overrides: Partial<React.ComponentProps<typeof FacturaDetail>> = {}) {
  const crear = vi.fn().mockResolvedValue(facturaAFacturar());
  const actualizar = vi.fn().mockResolvedValue(facturaAFacturar({ estado: 'facturado' }));
  const onCreated = vi.fn();
  const onBack = vi.fn();

  render(
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
      cobroRepository={buildCobroRepository()}
      documentoRepository={buildDocumentoRepository()}
      onCreated={onCreated}
      onBack={onBack}
      {...overrides}
    />,
  );
  return { crear, actualizar, onCreated, onBack };
}

function renderDetailConPermiso(puedeEscribir: boolean, overrides: Partial<React.ComponentProps<typeof FacturaDetail>> = {}) {
  const crear = vi.fn().mockResolvedValue(facturaAFacturar());
  const actualizar = vi.fn().mockResolvedValue(facturaAFacturar({ estado: 'facturado' }));
  const onCreated = vi.fn();
  const onBack = vi.fn();

  render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
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
        cobroRepository={buildCobroRepository()}
        documentoRepository={buildDocumentoRepository()}
        onCreated={onCreated}
        onBack={onBack}
        {...overrides}
      />
    </PuedeEscribirContext.Provider>,
  );
  return { crear, actualizar, onCreated, onBack };
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

  it('emite la factura (a-facturar → facturado): congela descripción, identificador y calcula fecha estimada de cobro', async () => {
    const { actualizar } = renderDetail();

    await userEvent.click(screen.getByRole('button', { name: /^emitir/i }));

    await waitFor(() => expect(actualizar).toHaveBeenCalled());
    const [id, payload] = actualizar.mock.calls[0] as [string, Partial<Factura>];
    expect(id).toBe('factura-1');
    expect(payload.estado).toBe('facturado');
    expect(payload.fechaFactura).toBeTruthy();
    expect(payload.fechaEstimadaCobro).toBeTruthy();
    expect(payload.identificadorFactura).toEqual({ origen: 'paciente.numeroAfiliado', valor: '45123456' });
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

    const { actualizar } = renderDetail({
      factura: facturaAFacturar({ autorizacionId: 'auth-1' }),
      facturasExistentes: [facturaAFacturar({ autorizacionId: 'auth-1' })],
      autorizacionRepository,
    });

    await userEvent.click(screen.getByRole('button', { name: /^emitir/i }));

    await waitFor(() => expect(screen.getByText(/ten[ée]s autorizados/i)).toBeInTheDocument());
    expect(actualizar).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: /confirmar emisión/i }));
    await waitFor(() => expect(actualizar).toHaveBeenCalled());
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
  // en el Paso 1 (solo Paciente) — AsistenciasEditor vive en el Paso 3, hay que elegir paciente,
  // elegir una autorización pendiente en el Paso 2 (change `facturacion-seleccion-autorizacion`,
  // design.md D4, tasks.md 3.3: "Siguiente" queda bloqueado sin elegir una) y avanzar antes de
  // llegar a verlo.
  it('con write (sin admin): editar asistencias está activable (en modo edición del form)', async () => {
    const presupuestoRepository: PresupuestoRepository = {
      ...buildPresupuestoRepository(),
      list: vi.fn().mockResolvedValue([{ id: 'pres-1', pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 1000, fechaEmision: '2026-01-01' }]),
    };
    const autorizacionRepository: AutorizacionRepository = {
      ...buildAutorizacionRepository(),
      getByPresupuestoId: vi.fn().mockResolvedValue({ id: 'auth-1', presupuestoId: 'pres-1', estado: 'autorizada' }),
    };

    renderDetailConPermiso(true, { factura: null, presupuestoRepository, autorizacionRepository });

    await userEvent.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-martina');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    const autorizacion = await screen.findByLabelText(/^autorización$/i);
    await userEvent.selectOptions(autorizacion, 'auth-1');
    await userEvent.click(screen.getByRole('button', { name: /siguiente/i }));

    // "Prestación" existe dos veces en el Paso 3: FacturaFormDatosBasicos (gateo tasks.md 4.3) y
    // el alta de AsistenciasEditor (gateo propio, tasks.md 5.4) — se toma la segunda, la de
    // asistencias.
    const camposPrestacion = screen.getAllByLabelText(/^prestación$/i, { selector: 'input' });
    expect(camposPrestacion[1]).toBeEnabled();
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
    // Paso 3 (donde vive AsistenciasEditor) nunca se monta — un bloqueo más fuerte que "campo
    // deshabilitado": la acción de dinero #4 (editar asistencias) queda directamente inalcanzable
    // para una cuenta de solo lectura que está dando de alta una factura nueva.
    renderDetailConPermiso(false, { factura: null });
    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeDisabled();
    expect(screen.queryAllByLabelText(/^prestación$/i, { selector: 'input' })).toHaveLength(0);
  });
});
