import { describe, expect, it, vi, beforeEach } from 'vitest';

// Fake tipado de `supabase.functions.invoke` (sin `any`, sin `as`), siguiendo
// `SupabaseCuentaRepository.test.ts` como referencia de estilo (tasks.md 3, cabecera). `vi.fn()` ya
// registra nombre de función, segundo argumento (`method`/`body`) de cada invocación vía
// `.mock.calls` / `toHaveBeenCalledWith` / `toHaveBeenCalledTimes` — no hace falta un estado
// adicional para "recordar" invocaciones.

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

const { supabasePresupuestoRepository } = await import('./SupabasePresupuestoRepository');

const PRESUPUESTO_API_COMPLETO = {
  id: 'p1',
  pacienteId: 'pac1',
  obraSocialId: 'os1',
  monto: 15000,
  fechaEmision: '2026-01-15',
  archivoUrl: null,
};

describe('supabasePresupuestoRepository.list() (3.4)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca GET /presupuestos exactamente una vez, sin invocaciones adicionales por fila (anti N+1)', async () => {
    functionsInvoke.mockResolvedValue({
      data: [PRESUPUESTO_API_COMPLETO, { ...PRESUPUESTO_API_COMPLETO, id: 'p2' }, { ...PRESUPUESTO_API_COMPLETO, id: 'p3' }],
      error: null,
    });

    await supabasePresupuestoRepository.list();

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('presupuestos', { method: 'GET' });
  });

  it('mapea cada fila con parsePresupuestoApi y devuelve la lista completa', async () => {
    functionsInvoke.mockResolvedValue({ data: [PRESUPUESTO_API_COMPLETO], error: null });

    const presupuestos = await supabasePresupuestoRepository.list();

    expect(presupuestos).toEqual([
      { id: 'p1', pacienteId: 'pac1', obraSocialId: 'os1', monto: 15000, fechaEmision: '2026-01-15', archivo: undefined },
    ]);
  });

  it('descarta filas malformadas sin tumbar el listado (D6, triangulación)', async () => {
    functionsInvoke.mockResolvedValue({
      data: [PRESUPUESTO_API_COMPLETO, { id: 'p2', monto: null, fechaEmision: null }, { esto: 'no es un presupuesto' }],
      error: null,
    });

    const presupuestos = await supabasePresupuestoRepository.list();

    expect(presupuestos).toHaveLength(1);
    expect(presupuestos[0]?.id).toBe('p1');
  });

  it('data no es un array (respuesta inesperada) devuelve lista vacía en vez de reventar', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: null });

    const presupuestos = await supabasePresupuestoRepository.list();

    expect(presupuestos).toEqual([]);
  });

  it('un error de la Edge Function se traduce vía mapearErrorEdgeFunction (contexto listar/presupuesto)', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 401 }) } });

    await expect(supabasePresupuestoRepository.list()).rejects.toThrow('Tu sesión expiró. Volvé a iniciar sesión.');
  });
});

describe('supabasePresupuestoRepository.getById() (3.5 — los tres caminos, cada uno con nombre explícito)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 devuelve el Presupuesto mapeado, invocando GET /presupuestos/:id', async () => {
    functionsInvoke.mockResolvedValue({ data: PRESUPUESTO_API_COMPLETO, error: null });

    const presupuesto = await supabasePresupuestoRepository.getById('p1');

    expect(functionsInvoke).toHaveBeenCalledWith('presupuestos/p1', { method: 'GET' });
    expect(presupuesto).toEqual({
      id: 'p1',
      pacienteId: 'pac1',
      obraSocialId: 'os1',
      monto: 15000,
      fechaEmision: '2026-01-15',
      archivo: undefined,
    });
  });

  it('404 devuelve null y NO lanza — es contrato de la interfaz, no un detalle', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    const presupuesto = await supabasePresupuestoRepository.getById('inexistente');

    expect(presupuesto).toBeNull();
  });

  it('403 lanza con el mensaje de falta de permiso de lectura', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabasePresupuestoRepository.getById('p1')).rejects.toThrow('No tenés permiso para ver presupuestos.');
  });
});

const NUEVO_PRESUPUESTO = {
  pacienteId: 'pac1',
  obraSocialId: 'os1',
  monto: 15000,
  fechaEmision: '2026-01-15',
};

