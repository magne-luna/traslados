// SupabaseConductorRepository.ts: tests con fake tipado del subconjunto de supabase-js usado
// (tasks.md 7.1-7.7 del change integracion-conductores-vehiculos, design.md D9/D11/D12). Mismo
// patrón que SupabaseHojaDeRutaRepository.test.ts: el módulo `../supabaseClient` se reemplaza con
// `vi.mock` por un fake que registra cada llamada emitida y resuelve según handlers configurados
// por test. Nunca se golpea la red real. Sin `any` ni `as`.
//
// Forma del embed (design.md D11): un único select a `conductores.conductores` con
// `conductores_vehiculos` anidado — el repository delega toda la traducción a
// `ensamblarConductor` (mapeo puro, §6).

import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { ActualizacionConductor, Conductor, NuevoConductor } from '../../types/conductor';
// Import Vite `?raw` (declarado en vite/client.d.ts) — 7.7, test de código fuente.
import supabaseConductorRepositorySource from './SupabaseConductorRepository.ts?raw';

// -------------------------------------------------------------------------------------------
// 7.1 — Fake tipado del subconjunto de supabase-js usado por el repository (select + rpc).
// -------------------------------------------------------------------------------------------

interface FakeError {
  code?: string;
  message: string;
  details?: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
  /** paginacion-listados (tasks.md 16.2): eco de `{ count: 'exact' }` de PostgREST. */
  count?: number | null;
}

type FakeOp = 'select' | 'rpc';

