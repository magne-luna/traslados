// SupabaseHojaDeRutaRepository.ts: tests con fake tipado del subconjunto de supabase-js usado
// (tareas 3.1-3.4 del change integracion-hojas-de-ruta, design.md D1/D3/D4). Mismo patrón que
// SupabasePacienteRepository.test.ts: el módulo `../supabaseClient` se reemplaza con `vi.mock` por
// un fake que registra cada llamada emitida y resuelve según handlers configurados por test. Nunca
// se golpea la red real. Sin `any` ni `as`.
//
// Forma del embed (design.md D1, Checkpoint 1 opción A): un único select a
// `pacientes.hoja_de_ruta` con `recorrido` y `historial_recorridos` anidados; el repository aplana
// las colecciones y delega la traducción a `ensamblarHojaDeRuta` (mapeo puro).

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ensamblarHojaDeRuta } from './hojaDeRutaMapping';
import type { HojaDeRuta } from '../../types/hojaDeRuta';

// -------------------------------------------------------------------------------------------
// 3.1 — Fake tipado del subconjunto de supabase-js usado por el repository (select + rpc).
// -------------------------------------------------------------------------------------------

interface FakeError {
  code?: string;
  message: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

type FakeOp = 'select' | 'rpc';

interface RecordedCall {
  op: FakeOp;
  schema: string;
  table: string;
  eq: Array<[string, unknown]>;
  order?: { column: string; ascending: boolean };
  payload?: unknown;
}

type Handler = (call: RecordedCall) => FakeResult;

let calls: RecordedCall[] = [];
let handlers = new Map<string, Handler>();

function resetFake(): void {
  calls = [];
  handlers = new Map();
}

function ok(data: unknown): FakeResult {
  return { data, error: null };
}

function fail(error: FakeError): FakeResult {
  return { data: null, error };
}

function configurarSelect(schema: string, table: string, handler: Handler): void {
  handlers.set(`${schema}.${table}.select`, handler);
}

function configurarRpc(schema: string, fn: string, handler: Handler): void {
  handlers.set(`${schema}.rpc.${fn}`, handler);
}

function resolver(call: RecordedCall): FakeResult {
  const key = call.op === 'rpc' ? `${call.schema}.rpc.${call.table}` : `${call.schema}.${call.table}.${call.op}`;
  const handler = handlers.get(key);
  if (handler) return handler(call);
  return call.op === 'select' ? ok([]) : ok(null);
}

class FakeSelectBuilder implements PromiseLike<FakeResult> {
  private readonly call: RecordedCall;

  constructor(call: RecordedCall) {
    this.call = call;
  }

  eq(column: string, value: unknown): FakeSelectBuilder {
    this.call.eq.push([column, value]);
    return this;
  }

  order(column: string, options: { ascending: boolean }): FakeSelectBuilder {
    this.call.order = { column, ascending: options.ascending };
    return this;
  }

  maybeSingle(): Promise<FakeResult> {
    calls.push(this.call);
    const result = resolver(this.call);
    const data = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
    return Promise.resolve({ data, error: result.error });
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    calls.push(this.call);
    return Promise.resolve(resolver(this.call)).then(onfulfilled, onrejected);
  }
}

function crearFakeSupabase() {
  return {
    schema(schemaName: string) {
      return {
        from(table: string) {
          return {
            select(_columns: string) {
              return new FakeSelectBuilder({ op: 'select', schema: schemaName, table, eq: [] });
            },
          };
        },
        rpc(fn: string, args: unknown) {
          const call: RecordedCall = { op: 'rpc', schema: schemaName, table: fn, eq: [], payload: args };
          calls.push(call);
          return Promise.resolve(resolver(call));
        },
      };
    },
  };
}

vi.mock('../supabaseClient', () => ({ supabase: crearFakeSupabase() }));

const { supabaseHojaDeRutaRepository } = await import('./SupabaseHojaDeRutaRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// Fixtures con la forma del embed que devuelve PostgREST (un select con anidados).
// -------------------------------------------------------------------------------------------

function filaParadaEmbed(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'par-1',
    recorrido_id: 'rec-1',
    paciente_id: 'pac-1',
    id_vehiculo: 'veh-1',
    id_dir_inicial: 'dir-a',
    id_dir_final: 'dir-b',
    tramo: 'ida',
    orden: 0,
    hora_estimada: '08:30:00',
    ...overrides,
  };
}

function filaRecorridoEmbed(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'rec-1',
    hoja_de_ruta_id: 'hdr-1',
    vehiculo_id: 'veh-1',
    conductor_id: 'con-1',
    manual: false,
    notas: null,
    historial_recorridos: [filaParadaEmbed()],
    ...overrides,
  };
}