describe('supabasePresupuestoRepository.create() (3.6)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca POST /presupuestos una sola vez con el body de toCrearPresupuestoPayload, y mapea la respuesta 201', async () => {
    functionsInvoke.mockResolvedValue({ data: { ...PRESUPUESTO_API_COMPLETO, id: 'nuevo' }, error: null });

    const creado = await supabasePresupuestoRepository.create(NUEVO_PRESUPUESTO);

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('presupuestos', {
      method: 'POST',
      body: { pacienteId: 'pac1', obraSocialId: 'os1', monto: 15000, fechaEmision: '2026-01-15' },
    });
    expect(creado.id).toBe('nuevo');
  });

  it('archivo elegido en el input no viaja como archivoUrl en el body (D5, triangulación de 2.3 a nivel repository)', async () => {
    functionsInvoke.mockResolvedValue({ data: PRESUPUESTO_API_COMPLETO, error: null });

    await supabasePresupuestoRepository.create({ ...NUEVO_PRESUPUESTO, archivo: { nombre: 'x.pdf', cargadoEn: '2026-01-15' } });

    const [, opciones] = functionsInvoke.mock.calls[0] ?? [];
    const body = opciones && typeof opciones === 'object' && 'body' in opciones ? opciones.body : undefined;
    expect(body && typeof body === 'object' ? 'archivoUrl' in body : true).toBe(false);
  });

  it('403 lanza con el mensaje de falta de permiso de escritura', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabasePresupuestoRepository.create(NUEVO_PRESUPUESTO)).rejects.toThrow(
      'No tenés permiso para modificar presupuestos.',
    );
  });

  it('400 de campos faltantes se traduce al mensaje fijo, sin filtrar el texto crudo', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'faltan campos requeridos: monto' }), { status: 400 }) },
    });

    await expect(supabasePresupuestoRepository.create(NUEVO_PRESUPUESTO)).rejects.toThrow(
      'Faltan datos obligatorios del presupuesto.',
    );
  });

  it('400 de violación de FK (23503, caso D8 con selectores en mock) se traduce al mensaje de dominio', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: {
        context: new Response(
          JSON.stringify({ error: 'insert or update on table "presupuesto" violates foreign key constraint (23503)' }),
          { status: 400 },
        ),
      },
    });

    await expect(supabasePresupuestoRepository.create(NUEVO_PRESUPUESTO)).rejects.toThrow(
      'El paciente o la obra social del presupuesto ya no existen.',
    );
  });

  it('respuesta 201 con body malformado (parsePresupuestoApi -> null) lanza un mensaje explícito en vez de devolver un valor inválido (3.11, cobertura)', async () => {
    functionsInvoke.mockResolvedValue({ data: { esto: 'no tiene forma de Presupuesto' }, error: null });

    await expect(supabasePresupuestoRepository.create(NUEVO_PRESUPUESTO)).rejects.toThrow(
      'No se pudo guardar el presupuesto.',
    );
  });
});

