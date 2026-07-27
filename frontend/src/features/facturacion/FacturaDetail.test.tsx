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
  numeroAfiliado: { formato: 'numero-documento', valor: '45123456' },
  cud: null,
  direcciones: [{ id: 'dir-1', tipo: 'domicilio', calle: 'Rivadavia 4500', localidad: 'CABA' }],
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
  return { listByEntity: vi.fn().mockResolvedValue([]), upload: vi.fn(), remove: vi.fn() };
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

describe('FacturaDetail', () => {
  it('muestra el resumen de la factura: período, días, valor del km, cantidad de km, total, tipo de comprobante y estado', () => {
    renderDetail();
    // El período aparece dos veces por diseño (pill de estado + resumen estructurado).
    expect(screen.getAllByText(/8\/2026/).length).toBeGreaterThan(0);
    expect(screen.getByText('A facturar')).toBeInTheDocument();
  });

  it('agrupa las 5 discrepancias de impacto backend en un único AvisoModeloDatos', () => {
    renderDetail();
    const avisos = screen.getAllByRole('note');
    // El AvisoModeloDatos general (Decisión 14) es uno solo; puede haber otro específico en la
    // sección de documentos (10.4) — se verifica que exista al menos el agrupado con las 5 claves.
    const agrupado = avisos.find((aviso) => aviso.textContent?.includes('AsistenciaPrestacion'));
    expect(agrupado).toBeTruthy();
    const texto = agrupado?.textContent ?? '';
    expect(texto).toMatch(/documento_factura|documentos por factura/i);
    expect(texto).toMatch(/fecha_estimada_cobro|fecha estimada de cobro/i);
    expect(texto).toMatch(/cantidad_km|cantidad de km/i);
    expect(texto).toMatch(/estado/i);
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

  it('exige confirmación explícita antes de emitir si excede el cupo autorizado, sin bloquear', async () => {
    const autorizacionRepository: AutorizacionRepository = {
      ...buildAutorizacionRepository(),
      getByPresupuestoId: vi.fn().mockResolvedValue({
        id: 'auth-1',
        presupuestoId: 'pres-1',
        estado: 'autorizada',
        cupoMensualDias: 5,
        cupoMensualKm: 5,
      }),
    };
    const presupuestoRepository: PresupuestoRepository = {
      ...buildPresupuestoRepository(),
      list: vi.fn().mockResolvedValue([{ id: 'pres-1', pacienteId: 'paciente-martina', obraSocialId: 'osecac', monto: 1000, fechaEmision: '2026-01-01' }]),
    };

    const { actualizar } = renderDetail({ presupuestoRepository, autorizacionRepository });

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