function filaHojaEmbed(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'hdr-1',
    fecha: '2026-08-04',
    franja_inicio: '08:00:00',
    franja_fin: '20:00:00',
    notas: null,
    recorrido: [filaRecorridoEmbed()],
    ...overrides,
  };
}

/** Hoja esperada según lo que el mapeo puro ensamblaría con las mismas filas planas. */
function hojaEsperada(filaHoja: Record<string, unknown>): HojaDeRuta {
  const recorridosRaw = filaHoja.recorrido;
  const recorridoRows = Array.isArray(recorridosRaw) ? recorridosRaw : [];
  const paradaRows = recorridoRows.flatMap((recorrido) => {
    const paradas = Array.isArray(recorrido.historial_recorridos) ? recorrido.historial_recorridos : [];
    return paradas;
  });
  return ensamblarHojaDeRuta(filaHoja, recorridoRows, paradaRows);
}

function consultasSelectHoja(schema = 'pacientes'): RecordedCall[] {
  return calls.filter((c) => c.op === 'select' && c.schema === schema && c.table === 'hoja_de_ruta');
}

// -------------------------------------------------------------------------------------------
// list() (3.2) — una sola consulta con embeds, nunca N+1.
// -------------------------------------------------------------------------------------------

describe('supabaseHojaDeRutaRepository.list (3.2)', () => {
  it('devuelve las hojas ensambladas desde una única consulta con embeds de tres niveles', async () => {
    const filaA = filaHojaEmbed({ id: 'hdr-1' });
    const filaB = filaHojaEmbed({
      id: 'hdr-2',
      fecha: '2026-08-05',
      recorrido: [
        filaRecorridoEmbed({ id: 'rec-b1' }),
        filaRecorridoEmbed({ id: 'rec-b2' }),
      ],
    });
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaA, filaB]));

    const resultado = await supabaseHojaDeRutaRepository.list();

    expect(resultado).toEqual([hojaEsperada(filaA), hojaEsperada(filaB)]);
    expect(consultasSelectHoja()).toHaveLength(1);
  });

  it('el embed de la consulta NO incluye una lectura extra por recorrido (anti N+1)', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaHojaEmbed()]));

    await supabaseHojaDeRutaRepository.list();

    const consultas = calls.filter((c) => c.op === 'select');
    expect(consultas).toHaveLength(1);
    expect(consultas[0]?.table).toBe('hoja_de_ruta');
  });

  it('une hoja sin recorridos a un arreglo vacío sin romper (robustez del embed ausente)', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaHojaEmbed({ recorrido: null })]));

    const [hoja] = await supabaseHojaDeRutaRepository.list();

    expect(hoja?.recorridos).toEqual([]);
  });

  it('más de una hoja: una consulta única y N hojas ensambladas, sin dependencia del orden físico', async () => {
    const filas = [filaHojaEmbed({ id: 'hdr-2' }), filaHojaEmbed({ id: 'hdr-1' })];
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok(filas));

    const resultado = await supabaseHojaDeRutaRepository.list();

    expect(resultado.map((h) => h.id)).toEqual(['hdr-2', 'hdr-1']);
    expect(consultasSelectHoja()).toHaveLength(1);
  });

  it('el repository nunca consulta la tabla de permisos (delega a RLS)', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaHojaEmbed()]));
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () => ok('hdr-9'));

    await supabaseHojaDeRutaRepository.list();

    expect(calls.every((c) => c.schema !== 'modulos' && c.table !== 'permisos')).toBe(true);
  });

  it('un select fallido lanza un mensaje en castellano (sin texto crudo del motor)', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => fail({ code: 'PGRST204', message: 'Could not find the table' }));

    await expect(supabaseHojaDeRutaRepository.list()).rejects.toThrow(
      'El módulo de Hojas de Ruta no está disponible en el servidor todavía.',
    );
  });

  it('42501 en lectura: mensaje de permiso de consulta', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => fail({ code: '42501', message: 'permission denied' }));

    await expect(supabaseHojaDeRutaRepository.list()).rejects.toThrow(
      'No tenés permiso para consultar hojas de ruta.',
    );
  });

  it('un código desconocido degrada al mensaje genérico de carga y guarda el mensaje propio', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () =>
      fail({ code: 'XX999', message: 'unexpected pipeline message' }),
    );

    await expect(supabaseHojaDeRutaRepository.list()).rejects.toThrow('No se pudo cargar la hoja de ruta.');
  });
});

