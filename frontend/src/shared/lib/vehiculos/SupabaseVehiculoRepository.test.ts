import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MantenimientoRegistro, NuevoVehiculo } from '../../types/vehiculo';

// Fake tipado de `supabase.functions.invoke`, mismo estilo que
// `SupabasePresupuestoRepository.test.ts` / `SupabaseCuentaRepository.test.ts`.
interface FakeInvokeExito {
  data: unknown;
  error: null;
}
interface FakeInvokeErrorHttp {
  data: null;
  error: { context: Response };
}
interface FakeInvokeErrorRed {
  data: null;
  error: Error;
}
type FakeInvokeRespuesta = FakeInvokeExito | FakeInvokeErrorHttp | FakeInvokeErrorRed;

const functionsInvoke = vi.fn<(nombre: string, opciones?: { method?: string; body?: unknown }) => Promise<FakeInvokeRespuesta>>();

vi.mock('../supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...(args as [string, { method?: string; body?: unknown }?])) },
  },
}));

const { supabaseVehiculoRepository } = await import('./SupabaseVehiculoRepository');

function respuestaHttp(status: number, body: unknown): { context: Response } {
  return { context: new Response(JSON.stringify(body), { status }) };
}

const VEHICULO_API_COMPLETO = {
  id: 'v1',
  patente: 'AC123DE',
  modelo: 'Etios',
  tipo: 'sedan',
  capacidad: 4,
  accesoriosCompatibles: ['andador'],
  estado: 'habilitado',
  kilometraje: 50000,
  kilometrajeUltimoService: 48000,
  fechaUltimoService: '2026-06-01',
  habilitaciones: [{ tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-01-01' }],
  gastos: [{ id: 'g1', fecha: '2026-07-01', monto: 15000, descripcion: 'nafta' }],
};

const NUEVO_VEHICULO: NuevoVehiculo = {
  patente: 'AC123DE',
  modelo: 'Etios',
  tipo: 'sedan',
  capacidad: 4,
  accesoriosCompatibles: ['andador'],
  estado: 'habilitado',
  kilometraje: 50000,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '',
  habilitaciones: [],
  gastos: [{ id: 'g1', fecha: '2026-07-01', monto: 15000, descripcion: 'nafta' }],
  mantenimientos: [],
};

const MANTENIMIENTO_PREVENTIVO: MantenimientoRegistro = {
  id: 'm1',
  fecha: '2026-05-01',
  kilometraje: 40000,
  tipoIntervencion: 'preventivo',
  subtipo: 'cambio-aceite-filtros',
};

describe('supabaseVehiculoRepository.list()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca GET /vehiculos una sola vez y devuelve la lista mapeada', async () => {
    functionsInvoke.mockResolvedValue({ data: [VEHICULO_API_COMPLETO, { ...VEHICULO_API_COMPLETO, id: 'v2' }], error: null });

    const resultado = await supabaseVehiculoRepository.list();

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('vehiculos', { method: 'GET' });
    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toMatchObject({ id: 'v1', patente: 'AC123DE', capacidad: 4 });
  });

  it('un vehículo fuera de servicio en la API llega como tal al dominio (bug real: la Edge Function ya manda "fuera-de-servicio" con guion, no el valor crudo de la base con espacio)', async () => {
    functionsInvoke.mockResolvedValue({ data: [{ ...VEHICULO_API_COMPLETO, estado: 'fuera-de-servicio' }], error: null });

    const resultado = await supabaseVehiculoRepository.list();

    expect(resultado[0]?.estado).toBe('fuera-de-servicio');
  });

  it('descarta filas malformadas (sin patente) sin romper el resto de la lista', async () => {
    functionsInvoke.mockResolvedValue({ data: [VEHICULO_API_COMPLETO, { id: 'roto' }], error: null });

    const resultado = await supabaseVehiculoRepository.list();

    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.id).toBe('v1');
  });

  it('data no-array degrada a lista vacía', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: null });
    expect(await supabaseVehiculoRepository.list()).toEqual([]);
  });

  it('propaga el error traducido de mapearErrorVehiculo', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: respuestaHttp(403, { error: 'sin permiso' }) });
    await expect(supabaseVehiculoRepository.list()).rejects.toThrow('No tenés permiso para ver vehículos.');
  });
});

describe('supabaseVehiculoRepository.getById()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca GET /vehiculos/:id y devuelve el vehículo mapeado', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });

    const resultado = await supabaseVehiculoRepository.getById('v1');

    expect(functionsInvoke).toHaveBeenCalledWith('vehiculos/v1', { method: 'GET' });
    expect(resultado?.patente).toBe('AC123DE');
  });

  it('404 devuelve null en vez de lanzar', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: respuestaHttp(404, { error: 'vehiculo no encontrado' }) });
    expect(await supabaseVehiculoRepository.getById('inexistente')).toBeNull();
  });

  it('un error distinto de 404 sí lanza, traducido', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: new Error('network down') });
    await expect(supabaseVehiculoRepository.getById('v1')).rejects.toThrow('No se pudo conectar con el servidor.');
  });
});