interface RecordedCall {
  op: FakeOp;
  schema: string;
  table: string;
  eq: Array<[string, unknown]>;
  /** paginacion-listados (tasks.md 16.2): un elemento por cada `.order()` encadenado, en orden. */
  orders?: Array<{ column: string; ascending: boolean }>;
  /** paginacion-listados (tasks.md 16.2): un elemento por cada `.or(...)` encadenado (N tokens ⇒
   * N llamadas ⇒ AND de N ORs, ver construirFiltroBusqueda). */
  orFilters?: string[];
  /** paginacion-listados (tasks.md 16.2): `.range(desde, hasta)`. */
  range?: { desde: number; hasta: number };
  /** paginacion-listados (tasks.md 16.2): eco de `{ count: 'exact' }` pasado a `.select()`. */
  count?: 'exact' | 'planned' | 'estimated';
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

// paginacion-listados (tasks.md 16.2): variante de `ok` que además hace eco del `count` exacto
// que PostgREST devuelve junto a `data` cuando se pide `{ count: 'exact' }`.
function okConCount(data: unknown, count: number | null): FakeResult {
  return { data, error: null, count };
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

  select(_columns: string, options?: { count?: 'exact' | 'planned' | 'estimated' }): FakeSelectBuilder {
    if (options?.count) this.call.count = options.count;
    return this;
  }

  eq(column: string, value: unknown): FakeSelectBuilder {
    this.call.eq.push([column, value]);
    return this;
  }

  order(column: string, options: { ascending: boolean }): FakeSelectBuilder {
    this.call.orders = [...(this.call.orders ?? []), { column, ascending: options.ascending }];
    return this;
  }

  or(expression: string): FakeSelectBuilder {
    this.call.orFilters = [...(this.call.orFilters ?? []), expression];
    return this;
  }

  range(desde: number, hasta: number): FakeSelectBuilder {
    this.call.range = { desde, hasta };
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
            select(columns: string, options?: { count?: 'exact' | 'planned' | 'estimated' }) {
              return new FakeSelectBuilder({ op: 'select', schema: schemaName, table, eq: [] }).select(columns, options);
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

const { supabaseConductorRepository } = await import('./SupabaseConductorRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// Fixtures con la forma del embed que devuelve PostgREST.
// -------------------------------------------------------------------------------------------

function filaAsignacionEmbed(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'asig-1',
    vehiculo_id: 'v-1',
    fecha_init: '2026-07-20',
    fecha_fin_semana: '2026-07-26',
    ...overrides,
  };
}

function filaConductorEmbed(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'c-1',
    nombre: 'Marta',
    apellido: 'Pérez',
    dni: '30111222',
    cuil: '27-30111222-4',
    telefono: '11-2222-3333',
    fecha_nacimiento: '1990-01-01',
    domicilio: 'Av. Siempre Viva 742',
    estado: 'operando',
    notas: null,
    conductores_vehiculos: [filaAsignacionEmbed()],
    ...overrides,
  };
}

function conductorEsperado(fila: Record<string, unknown>): Conductor {
  return {
    id: 'c-1',
    nombre: 'Marta',
    apellido: 'Pérez',
    documento: '30111222',
    cuil: '27-30111222-4',
    telefono: '11-2222-3333',
    fechaNacimiento: '1990-01-01',
    domicilio: 'Av. Siempre Viva 742',
    estado: 'operando',
    observaciones: undefined,
    asignaciones: [{ id: 'asig-1', vehiculoId: 'v-1', semana: '2026-W30' }],
    ...fila,
  } as unknown as Conductor;
}

const nuevoConductor: NuevoConductor = {
  apellido: 'González',
  nombre: 'Marcos',
  documento: '20333444',
  domicilio: 'Belgrano 100',
  cuil: '20-20333444-5',
  estado: 'operando',
  asignaciones: [],
};

// -------------------------------------------------------------------------------------------
// 7.2 — list() / getById()
// -------------------------------------------------------------------------------------------

describe('list()', () => {
  it('mapea las filas del embed a Conductor[] con sus asignaciones', async () => {
    configurarSelect('conductores', 'conductores', () => ok([filaConductorEmbed()]));

    const conductores = await supabaseConductorRepository.list();

    expect(conductores).toEqual([conductorEsperado({})]);
  });

  it('lista vacía -> []', async () => {
    configurarSelect('conductores', 'conductores', () => ok([]));
    expect(await supabaseConductorRepository.list()).toEqual([]);
  });

  it('fila de conductor inválida se descarta sin romper el list() entero', async () => {
    configurarSelect('conductores', 'conductores', () => ok([{ nombre: 'Sin id ni dni' }, filaConductorEmbed()]));
    const conductores = await supabaseConductorRepository.list();
    expect(conductores).toHaveLength(1);
  });
});

describe('getById()', () => {
  it('id existente -> Conductor con sus asignaciones', async () => {
    configurarSelect('conductores', 'conductores', () => ok([filaConductorEmbed()]));
    const conductor = await supabaseConductorRepository.getById('c-1');
    expect(conductor).toEqual(conductorEsperado({}));
  });

  it('id inexistente -> null, no lanza (contrato de la interfaz)', async () => {
    configurarSelect('conductores', 'conductores', () => ok(null));
    await expect(supabaseConductorRepository.getById('no-existe')).resolves.toBeNull();
  });
});

// -------------------------------------------------------------------------------------------
// paginacion-listados, Fase 3 (tasks.md 16.2) — mismos casos que
// SupabasePacienteRepository.test.ts 12.x, sin la segunda consulta de cobertura (no aplica acá).
// -------------------------------------------------------------------------------------------

describe('listPage()', () => {
  it('emite .range(0, 19) y pide { count: "exact" }', async () => {
    configurarSelect('conductores', 'conductores', () => okConCount([filaConductorEmbed()], 1));

    await supabaseConductorRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    const llamada = calls.find((c) => c.op === 'select');
    expect(llamada?.range).toEqual({ desde: 0, hasta: 19 });
    expect(llamada?.count).toBe('exact');
  });

  it('encadena .order(apellido), .order(nombre) y .order(id) como desempate', async () => {
    configurarSelect('conductores', 'conductores', () => okConCount([filaConductorEmbed()], 1));

    await supabaseConductorRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    const llamada = calls.find((c) => c.op === 'select');
    expect(llamada?.orders).toEqual([
      { column: 'apellido', ascending: true },
      { column: 'nombre', ascending: true },
      { column: 'id', ascending: true },
    ]);
  });

  it('páginas sin solapamiento: dos páginas consecutivas no comparten ids y su unión reconstruye el total', async () => {
    const filaA = filaConductorEmbed({ id: 'c-a' });
    const filaB = filaConductorEmbed({ id: 'c-b', dni: '11111111' });

    configurarSelect('conductores', 'conductores', (call) => {
      if (call.range?.desde === 0) return okConCount([filaA], 2);
      return okConCount([filaB], 2);
    });

    const p1 = await supabaseConductorRepository.listPage({ pagina: 1, tamanio: 1, filtros: { busqueda: '' } });
    const p2 = await supabaseConductorRepository.listPage({ pagina: 2, tamanio: 1, filtros: { busqueda: '' } });

    const idsP1 = p1.items.map((c) => c.id);
    const idsP2 = p2.items.map((c) => c.id);
    expect(idsP1.filter((id) => idsP2.includes(id))).toEqual([]);
    expect(new Set([...idsP1, ...idsP2]).size).toBe(2);
  });

  it('el count devuelto se propaga a Pagina.total; count null -> total 0', async () => {
    configurarSelect('conductores', 'conductores', () => okConCount([filaConductorEmbed()], 7));
    const pagina = await supabaseConductorRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    expect(pagina.total).toBe(7);

    configurarSelect('conductores', 'conductores', () => okConCount([], null));
    const paginaSinCount = await supabaseConductorRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    expect(paginaSinCount.total).toBe(0);
  });

  it('traduce construirFiltroBusqueda a .or(...) sobre apellido, nombre, dni y cuil', async () => {
    configurarSelect('conductores', 'conductores', () => okConCount([filaConductorEmbed()], 1));

    await supabaseConductorRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: 'perez' } });

    const llamada = calls.find((c) => c.op === 'select');
    expect(llamada?.orFilters).toHaveLength(1);
    expect(llamada?.orFilters?.[0]).toContain('apellido.ilike');
    expect(llamada?.orFilters?.[0]).toContain('nombre.ilike');
    expect(llamada?.orFilters?.[0]).toContain('dni.ilike');
    expect(llamada?.orFilters?.[0]).toContain('cuil.ilike');
  });

  it('sin término de búsqueda no emite ningún .or()', async () => {
    configurarSelect('conductores', 'conductores', () => okConCount([filaConductorEmbed()], 1));
    await supabaseConductorRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    const llamada = calls.find((c) => c.op === 'select');
    expect(llamada?.orFilters).toBeUndefined();
  });

  it('un error de PostgREST se traduce con mapearErrorConductor(operacion: "listar")', async () => {
    configurarSelect('conductores', 'conductores', () => fail({ code: '42501', message: 'rls' }));
    await expect(
      supabaseConductorRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } }),
    ).rejects.toThrow('No tenés permiso para consultar conductores.');
  });
});