// -------------------------------------------------------------------------------------------
// getById() (3.2) — maybeSingle con embed; null cuando RLS oculta o no existe.
// -------------------------------------------------------------------------------------------

describe('supabaseHojaDeRutaRepository.getById (3.2)', () => {
  it('ensambla una hoja con dos recorridos y paradas de ida y vuelta desde un único select', async () => {
    const fila = filaHojaEmbed({
      recorrido: [
        filaRecorridoEmbed({
          id: 'rec-1',
          historial_recorridos: [
            filaParadaEmbed({ id: 'par-b', tramo: 'vuelta', orden: 1 }),
            filaParadaEmbed({ id: 'par-a', tramo: 'ida', orden: 0 }),
          ],
        }),
        filaRecorridoEmbed({
          id: 'rec-2',
          historial_recorridos: [filaParadaEmbed({ id: 'par-2', recorrido_id: 'rec-2' })],
        }),
      ],
    });
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([fila]));

    const hoja = await supabaseHojaDeRutaRepository.getById('hdr-1');

    expect(consultasSelectHoja()).toHaveLength(1);
    expect(consultasSelectHoja()[0]?.eq).toEqual([['id', 'hdr-1']]);
    expect(hoja?.id).toBe('hdr-1');
    expect(hoja?.recorridos.map((r) => r.id)).toEqual(['rec-1', 'rec-2']);
    expect(hoja?.recorridos[0]?.paradas.map((p) => p.tramo)).toEqual(['ida', 'vuelta']);
    expect(hoja?.recorridos[0]?.paradas.map((p) => p.orden)).toEqual([0, 1]);
    // TIME de Postgres normalizado a HH:mm del dominio.
    expect(hoja?.franjaInicio).toBe('08:00');
    expect(hoja?.franjaFin).toBe('20:00');
  });

  it('sin fila (no existe o RLS la oculta) resuelve null y no lanza — semántica fijada por la interfaz', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([]));

    await expect(supabaseHojaDeRutaRepository.getById('id-inexistente')).resolves.toBeNull();

    expect(consultasSelectHoja()[0]?.eq).toEqual([['id', 'id-inexistente']]);
  });

  it('un error de lectura se traduce y se lanza', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => fail({ code: 'PGRST106', message: 'schema not exposed' }));

    await expect(supabaseHojaDeRutaRepository.getById('hdr-1')).rejects.toThrow(
      'No se pudo cargar la hoja de ruta.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// getByFecha() (3.2 / 3.4) — maybeSingle con eq fecha; null sin hoja para la fecha (nunca lanza).
// -------------------------------------------------------------------------------------------

describe('supabaseHojaDeRutaRepository.getByFecha (3.2 / 3.4)', () => {
  it('devuelve la hoja de la fecha consultada con un único select', async () => {
    const fila = filaHojaEmbed();
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([fila]));

    const hoja = await supabaseHojaDeRutaRepository.getByFecha('2026-08-04');

    expect(consultasSelectHoja()).toHaveLength(1);
    expect(consultasSelectHoja()[0]?.eq).toEqual([['fecha', '2026-08-04']]);
    expect(hoja).toEqual(hojaEsperada(fila));
  });

  it('3.4: sin hoja para esa fecha resuelve null y NO lanza', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([]));

    await expect(supabaseHojaDeRutaRepository.getByFecha('2030-01-01')).resolves.toBeNull();

    expect(consultasSelectHoja()[0]?.eq).toEqual([['fecha', '2030-01-01']]);
  });

  it('un error de lectura se traduce y se lanza, conservando la semántica de null para "sin hoja"', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () => fail({ code: 'PGRST204', message: 'table not found' }));

    await expect(supabaseHojaDeRutaRepository.getByFecha('2026-08-04')).rejects.toThrow(
      'El módulo de Hojas de Ruta no está disponible en el servidor todavía.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// create() (3.2) — una única llamada RPC, sin inserciones directas ni borrados, relee con getById.
// -------------------------------------------------------------------------------------------

describe('supabaseHojaDeRutaRepository.create (3.2)', () => {
  function buildNueva(): Parameters<typeof supabaseHojaDeRutaRepository.create>[0] {
    return {
      fecha: '2026-08-04',
      franjaInicio: '08:00',
      franjaFin: '20:00',
      notas: 'Nota de la hoja',
      recorridos: [
        {
          vehiculoId: 'veh-1',
          conductorId: 'con-1',
          manual: false,
          paradas: [
            {
              pacienteId: 'pac-1',
              tramo: 'ida',
              direccionOrigenId: 'dir-a',
              direccionDestinoId: 'dir-b',
              orden: 0,
              horaEstimada: '08:30',
            },
          ],
        },
      ],
    };
  }

  it('emite EXACTAMENTE una llamada rpc(crear_hoja_de_ruta_completa) y relee con getById', async () => {
    const filaNueva = filaHojaEmbed({ id: 'hdr-nueva', notas: 'Nota de la hoja' });
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () => ok('hdr-nueva'));
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaNueva]));

    const resultado = await supabaseHojaDeRutaRepository.create(buildNueva());

    const rpcs = calls.filter((c) => c.op === 'rpc');
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]?.table).toBe('crear_hoja_de_ruta_completa');

    const pHoja = (rpcs[0]?.payload as { p_hoja: Record<string, unknown> }).p_hoja;
    expect(pHoja.fecha).toBe('2026-08-04');
    expect(pHoja.recorridos).toHaveLength(1);

    // El alta mira lo que quedó realmente en la base (relectura con el id devuelto por la RPC).
    const seleccion = consultasSelectHoja();
    expect(seleccion).toHaveLength(1);
    expect(seleccion[0]?.eq).toEqual([['id', 'hdr-nueva']]);

    expect(resultado).toEqual(hojaEsperada(filaNueva));
  });

  it('NO se emiten inserciones directas por tabla ni borrados compensatorios (D3)', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () => ok('hdr-1'));
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaHojaEmbed()]));

    await supabaseHojaDeRutaRepository.create(buildNueva());

    expect(calls.every((c) => c.op === 'rpc' || c.op === 'select')).toBe(true);
  });

  it('payload del alta sincroniza id_vehiculo de cada parada con vehiculo_id del recorrido (D3)', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () => ok('hdr-1'));
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaHojaEmbed()]));

    await supabaseHojaDeRutaRepository.create(buildNueva());

    const rpc = calls.find((c) => c.op === 'rpc');
    const payload = (rpc?.payload as { p_hoja: { recorridos: Array<{ vehiculo_id: string; paradas: Array<{ id_vehiculo: string }> }> } }).p_hoja;
    expect(payload.recorridos[0]?.vehiculo_id).toBe('veh-1');
    expect(payload.recorridos[0]?.paradas[0]?.id_vehiculo).toBe('veh-1');
  });

  it('si la RPC no devuelve un id string, falla con mensaje genérico en castellano', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () => ok(null));

    await expect(supabaseHojaDeRutaRepository.create(buildNueva())).rejects.toThrow(
      'No se pudo guardar la hoja de ruta.',
    );
  });

  it('si la RPC devuelve un id pero la relectura no encuentra la hoja, falla con mensaje accionable', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () => ok('hdr-1'));
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([]));

    await expect(supabaseHojaDeRutaRepository.create(buildNueva())).rejects.toThrow(
      'No se pudo recuperar la hoja de ruta recién creada.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// update() (3.2) — una única llamada RPC; clave ausente en p_cambios = "no tocar" (D3/scenario).
// -------------------------------------------------------------------------------------------

describe('supabaseHojaDeRutaRepository.update (3.2)', () => {
  it('emite exactamente una rpc(actualizar_hoja_de_ruta_completa) y relee con getById', async () => {
    const filaActualizada = filaHojaEmbed({ notas: 'Solo cambia la nota' });
    configurarRpc('pacientes', 'actualizar_hoja_de_ruta_completa', () => ok('hdr-1'));
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaActualizada]));

    const resultado = await supabaseHojaDeRutaRepository.update('hdr-1', { notas: 'Solo cambia la nota' });

    const rpcs = calls.filter((c) => c.op === 'rpc');
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]?.table).toBe('actualizar_hoja_de_ruta_completa');

    const rpc = rpcs[0]?.payload as { p_id: string; p_cambios: Record<string, unknown> };
    expect(rpc.p_id).toBe('hdr-1');
    expect(rpc.p_cambios).toEqual({ notas: 'Solo cambia la nota' });
    expect(rpc.p_cambios).not.toHaveProperty('recorridos');

    expect(consultasSelectHoja()[0]?.eq).toEqual([['id', 'hdr-1']]);
    expect(resultado).toEqual(hojaEsperada(filaActualizada));
  });

  it('escenario: clave ausente (sin recorridos) NO toca la colección — el payload no la incluye', async () => {
    configurarRpc('pacientes', 'actualizar_hoja_de_ruta_completa', () => ok('hdr-1'));
    configurarSelect('pacientes', 'hoja_de_ruta', () => ok([filaHojaEmbed()]));

    await supabaseHojaDeRutaRepository.update('hdr-1', { franjaFin: '21:00' });

    const rpc = calls.find((c) => c.op === 'rpc');
    const pCambios = (rpc?.payload as { p_cambios: Record<string, unknown> }).p_cambios;
    expect(pCambios).toEqual({ franja_fin: '21:00' });
    expect(pCambios).not.toHaveProperty('recorridos');
  });
});