describe('supabaseVehiculoRepository.create()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca POST /vehiculos con el payload esperado por la Edge Function real (accesoriosCompatibles, no "accesorios")', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });

    await supabaseVehiculoRepository.create(NUEVO_VEHICULO);

    expect(functionsInvoke).toHaveBeenCalledWith('vehiculos', {
      method: 'POST',
      body: {
        patente: 'AC123DE',
        modelo: 'Etios',
        tipo: 'sedan',
        capacidad: 4,
        estado: 'habilitado',
        kilometraje: 50000,
        accesoriosCompatibles: ['andador'],
        gastos: [{ monto: 15000, fecha: '2026-07-01', descripcion: 'nafta' }],
        mantenimientos: [],
      },
    });
  });

  it('incluye "mantenimientos" en el payload real (snake_case, sin id) — cierra el gap de la Edge Function (2026-08-10)', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });

    await supabaseVehiculoRepository.create({ ...NUEVO_VEHICULO, mantenimientos: [MANTENIMIENTO_PREVENTIVO] });

    const [, opciones] = functionsInvoke.mock.calls[0] as [string, { body: { mantenimientos: unknown } }];
    expect(opciones.body.mantenimientos).toEqual([
      {
        categoria: 'preventivo',
        subtipo: 'cambio-aceite-filtros',
        detalle: null,
        descripcion: null,
        fecha: '2026-05-01',
        km_actual: 40000,
        fecha_proximo_vencimiento: null,
        km_proximo_vencimiento: null,
      },
    ]);
  });

  it('envía "estado" tal cual lo tiene el dominio (con guion), SIN convertirlo al formato de base — la Edge Function ya hace esa conversión server-side', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });

    await supabaseVehiculoRepository.create({ ...NUEVO_VEHICULO, estado: 'fuera-de-servicio' });

    const [, opciones] = functionsInvoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(opciones.body.estado).toBe('fuera-de-servicio');
  });

  it('devuelve el vehículo creado, mapeado desde la respuesta', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });
    const creado = await supabaseVehiculoRepository.create(NUEVO_VEHICULO);
    expect(creado.id).toBe('v1');
  });

  it('propaga el error traducido (patente duplicada) sin texto crudo', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: respuestaHttp(400, { error: 'duplicate key value violates unique constraint "vehiculo_patente_key"' }),
    });
    await expect(supabaseVehiculoRepository.create(NUEVO_VEHICULO)).rejects.toThrow('Ya existe un vehículo con esa patente.');
  });
});

describe('supabaseVehiculoRepository.update() — semántica parcial', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca PATCH /vehiculos/:id enviando solo las claves presentes en cambios', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });

    await supabaseVehiculoRepository.update('v1', { kilometraje: 90000 });

    expect(functionsInvoke).toHaveBeenCalledWith('vehiculos/v1', { method: 'PATCH', body: { kilometraje: 90000 } });
  });

  it('triangulación: otro subconjunto de cambios produce otro payload, sin arrastrar claves ausentes', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });

    await supabaseVehiculoRepository.update('v1', { estado: 'fuera-de-servicio', accesoriosCompatibles: [] });

    expect(functionsInvoke).toHaveBeenCalledWith('vehiculos/v1', {
      method: 'PATCH',
      body: { estado: 'fuera-de-servicio', accesoriosCompatibles: [] },
    });
  });

  it('cambios vacíos produce un body vacío (no manda claves de más)', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });
    await supabaseVehiculoRepository.update('v1', {});
    expect(functionsInvoke).toHaveBeenCalledWith('vehiculos/v1', { method: 'PATCH', body: {} });
  });

  it('404 SÍ lanza en update (a diferencia de getById)', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: respuestaHttp(404, { error: 'vehiculo no encontrado' }) });
    await expect(supabaseVehiculoRepository.update('inexistente', { kilometraje: 1 })).rejects.toThrow(
      'No existe un vehículo con id "inexistente".',
    );
  });

  it('cambios de solo "mantenimientos" SÍ se guarda (gap cerrado 2026-08-10): manda el payload snake_case sin id, no lanza', async () => {
    functionsInvoke.mockResolvedValue({ data: VEHICULO_API_COMPLETO, error: null });

    await supabaseVehiculoRepository.update('v1', { mantenimientos: [MANTENIMIENTO_PREVENTIVO] });

    expect(functionsInvoke).toHaveBeenCalledWith('vehiculos/v1', {
      method: 'PATCH',
      body: {
        mantenimientos: [
          {
            categoria: 'preventivo',
            subtipo: 'cambio-aceite-filtros',
            detalle: null,
            descripcion: null,
            fecha: '2026-05-01',
            km_actual: 40000,
            fecha_proximo_vencimiento: null,
            km_proximo_vencimiento: null,
          },
        ],
      },
    });
  });

  it('cambios de solo "notas" (todavía sin soporte en la Edge Function real) lanza un error claro, SIN pegarle al servidor', async () => {
    functionsInvoke.mockRejectedValue(new Error('no debería llamarse'));
    functionsInvoke.mockRejectedValue(new Error('no debería llamarse'));
    await expect(supabaseVehiculoRepository.update('v1', { notas: 'service al día' })).rejects.toThrow(/no se puede guardar/i);
  });
});