// -------------------------------------------------------------------------------------------
// 7.3 — Degradación cross-módulo (D10): sin `vehiculos: read`, el embed vuelve vacío en silencio
// (RLS filtra filas, no lanza error) y la lectura del conductor no falla.
// -------------------------------------------------------------------------------------------

describe('degradación cross-módulo (D10, sin vehiculos: read)', () => {
  it('embed conductores_vehiculos vacío -> asignaciones: [], la lectura no falla', async () => {
    const filaSinAsignaciones = filaConductorEmbed({ conductores_vehiculos: [] });
    configurarSelect('conductores', 'conductores', () => ok([filaSinAsignaciones]));

    const conductores = await supabaseConductorRepository.list();

    expect(conductores).toHaveLength(1);
    expect(conductores[0]?.asignaciones).toEqual([]);
  });

  it('embed conductores_vehiculos ausente (RLS lo ocultó del todo) -> asignaciones: [], getById no lanza', async () => {
    const { conductores_vehiculos: _omitido, ...filaSinEmbed } = filaConductorEmbed();
    configurarSelect('conductores', 'conductores', () => ok([filaSinEmbed]));

    const conductor = await supabaseConductorRepository.getById('c-1');

    expect(conductor).not.toBeNull();
    expect(conductor?.asignaciones).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------
// 7.4 — create() / update() vía .rpc(): una sola llamada, relectura posterior.
// -------------------------------------------------------------------------------------------

describe('create()', () => {
  it('emite una sola .rpc() y ningún insert directo, y relee lo que quedó en la base', async () => {
    configurarRpc('conductores', 'crear_conductor_completo', () => ok('c-nuevo'));
    configurarSelect('conductores', 'conductores', () => ok([filaConductorEmbed({ id: 'c-nuevo' })]));

    const creado = await supabaseConductorRepository.create(nuevoConductor);

    const llamadasRpc = calls.filter((c) => c.op === 'rpc');
    expect(llamadasRpc).toHaveLength(1);
    expect(llamadasRpc[0]?.table).toBe('crear_conductor_completo');
    expect(creado.id).toBe('c-nuevo');
  });

  it('el payload del RPC es el de toCrearConductorPayload (p_conductor)', async () => {
    configurarRpc('conductores', 'crear_conductor_completo', () => ok('c-nuevo'));
    configurarSelect('conductores', 'conductores', () => ok([filaConductorEmbed({ id: 'c-nuevo' })]));

    await supabaseConductorRepository.create(nuevoConductor);

    const llamadaRpc = calls.find((c) => c.op === 'rpc');
    const payload = llamadaRpc?.payload as { p_conductor: Record<string, unknown> };
    expect(payload.p_conductor.dni).toBe('20333444');
    expect(payload.p_conductor.asignaciones).toEqual([]);
  });
});

describe('update()', () => {
  it('emite una sola .rpc() con p_id/p_cambios y relee lo que quedó en la base', async () => {
    configurarRpc('conductores', 'actualizar_conductor_completo', () => ok('c-1'));
    configurarSelect('conductores', 'conductores', () => ok([filaConductorEmbed({ telefono: '11-9999-0000' })]));

    const cambios: ActualizacionConductor = { telefono: '11-9999-0000' };
    const actualizado = await supabaseConductorRepository.update('c-1', cambios);

    const llamadasRpc = calls.filter((c) => c.op === 'rpc');
    expect(llamadasRpc).toHaveLength(1);
    expect(llamadasRpc[0]?.payload).toEqual({ p_id: 'c-1', p_cambios: { telefono: '11-9999-0000' } });
    expect(actualizado.telefono).toBe('11-9999-0000');
  });
});

// -------------------------------------------------------------------------------------------
// 7.4b — Colisión rechazada por la base: los dos `23505` de `conductores_vehiculos`,
// discriminados por el nombre del constraint.
// -------------------------------------------------------------------------------------------

describe('colisión de asignación semanal (D7 §Colisión, D12)', () => {
  it('uq_conductor_semana -> "Ese conductor ya tiene OTRO vehículo asignado en esa semana."', async () => {
    configurarRpc('conductores', 'actualizar_conductor_completo', () =>
      fail({
        code: '23505',
        message: 'duplicate key value violates unique constraint "uq_conductor_semana"',
        details: 'Key (conductor_id, fecha_init)=(c-1, 2026-07-20) already exists.',
      }),
    );

    await expect(supabaseConductorRepository.update('c-1', { asignaciones: [] })).rejects.toThrow(
      'Ese conductor ya tiene otro vehículo asignado en esa semana.',
    );
  });

  it('conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key -> "Ese conductor ya tiene ESE vehículo asignado en esa semana."', async () => {
    configurarRpc('conductores', 'actualizar_conductor_completo', () =>
      fail({
        code: '23505',
        message:
          'duplicate key value violates unique constraint "conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key"',
      }),
    );

    await expect(supabaseConductorRepository.update('c-1', { asignaciones: [] })).rejects.toThrow(
      'Ese conductor ya tiene ese vehículo asignado en esa semana.',
    );
  });

  it('nombre de constraint no reconocido -> fallback genérico, nunca error.message crudo', async () => {
    configurarRpc('conductores', 'actualizar_conductor_completo', () =>
      fail({ code: '23505', message: 'duplicate key value violates unique constraint "otro_constraint_desconocido"' }),
    );

    await expect(supabaseConductorRepository.update('c-1', { asignaciones: [] })).rejects.toThrow(
      'Ya existe una asignación así para ese conductor.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 7.5 — RN-GL-03: el alta de un conductor NO crea ninguna fila en auth.users ni en usuarios.
// -------------------------------------------------------------------------------------------

describe('RN-GL-03 — el alta de un conductor no crea ninguna cuenta de acceso', () => {
  it('create() nunca toca el schema auth ni la tabla usuarios', async () => {
    configurarRpc('conductores', 'crear_conductor_completo', () => ok('c-nuevo'));
    configurarSelect('conductores', 'conductores', () => ok([filaConductorEmbed({ id: 'c-nuevo' })]));

    await supabaseConductorRepository.create(nuevoConductor);

    expect(calls.some((c) => c.schema === 'auth')).toBe(false);
    expect(calls.some((c) => c.table === 'usuarios')).toBe(false);
  });
});

// -------------------------------------------------------------------------------------------
// 7.6 — mapearErrorConductor: tabla completa de D12.
// -------------------------------------------------------------------------------------------

describe('mapearErrorConductor (D12)', () => {
  it('23505 sobre dni -> "Ya existe un conductor con el documento «…»."', async () => {
    configurarRpc('conductores', 'crear_conductor_completo', () =>
      fail({ code: '23505', message: 'duplicate key value violates unique constraint "conductores_dni_key"' }),
    );
    await expect(supabaseConductorRepository.create(nuevoConductor)).rejects.toThrow(
      'Ya existe un conductor con el documento «20333444».',
    );
  });

  it('23503 (FK) al asignar un vehículo inexistente -> "El vehículo seleccionado ya no existe."', async () => {
    configurarRpc('conductores', 'actualizar_conductor_completo', () => fail({ code: '23503', message: 'foreign key violation' }));
    await expect(supabaseConductorRepository.update('c-1', { asignaciones: [] })).rejects.toThrow(
      'El vehículo seleccionado ya no existe.',
    );
  });

  it('42501 sobre conductores -> "No tenés permiso para modificar conductores."', async () => {
    configurarRpc('conductores', 'actualizar_conductor_completo', () =>
      fail({ code: '42501', message: 'new row violates row-level security policy for table "conductores"' }),
    );
    await expect(supabaseConductorRepository.update('c-1', { nombre: 'x' })).rejects.toThrow(
      'No tenés permiso para modificar conductores.',
    );
  });

  it('42501 sobre conductores_vehiculos (vehiculos: write) -> "No tenés permiso para modificar asignaciones de vehículos."', async () => {
    configurarRpc('conductores', 'actualizar_conductor_completo', () =>
      fail({ code: '42501', message: 'new row violates row-level security policy for table "conductores_vehiculos"' }),
    );
    await expect(supabaseConductorRepository.update('c-1', { asignaciones: [] })).rejects.toThrow(
      'No tenés permiso para modificar asignaciones de vehículos.',
    );
  });

  it('42501 en list() -> "No tenés permiso para consultar conductores."', async () => {
    configurarSelect('conductores', 'conductores', () => fail({ code: '42501', message: 'rls' }));
    await expect(supabaseConductorRepository.list()).rejects.toThrow('No tenés permiso para consultar conductores.');
  });

  it('45201 (payload malformado) -> mensaje genérico de guardado', async () => {
    configurarRpc('conductores', 'crear_conductor_completo', () => fail({ code: '45201', message: 'x' }));
    await expect(supabaseConductorRepository.create(nuevoConductor)).rejects.toThrow('No se pudo guardar el conductor.');
  });

  it('45202 (id inexistente en update) -> "No existe un conductor con id «id»."', async () => {
    configurarRpc('conductores', 'actualizar_conductor_completo', () => fail({ code: '45202', message: 'x' }));
    await expect(supabaseConductorRepository.update('c-999', { nombre: 'x' })).rejects.toThrow(
      'No existe un conductor con id "c-999".',
    );
  });

  it('PGRST202 (RPC inexistente) -> "El guardado de conductores no está habilitado en el servidor todavía."', async () => {
    configurarRpc('conductores', 'crear_conductor_completo', () => fail({ code: 'PGRST202', message: 'x' }));
    await expect(supabaseConductorRepository.create(nuevoConductor)).rejects.toThrow(
      'El guardado de conductores no está habilitado en el servidor todavía.',
    );
  });

  it('PGRST204 (columna inexistente) -> mensaje de módulo no habilitado', async () => {
    configurarSelect('conductores', 'conductores', () => fail({ code: 'PGRST204', message: 'x' }));
    await expect(supabaseConductorRepository.list()).rejects.toThrow('El módulo de Conductores no está habilitado en el servidor.');
  });

  it('PGRST106 (schema no expuesto) -> mensaje de módulo no habilitado', async () => {
    configurarSelect('conductores', 'conductores', () => fail({ code: 'PGRST106', message: 'x' }));
    await expect(supabaseConductorRepository.list()).rejects.toThrow('El módulo de Conductores no está habilitado en el servidor.');
  });

  it('código desconocido -> mensaje genérico según la operación, nunca error.message crudo', async () => {
    configurarSelect('conductores', 'conductores', () => fail({ code: 'XXYYZZ', message: 'detalle interno de postgres' }));
    await expect(supabaseConductorRepository.list()).rejects.toThrow('No se pudo cargar el conductor.');
  });

});

// -------------------------------------------------------------------------------------------
// 7.7 — Test de código fuente (`?raw`): sin `service_role`, sin `any`, sin `modulos.permisos`.
// -------------------------------------------------------------------------------------------

// Mismo escopeo a líneas de código que `presupuestos/repositorySourceGuards.test.ts` (tasks.md
// 3.10 de integracion-presupuestos): un regex `/\bany\b/` ingenuo sobre el archivo entero
// matchearía dentro de los propios comentarios explicativos de este mismo test/repository.
function soloLineasDeCodigo(fuente: string): string {
  return fuente
    .split('\n')
    .filter((linea) => !linea.trim().startsWith('//'))
    .map((linea) => {
      const indice = linea.indexOf('//');
      return indice === -1 ? linea : linea.slice(0, indice);
    })
    .join('\n');
}

describe('SupabaseConductorRepository.ts — guardas de código fuente (tasks.md 7.7)', () => {
  const codigo = soloLineasDeCodigo(supabaseConductorRepositorySource);

  it('no contiene "service_role"', () => {
    expect(supabaseConductorRepositorySource).not.toContain('service_role');
  });

  it('no contiene la palabra "any" como token', () => {
    expect(codigo).not.toMatch(/\bany\b/);
  });

  it('no consulta modulos.permisos ni modulos.modulos — la autorización no se duplica client-side', () => {
    expect(codigo).not.toMatch(/\.schema\(\s*['"]modulos['"]\s*\)/);
    expect(codigo).not.toMatch(/\.from\(\s*['"](permisos|modulos)['"]\s*\)/);
  });
});
