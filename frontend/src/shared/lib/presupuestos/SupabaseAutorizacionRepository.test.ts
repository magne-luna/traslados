import { describe, expect, it, vi, beforeEach } from 'vitest';

// Fake tipado de `supabase.functions.invoke`, mismo criterio que
// SupabasePresupuestoRepository.test.ts / SupabaseCuentaRepository.test.ts.

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

const { supabaseAutorizacionRepository } = await import('./SupabaseAutorizacionRepository');

const AUTORIZACION_API_COMPLETA = {
  id: 'a1',
  presupuestoId: 'p1',
  estado: 'autorizada',
  fechaRespuesta: '2026-02-01',
  montoAutorizado: 12000,
  vigenciaDesde: '2026-02-01',
  cupoMensualDias: 10,
  cupoMensualKm: 500,
  archivoUrl: null,
};

describe('supabaseAutorizacionRepository.list() (3.8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca GET /autorizaciones exactamente una vez, sin invocaciones adicionales por fila (anti N+1)', async () => {
    functionsInvoke.mockResolvedValue({
      data: [AUTORIZACION_API_COMPLETA, { ...AUTORIZACION_API_COMPLETA, id: 'a2' }],
      error: null,
    });

    await supabaseAutorizacionRepository.list();

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('autorizaciones', { method: 'GET' });
  });

  it('descarta filas malformadas sin tumbar el listado (D6, triangulación)', async () => {
    functionsInvoke.mockResolvedValue({
      data: [AUTORIZACION_API_COMPLETA, { esto: 'no es una autorizacion' }],
      error: null,
    });

    const autorizaciones = await supabaseAutorizacionRepository.list();

    expect(autorizaciones).toHaveLength(1);
  });

  it('data no es un array devuelve lista vacía en vez de reventar', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: null });

    const autorizaciones = await supabaseAutorizacionRepository.list();

    expect(autorizaciones).toEqual([]);
  });

  it('un error de la Edge Function se traduce con el mensaje de dominio de autorización', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 401 }) } });

    await expect(supabaseAutorizacionRepository.list()).rejects.toThrow('Tu sesión expiró. Volvé a iniciar sesión.');
  });
});

describe('supabaseAutorizacionRepository.getById() (3.8 — los tres caminos)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 invoca GET /autorizaciones/:id y devuelve la Autorizacion mapeada', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_API_COMPLETA, error: null });

    const autorizacion = await supabaseAutorizacionRepository.getById('a1');

    expect(functionsInvoke).toHaveBeenCalledWith('autorizaciones/a1', { method: 'GET' });
    expect(autorizacion?.id).toBe('a1');
  });

  it('404 devuelve null y NO lanza', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    const autorizacion = await supabaseAutorizacionRepository.getById('inexistente');

    expect(autorizacion).toBeNull();
  });

  it('403 lanza con el mensaje de falta de permiso de lectura de autorizaciones', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabaseAutorizacionRepository.getById('a1')).rejects.toThrow('No tenés permiso para ver autorizaciones.');
  });
});

const NUEVA_AUTORIZACION = { presupuestoId: 'p1', estado: 'pendiente' as const };