// -------------------------------------------------------------------------------------------
// 3.3 — Traducción de códigos propios (45301-45304) y genéricos (PGRST204/PGRST202/42501):
// un test dedicado por código, siempre mensaje en castellano, sin texto crudo ni nombres de tabla.
// -------------------------------------------------------------------------------------------

describe('mapeo de errores a mensajes en castellano (3.3)', () => {
  function nueva(): Parameters<typeof supabaseHojaDeRutaRepository.create>[0] {
    return {
      fecha: '2026-08-04',
      franjaInicio: '08:00',
      franjaFin: '20:00',
      recorridos: [
        {
          vehiculoId: 'veh-1',
          conductorId: 'con-1',
          manual: false,
          paradas: [{ pacienteId: 'pac-1', tramo: 'ida', direccionOrigenId: 'dir-a', direccionDestinoId: 'dir-b', orden: 0 }],
        },
      ],
    };
  }

  it('45301 (p_hoja no es JSON) -> "No se pudo guardar la hoja de ruta."', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () =>
      fail({ code: '45301', message: 'argument p_hoja must be an object' }),
    );

    await expect(supabaseHojaDeRutaRepository.create(nueva())).rejects.toThrow(
      'No se pudo guardar la hoja de ruta.',
    );
  });

  it('45302 (id inexistente u oculto por RLS en actualizar) -> mensaje idéntico al del mock', async () => {
    configurarRpc('pacientes', 'actualizar_hoja_de_ruta_completa', () =>
      fail({ code: '45302', message: 'hoja de ruta no encontrada' }),
    );

    await expect(supabaseHojaDeRutaRepository.update('hdr-1', { notas: 'x' })).rejects.toThrow(
      'No existe una hoja de ruta con id "hdr-1".',
    );
  });

  it('45303 (fecha duplicada en crear) -> "Ya existe una hoja de ruta para esa fecha."', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () =>
      fail({ code: '45303', message: 'duplicate key value violates unique constraint' }),
    );

    await expect(supabaseHojaDeRutaRepository.create(nueva())).rejects.toThrow(
      'Ya existe una hoja de ruta para esa fecha.',
    );
  });

  it('45304 (recorrido sin vehículo/conductor resoluble) -> "Revisá el vehículo y el conductor del recorrido."', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () =>
      fail({ code: '45304', message: 'vehiculo_id no existe' }),
    );

    await expect(supabaseHojaDeRutaRepository.create(nueva())).rejects.toThrow(
      'Revisá el vehículo y el conductor del recorrido.',
    );
  });

  it('PGRST204 (columna/tabla no disponible) -> mensaje propio en castellano', async () => {
    configurarSelect('pacientes', 'hoja_de_ruta', () =>
      fail({ code: 'PGRST204', message: 'Could not find the table pacientes.hoja_de_ruta' }),
    );

    await expect(supabaseHojaDeRutaRepository.getById('hdr-1')).rejects.toThrow(
      'El módulo de Hojas de Ruta no está disponible en el servidor todavía.',
    );
  });

  it('PGRST202 (RPC no aplicada) -> mensaje propio en castellano, sin el código ni el nombre de la función', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () =>
      fail({ code: 'PGRST202', message: 'Could not find the function pacientes.crear_hoja_de_ruta_completa' }),
    );

    await expect(supabaseHojaDeRutaRepository.create(nueva())).rejects.toThrow(
      'El guardado de hojas de ruta no está habilitado en el servidor todavía.',
    );
  });

  it('42501 (falta de permiso) en escritura -> mensaje de permisos de modificación', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () =>
      fail({ code: '42501', message: 'permission denied for table' }),
    );

    await expect(supabaseHojaDeRutaRepository.create(nueva())).rejects.toThrow(
      'No tenés permiso para modificar hojas de ruta.',
    );
  });

  it('ningún mensaje traducido propaga el código crudo ni el nombre de tabla (grep sobre un caso)', async () => {
    configurarRpc('pacientes', 'crear_hoja_de_ruta_completa', () =>
      fail({ code: '45303', message: 'duplicate key value violates unique constraint "hoja_de_ruta_fecha_key"' }),
    );

    const error = await supabaseHojaDeRutaRepository
      .create(nueva())
      .then(() => null)
      .catch((e: unknown) => e);

    expect((error as Error).message).toBe('Ya existe una hoja de ruta para esa fecha.');
    expect((error as Error).message).not.toContain('45303');
    expect((error as Error).message).not.toContain('hoja_de_ruta_fecha_key');
  });
});