import { describe, expect, it, vi, beforeEach } from 'vitest';

// Fake tipado de `supabase.functions.invoke` (sin `any`, sin `as` sobre datos externos), mismo
// molde que `SupabasePresupuestoRepository.test.ts`. La Edge Function `facturar` devuelve la fila
// releída de `facturacion.facturas` en shape snake_case + embed `asistencia_prestacion` (igual que
// `SELECT_FACTURA_COMPLETA`), así que el repo reutiliza `ensamblarFactura` sin mapping nuevo.

interface FakeInvokeExito {
  data: unknown;
  error: null;
}
interface FakeInvokeErrorHttp {
  data: null;
  error: { context: Response };
}
type FakeInvokeRespuesta = FakeInvokeExito | FakeInvokeErrorHttp;

const functionsInvoke =
  vi.fn<(nombre: string, opciones?: { method?: string; body?: unknown }) => Promise<FakeInvokeRespuesta>>();

vi.mock('../supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...(args as [string, { method?: string; body?: unknown }?])) },
  },
}));

const { supabaseEmisionRepository } = await import('./SupabaseEmisionRepository');

function filaFacturaEmitida(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'factura-1',
    paciente_id: 'paciente-1',
    descripcion: 'Traslados marzo',
    dias: 20,
    valor_km: 150,
    monto: 121000,
    estado: 'facturado',
    fecha_init: '2026-03-01',
    fecha_tope: '2026-03-31',
    tipo: 'A',
    cantidad_km: 320,
    fecha_estimada_cobro: '2026-06-01',
    fecha_factura: '2026-04-02',
    prestacion: 'Traslado',
    mes_facturado: 3,
    anio_facturado: 2026,
    dependencia_y_retorno: 'Domicilio - Centro',
    domicilio_id: 'domicilio-1',
    identificador_origen: 'paciente.dni',
    identificador_valor: '30123456',
    autorizacion_id: 'autorizacion-1',
    cae: '75123456789012',
    cae_vencimiento: '2026-04-12',
    cbte_nro: 45,
    pto_vta: 3,
    arca_ambiente: 'homologacion',
    comprobante_pdf_url: 'factura-1/FACTURA_A-3-45.pdf',
    asistencia_prestacion: [
      { id: 'a-1', fecha: '2026-03-05', prestacion: 'Traslado', dependencia: 'Domicilio', retorno: 'Centro', factura_sabados: false },
    ],
    ...overrides,
  };
}

describe('supabaseEmisionRepository.emitir()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca POST /facturar exactamente una vez con { facturaId } y nada más', async () => {
    functionsInvoke.mockResolvedValue({ data: filaFacturaEmitida(), error: null });

    await supabaseEmisionRepository.emitir('factura-1');

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('facturar', { method: 'POST', body: { facturaId: 'factura-1' } });
  });

  it('el body NO lleva datos fiscales ni snapshots (los calcula el servidor)', async () => {
    functionsInvoke.mockResolvedValue({ data: filaFacturaEmitida(), error: null });

    await supabaseEmisionRepository.emitir('factura-1');

    const [, opciones] = functionsInvoke.mock.calls[0] ?? [];
    expect(Object.keys(opciones?.body as Record<string, unknown>)).toEqual(['facturaId']);
  });

  it('devuelve la factura releída, ensamblada con sus campos fiscales y asistencias', async () => {
    functionsInvoke.mockResolvedValue({ data: filaFacturaEmitida(), error: null });

    const factura = await supabaseEmisionRepository.emitir('factura-1');

    expect(factura).toMatchObject({
      id: 'factura-1',
      estado: 'facturado',
      cae: '75123456789012',
      caeVencimiento: '2026-04-12',
      cbteNro: 45,
      ptoVta: 3,
      arcaAmbiente: 'homologacion',
      comprobantePdfUrl: 'factura-1/FACTURA_A-3-45.pdf',
    });
    expect(factura.asistencias).toHaveLength(1);
  });

  it('un rechazo 422 de ARCA se traduce a mensaje de UI con las observaciones', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'x', codigo: 'ARCA_RECHAZO', observaciones: 'Fecha fuera de rango' }), { status: 422 }) },
    });

    await expect(supabaseEmisionRepository.emitir('factura-1')).rejects.toThrow(
      'ARCA rechazó el comprobante: Fecha fuera de rango',
    );
  });

  it('un 503 EMISION_NO_CONFIGURADA se traduce a "no está configurada"', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'x', codigo: 'EMISION_NO_CONFIGURADA' }), { status: 503 }) },
    });

    await expect(supabaseEmisionRepository.emitir('factura-1')).rejects.toThrow(
      'La emisión electrónica todavía no está configurada. Avisá a administración.',
    );
  });

  it('un 409 YA_EMITIDA se traduce mencionando el CAE existente', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'x', codigo: 'YA_EMITIDA', cae: '70000000000001' }), { status: 409 }) },
    });

    await expect(supabaseEmisionRepository.emitir('factura-1')).rejects.toThrow(
      'Esta factura ya fue emitida (CAE 70000000000001).',
    );
  });

  it('una respuesta 200 sin id utilizable no se hace pasar por éxito', async () => {
    functionsInvoke.mockResolvedValue({ data: { estado: 'facturado' }, error: null });

    await expect(supabaseEmisionRepository.emitir('factura-1')).rejects.toThrow('No se pudo emitir la factura.');
  });
});