describe('supabasePresupuestoRepository.createLote() (6.1/6.2 — presupuesto-prestaciones PR 2)', () => {
  beforeEach(() => vi.clearAllMocks());

  const LOTE = [
    { pacienteId: 'pac1', obraSocialId: 'os1', monto: 1000, fechaEmision: '2026-01-15', prestacionId: 'prest1' },
    { pacienteId: 'pac1', obraSocialId: 'os1', monto: 2000, fechaEmision: '2026-01-15', prestacionId: 'prest2' },
  ];

  it('invoca POST /presupuestos una sola vez con el arreglo de payloads (uno por prestación), y mapea la respuesta con parsePresupuestoApi', async () => {
    functionsInvoke.mockResolvedValue({
      data: [
        { ...PRESUPUESTO_API_COMPLETO, id: 'p1', monto: 1000, prestacionId: 'prest1' },
        { ...PRESUPUESTO_API_COMPLETO, id: 'p2', monto: 2000, prestacionId: 'prest2' },
      ],
      error: null,
    });

    const creados = await supabasePresupuestoRepository.createLote(LOTE);

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('presupuestos', {
      method: 'POST',
      body: [
        { pacienteId: 'pac1', obraSocialId: 'os1', monto: 1000, fechaEmision: '2026-01-15', prestacionId: 'prest1' },
        { pacienteId: 'pac1', obraSocialId: 'os1', monto: 2000, fechaEmision: '2026-01-15', prestacionId: 'prest2' },
      ],
    });
    expect(creados).toHaveLength(2);
    expect(creados.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(creados.map((p) => p.prestacionId)).toEqual(['prest1', 'prest2']);
  });

  it('un error del servidor (falla parcial del lote) rechaza con Error en castellano, sin texto técnico (mismo contrato que create())', async () => {
    functionsInvoke.mockResolvedValue({
      data: null,
      error: { context: new Response(JSON.stringify({ error: 'RAISE EXCEPTION algo técnico interno' }), { status: 400 }) },
    });

    await expect(supabasePresupuestoRepository.createLote(LOTE)).rejects.toThrow(
      'No se pudo guardar el presupuesto.',
    );
  });

  it('403 lanza con el mensaje de falta de permiso de escritura (mismo contrato de errores que create())', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabasePresupuestoRepository.createLote(LOTE)).rejects.toThrow(
      'No tenés permiso para modificar presupuestos.',
    );
  });

  it('respuesta con una fila malformada lanza en vez de devolver un lote parcial (nunca se "completa" en el cliente lo que el servidor no confirmó)', async () => {
    functionsInvoke.mockResolvedValue({
      data: [{ ...PRESUPUESTO_API_COMPLETO, id: 'p1' }, { esto: 'no tiene forma de Presupuesto' }],
      error: null,
    });

    await expect(supabasePresupuestoRepository.createLote(LOTE)).rejects.toThrow(
      'No se pudo guardar el presupuesto.',
    );
  });

  it('respuesta con menos filas que ítems enviados (servidor confirmó menos de lo pedido) lanza en vez de devolver un lote parcial', async () => {
    functionsInvoke.mockResolvedValue({
      data: [{ ...PRESUPUESTO_API_COMPLETO, id: 'p1' }],
      error: null,
    });

    await expect(supabasePresupuestoRepository.createLote(LOTE)).rejects.toThrow(
      'No se pudo guardar el presupuesto.',
    );
  });
});

describe('supabasePresupuestoRepository.update() (3.7 — OJO: asimetría con 3.5, acá el 404 SÍ lanza)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invoca PATCH /presupuestos/:id con el body de toActualizarPresupuestoPayload y mapea la respuesta 200', async () => {
    functionsInvoke.mockResolvedValue({ data: { ...PRESUPUESTO_API_COMPLETO, monto: 20000 }, error: null });

    const actualizado = await supabasePresupuestoRepository.update('p1', { monto: 20000 });

    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    expect(functionsInvoke).toHaveBeenCalledWith('presupuestos/p1', { method: 'PATCH', body: { monto: 20000 } });
    expect(actualizado.monto).toBe(20000);
  });

  it('sobre lo que el fake registró: las claves ausentes en la actualización nunca viajan en el body (D6b)', async () => {
    functionsInvoke.mockResolvedValue({ data: PRESUPUESTO_API_COMPLETO, error: null });

    await supabasePresupuestoRepository.update('p1', { monto: 20000 });

    const [, opciones] = functionsInvoke.mock.calls[0] ?? [];
    const body = opciones && typeof opciones === 'object' && 'body' in opciones ? opciones.body : undefined;
    const tieneClave = (clave: string) => (body && typeof body === 'object' ? clave in body : true);
    expect(tieneClave('fechaEmision')).toBe(false);
    expect(tieneClave('pacienteId')).toBe(false);
    expect(tieneClave('obraSocialId')).toBe(false);
  });

  it('404 en update() SÍ lanza (a diferencia de getById), con el mensaje idéntico al del mock', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 404 }) } });

    await expect(supabasePresupuestoRepository.update('inexistente', { monto: 1 })).rejects.toThrow(
      'No existe un presupuesto con id "inexistente".',
    );
  });

  it('403 lanza con el mensaje de falta de permiso de escritura', async () => {
    functionsInvoke.mockResolvedValue({ data: null, error: { context: new Response(null, { status: 403 }) } });

    await expect(supabasePresupuestoRepository.update('p1', { monto: 1 })).rejects.toThrow(
      'No tenés permiso para modificar presupuestos.',
    );
  });

  it('respuesta 200 con body malformado (parsePresupuestoApi -> null) lanza un mensaje explícito (3.11, cobertura)', async () => {
    functionsInvoke.mockResolvedValue({ data: { esto: 'no tiene forma de Presupuesto' }, error: null });

    await expect(supabasePresupuestoRepository.update('p1', { monto: 1 })).rejects.toThrow(
      'No se pudo guardar el presupuesto.',
    );
  });
});