describe('supabaseAutorizacionRepository.create() (3.8)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca POST /autorizaciones una sola vez con el body de toCrearAutorizacionPayload', async () => {
    functionsInvoke.mockResolvedValue({ data: { ...AUTORIZACION_API_COMPLETA, id: 'nueva' }, error: null });

    const creada = await supabaseAutorizacionRepository.create(NUEVA_AUTORIZACION);

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('autorizaciones', {
      method: 'POST',
      body: { presupuestoId: 'p1', estado: 'pendiente' },
    });
    expect(creada.id).toBe('nueva');
  });

  it('403 lanza con el mensaje de falta de permiso de escritura de autorizaciones', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabaseAutorizacionRepository.create(NUEVA_AUTORIZACION)).rejects.toThrow(
      'No tenés permiso para modificar autorizaciones.',
    );
  });

  it('400 con el prefijo RN-PA-01 se traduce al mensaje de UI, sin filtrar el texto crudo del trigger', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ error: 'RN-PA-01: monto_autorizado (900) no puede superar el presupuesto (500)' }),
          { status: 400 },
        ),
      },
    });

    await expect(
      supabaseAutorizacionRepository.create({ ...NUEVA_AUTORIZACION, montoAutorizado: 900 }),
    ).rejects.toThrow('La autorización no puede superar el monto del presupuesto.');
  });

  it('respuesta 201 con body malformado (parseAutorizacionApi -> null) lanza un mensaje explícito (3.11, cobertura)', async () => {
    functionsInvoke.mockResolvedValue({ data: { esto: 'no tiene forma de Autorizacion' }, error: null });

    await expect(supabaseAutorizacionRepository.create(NUEVA_AUTORIZACION)).rejects.toThrow(
      'No se pudo guardar la autorización.',
    );
  });
});

describe('supabaseAutorizacionRepository.update() (3.8 — mismo criterio de asimetría que 3.7)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca PATCH /autorizaciones/:id con el body de toActualizarAutorizacionPayload (claves ausentes no viajan)', async () => {
    functionsInvoke.mockResolvedValue({ data: { ...AUTORIZACION_API_COMPLETA, estado: 'rechazada' }, error: null });

    const actualizada = await supabaseAutorizacionRepository.update('a1', { estado: 'rechazada' });

    expect(functionsInvoke).toHaveBeenCalledWith('autorizaciones/a1', { method: 'PATCH', body: { estado: 'rechazada' } });
    expect(actualizada.estado).toBe('rechazada');

    const [, opciones] = functionsInvoke.mock.calls[0] ?? [];
    const body = opciones && typeof opciones === 'object' && 'body' in opciones ? opciones.body : undefined;
    expect(body && typeof body === 'object' ? 'montoAutorizado' in body : true).toBe(false);
  });

  it('404 en update() SÍ lanza, con el mensaje idéntico al del mock de autorización', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    await expect(supabaseAutorizacionRepository.update('inexistente', { estado: 'rechazada' })).rejects.toThrow(
      'No existe una autorización con id "inexistente".',
    );
  });

  it('respuesta 200 con body malformado (parseAutorizacionApi -> null) lanza un mensaje explícito (3.11, cobertura)', async () => {
    functionsInvoke.mockResolvedValue({ data: { esto: 'no tiene forma de Autorizacion' }, error: null });

    await expect(supabaseAutorizacionRepository.update('a1', { estado: 'rechazada' })).rejects.toThrow(
      'No se pudo guardar la autorización.',
    );
  });
});

describe('supabaseAutorizacionRepository.getByPresupuestoId() (3.9)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca autorizaciones?presupuestoId=<id> con el id percent-encoded', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_API_COMPLETA, error: null });

    await supabaseAutorizacionRepository.getByPresupuestoId('id con espacio/raro');

    expect(functionsInvoke).toHaveBeenCalledWith(
      `autorizaciones?presupuestoId=${encodeURIComponent('id con espacio/raro')}`,
      { method: 'GET' },
    );
  });

  it('200 devuelve la Autorizacion mapeada', async () => {
    functionsInvoke.mockResolvedValue({ data: AUTORIZACION_API_COMPLETA, error: null });

    const autorizacion = await supabaseAutorizacionRepository.getByPresupuestoId('p1');

    expect(autorizacion?.presupuestoId).toBe('p1');
  });

  it('404 devuelve null — el presupuesto todavía no tiene autorización, es el caso normal, no un error', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    const autorizacion = await supabaseAutorizacionRepository.getByPresupuestoId('p-sin-autorizacion');

    expect(autorizacion).toBeNull();
  });

  it('403 lanza con el mensaje de falta de permiso de lectura', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabaseAutorizacionRepository.getByPresupuestoId('p1')).rejects.toThrow(
      'No tenés permiso para ver autorizaciones.',
    );
  });
});
