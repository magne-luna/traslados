/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { parseCobroRow } from './facturaMapping';
import type { NuevoCobro } from '../../types/factura';

// -------------------------------------------------------------------------------------------
// 4.1-4.4 — Fake tipado del subconjunto de supabase-js usado por Cobro (cero `any`, cero `as`).
// A diferencia del fake de SupabaseFacturaRepository.test.ts, acá hace falta `.insert().select()
// .single()` (D6: sin RPC, es CRUD directo sobre una sola tabla) en vez de `.rpc()`.
// -------------------------------------------------------------------------------------------

interface FakeError {
  code?: string;
  message: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

type FakeOp = 'select' | 'insert' | 'delete';

interface RecordedCall {
  op: FakeOp;
  schema: string;
  table: string;
  eq: Array<[string, unknown]>;
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

function configurar(schema: string, table: string, op: FakeOp, handler: Handler): void {
  handlers.set(`${schema}.${table}.${op}`, handler);
}

function resolver(call: RecordedCall): FakeResult {
  const key = `${call.schema}.${call.table}.${call.op}`;
  const handler = handlers.get(key);
  if (handler) return handler(call);
  return call.op === 'select' ? ok([]) : ok(null);
}

class FakeSelectBuilder implements PromiseLike<FakeResult> {
  private readonly call: RecordedCall;

  constructor(call: RecordedCall) {
    this.call = call;
  }

  select(_columns: string): FakeSelectBuilder {
    return this;
  }

  eq(column: string, value: unknown): FakeSelectBuilder {
    this.call.eq.push([column, value]);
    return this;
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    calls.push(this.call);
    return Promise.resolve(resolver(this.call)).then(onfulfilled, onrejected);
  }
}

class FakeInsertSelectBuilder {
  private readonly call: RecordedCall;

  constructor(call: RecordedCall) {
    this.call = call;
  }

  select(_columns: string): FakeInsertSelectBuilder {
    return this;
  }

  single(): Promise<FakeResult> {
    calls.push(this.call);
    const result = resolver(this.call);
    const rows = Array.isArray(result.data) ? result.data : result.data === null ? [] : [result.data];
    return Promise.resolve({ data: rows[0] ?? null, error: result.error });
  }
}

class FakeDeleteBuilder implements PromiseLike<FakeResult> {
  private readonly call: RecordedCall;

  constructor(call: RecordedCall) {
    this.call = call;
  }

  eq(column: string, value: unknown): FakeDeleteBuilder {
    this.call.eq.push([column, value]);
    return this;
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
            select(columns: string) {
              return new FakeSelectBuilder({ op: 'select', schema: schemaName, table, eq: [] }).select(columns);
            },
            insert(payload: unknown) {
              return new FakeInsertSelectBuilder({ op: 'insert', schema: schemaName, table, eq: [], payload });
            },
            delete() {
              return new FakeDeleteBuilder({ op: 'delete', schema: schemaName, table, eq: [] });
            },
          };
        },
      };
    },
  };
}

vi.mock('../supabaseClient', () => ({ supabase: crearFakeSupabase() }));

const { supabaseCobroRepository } = await import('./SupabaseCobroRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------------------------------

function filaCobro(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'c-1',
    facturas_id: 'f-1',
    fecha: '2026-08-05',
    monto_pagado: 15000,
    ...overrides,
  };
}

function nuevoCobroMinimo(): NuevoCobro {
  return { facturaId: 'f-1', fecha: '2026-08-05', montoPagado: 15000 };
}

// -------------------------------------------------------------------------------------------
// 4.1 — list()
// -------------------------------------------------------------------------------------------

describe('supabaseCobroRepository.list (4.1)', () => {
  it('devuelve todos los cobros mapeados desde una sola consulta sin filtro', async () => {
    const filas = [filaCobro({ id: 'c-1', facturas_id: 'f-1' }), filaCobro({ id: 'c-2', facturas_id: 'f-2' })];
    configurar('facturacion', 'cobros', 'select', () => ok(filas));

    const resultado = await supabaseCobroRepository.list();

    expect(resultado).toEqual([parseCobroRow(filas[0]), parseCobroRow(filas[1])]);
  });

  it('dispara una sola consulta (anti N+1) y sin ningún filtro `.eq`', async () => {
    configurar('facturacion', 'cobros', 'select', () => ok([filaCobro()]));

    await supabaseCobroRepository.list();

    const selects = calls.filter((c) => c.op === 'select');
    expect(selects).toHaveLength(1);
    expect(selects[0]?.eq).toEqual([]);
  });

  it('devuelve [] si la consulta no trae un array (defensivo)', async () => {
    configurar('facturacion', 'cobros', 'select', () => ok(null));

    await expect(supabaseCobroRepository.list()).resolves.toEqual([]);
  });

  it('lanza un error traducido si la consulta falla', async () => {
    configurar('facturacion', 'cobros', 'select', () => fail({ code: '55000', message: 'internal error' }));

    await expect(supabaseCobroRepository.list()).rejects.toThrow('No se pudieron cargar los cobros.');
  });
});

// -------------------------------------------------------------------------------------------
// 4.2 — listByFactura(facturaId): test EXPLÍCITO del nombre de columna `facturas_id` (plural)
// -------------------------------------------------------------------------------------------

describe('supabaseCobroRepository.listByFactura (4.2)', () => {
  it('filtra la consulta EXACTAMENTE por la columna "facturas_id" (plural) — no "factura_id"', async () => {
    configurar('facturacion', 'cobros', 'select', () => ok([filaCobro({ facturas_id: 'f-1' })]));

    await supabaseCobroRepository.listByFactura('f-1');

    const llamada = calls.find((c) => c.op === 'select');
    expect(llamada?.eq).toEqual([['facturas_id', 'f-1']]);
    // Doble aserción: el error más silencioso posible es un typo en el nombre de columna que
    // compila igual y siempre devuelve 0 filas. Un `.eq(['factura_id', ...])` (singular) NO debe
    // pasar este test.
    expect(llamada?.eq.some(([columna]) => columna === 'factura_id')).toBe(false);
  });

  it('devuelve los cobros de esa factura, mapeados', async () => {
    const fila = filaCobro({ facturas_id: 'f-1' });
    configurar('facturacion', 'cobros', 'select', () => ok([fila]));

    const resultado = await supabaseCobroRepository.listByFactura('f-1');

    expect(resultado).toEqual([parseCobroRow(fila)]);
  });

  it('dispara una sola consulta (anti N+1)', async () => {
    configurar('facturacion', 'cobros', 'select', () => ok([filaCobro()]));

    await supabaseCobroRepository.listByFactura('f-1');

    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1);
  });

  it('lanza un error traducido si la consulta falla', async () => {
    configurar('facturacion', 'cobros', 'select', () => fail({ code: '55000', message: 'internal error' }));

    await expect(supabaseCobroRepository.listByFactura('f-1')).rejects.toThrow('No se pudieron cargar los cobros.');
  });
});

// -------------------------------------------------------------------------------------------
// 4.3 — create(): .insert() + .select().single(), devuelve el Cobro mapeado
// -------------------------------------------------------------------------------------------

describe('supabaseCobroRepository.create (4.3)', () => {
  it('inserta y devuelve el cobro mapeado desde la fila que la base devolvió', async () => {
    const filaCreada = filaCobro({ id: 'nuevo-id' });
    configurar('facturacion', 'cobros', 'insert', () => ok(filaCreada));

    const resultado = await supabaseCobroRepository.create(nuevoCobroMinimo());

    expect(resultado).toEqual(parseCobroRow(filaCreada));
  });

  it('emite EXACTAMENTE un insert, con el payload snake_case de toCrearCobroPayload', async () => {
    configurar('facturacion', 'cobros', 'insert', () => ok(filaCobro({ id: 'nuevo-id' })));

    await supabaseCobroRepository.create(nuevoCobroMinimo());

    const inserts = calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.payload).toEqual({ facturas_id: 'f-1', fecha: '2026-08-05', monto_pagado: 15000 });
  });

  it('si la relectura del insert devuelve null (sin error), lanza en vez de inventar un Cobro', async () => {
    configurar('facturacion', 'cobros', 'insert', () => ok(null));

    await expect(supabaseCobroRepository.create(nuevoCobroMinimo())).rejects.toThrow('No se pudo guardar el cobro.');
  });

  it('23503 sobre facturas_id -> la factura de ese cobro ya no existe', async () => {
    configurar('facturacion', 'cobros', 'insert', () =>
      fail({ code: '23503', message: 'insert on table "cobros" violates foreign key constraint "cobros_facturas_id_fkey"' }),
    );

    await expect(supabaseCobroRepository.create(nuevoCobroMinimo())).rejects.toThrow(
      'La factura de ese cobro ya no existe.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 4.4 — remove(id): .delete().eq('id', id); una lectura posterior no lo incluye
// -------------------------------------------------------------------------------------------

describe('supabaseCobroRepository.remove (4.4)', () => {
  it('emite .delete().eq("id", id) con el id exacto', async () => {
    configurar('facturacion', 'cobros', 'delete', () => ok(null));

    await supabaseCobroRepository.remove('c-1');

    const eliminacion = calls.find((c) => c.op === 'delete');
    expect(eliminacion?.eq).toEqual([['id', 'c-1']]);
  });

  it('una lectura posterior (mock) ya no incluye el cobro eliminado', async () => {
    let cobrosRestantes = [filaCobro({ id: 'c-1' }), filaCobro({ id: 'c-2' })];
    configurar('facturacion', 'cobros', 'delete', (call) => {
      const [, idEliminado] = call.eq[0] ?? [];
      cobrosRestantes = cobrosRestantes.filter((c) => c.id !== idEliminado);
      return ok(null);
    });
    configurar('facturacion', 'cobros', 'select', () => ok(cobrosRestantes));

    await supabaseCobroRepository.remove('c-1');
    const resultado = await supabaseCobroRepository.list();

    expect(resultado.map((c) => c.id)).toEqual(['c-2']);
  });

  it('lanza un error traducido si la eliminación falla por falta de permiso', async () => {
    configurar('facturacion', 'cobros', 'delete', () => fail({ code: '42501', message: 'permission denied' }));

    await expect(supabaseCobroRepository.remove('c-1')).rejects.toThrow('No tenés permiso para modificar facturas.');
  });
});

// -------------------------------------------------------------------------------------------
// 4.5 — traducción de errores D7
// -------------------------------------------------------------------------------------------

describe('mapeo de errores D7 para cobros (4.5)', () => {
  it('42501 -> falta de permiso', async () => {
    configurar('facturacion', 'cobros', 'select', () => fail({ code: '42501', message: 'permission denied' }));
    await expect(supabaseCobroRepository.list()).rejects.toThrow('No tenés permiso para modificar facturas.');
  });

  it('PGRST301 -> falta de permiso', async () => {
    configurar('facturacion', 'cobros', 'select', () => fail({ code: 'PGRST301', message: 'jwt role denied' }));
    await expect(supabaseCobroRepository.list()).rejects.toThrow('No tenés permiso para modificar facturas.');
  });

  it('23503 sobre facturas_id -> mensaje EXACTO "La factura de ese cobro ya no existe."', async () => {
    configurar('facturacion', 'cobros', 'insert', () =>
      fail({ code: '23503', message: 'violates foreign key constraint "cobros_facturas_id_fkey"' }),
    );
    await expect(supabaseCobroRepository.create(nuevoCobroMinimo())).rejects.toThrow(
      new Error('La factura de ese cobro ya no existe.'),
    );
  });

  it('código desconocido en una carga (list) -> mensaje genérico de carga', async () => {
    configurar('facturacion', 'cobros', 'select', () => fail({ code: '55000', message: 'internal error' }));
    await expect(supabaseCobroRepository.list()).rejects.toThrow('No se pudieron cargar los cobros.');
  });

  it('código desconocido en un guardado (create) -> mensaje genérico de guardado, distinto del de carga', async () => {
    configurar('facturacion', 'cobros', 'insert', () => fail({ code: '55000', message: 'internal error' }));
    await expect(supabaseCobroRepository.create(nuevoCobroMinimo())).rejects.toThrow('No se pudo guardar el cobro.');
  });

  it('código desconocido en un borrado (remove) -> mensaje genérico de guardado', async () => {
    configurar('facturacion', 'cobros', 'delete', () => fail({ code: '55000', message: 'internal error' }));
    await expect(supabaseCobroRepository.remove('c-1')).rejects.toThrow('No se pudo guardar el cobro.');
  });

  // TRIANGULATE: ningún mensaje contiene nombre de tabla/columna calificado ni jerga técnica en
  // inglés (mismo criterio que 3.7 en SupabaseFacturaRepository.test.ts).
  const CODIGOS_D7 = ['42501', 'PGRST301', '23503', '55000'];
  const FRAGMENTOS_PROHIBIDOS = [
    'facturacion.cobros',
    'facturas_id',
    'monto_pagado',
    'schema',
    'table',
    'column',
    'constraint',
    'permission denied',
    'relation',
  ];

  it.each(CODIGOS_D7)('el mensaje de %s no contiene nombres de tabla/columna ni texto en inglés', async (codigo) => {
    configurar('facturacion', 'cobros', 'select', () =>
      fail({ code: codigo, message: 'relation "facturacion.cobros" violates foreign key constraint on column facturas_id' }),
    );

    try {
      await supabaseCobroRepository.list();
      throw new Error('debía lanzar');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      for (const fragmento of FRAGMENTOS_PROHIBIDOS) {
        expect(mensaje.toLowerCase()).not.toContain(fragmento);
      }
    }
  });
});

// -------------------------------------------------------------------------------------------
// 4.6 — coherencia list() / listByFactura(): requisito vigente de `factura-contract`
// -------------------------------------------------------------------------------------------

describe('coherencia list() / listByFactura() (4.6)', () => {
  it('listByFactura(x) devuelve exactamente el subconjunto de list() cuyo facturaId === x', async () => {
    const filas = [
      filaCobro({ id: 'c-1', facturas_id: 'f-1' }),
      filaCobro({ id: 'c-2', facturas_id: 'f-2' }),
      filaCobro({ id: 'c-3', facturas_id: 'f-1' }),
    ];
    configurar('facturacion', 'cobros', 'select', (call) => {
      if (call.eq.length === 0) return ok(filas);
      const [, facturaId] = call.eq[0] ?? [];
      return ok(filas.filter((f) => f.facturas_id === facturaId));
    });

    const todos = await supabaseCobroRepository.list();
    const deLaFactura = await supabaseCobroRepository.listByFactura('f-1');

    const esperado = todos.filter((c) => c.facturaId === 'f-1');
    expect(deLaFactura).toEqual(esperado);
    expect(deLaFactura.map((c) => c.id).sort()).toEqual(['c-1', 'c-3']);
  });
});

// -------------------------------------------------------------------------------------------
// 4.7 — aserción de código fuente (node:fs, no `?raw`), equivalente a 3.8
// -------------------------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUENTE_REPOSITORY = readFileSync(resolve(__dirname, 'SupabaseCobroRepository.ts'), 'utf-8');

describe('código fuente de SupabaseCobroRepository.ts (4.7)', () => {
  it('no contiene service_role', () => {
    expect(FUENTE_REPOSITORY).not.toContain('service_role');
  });

  it('no contiene `any`', () => {
    expect(FUENTE_REPOSITORY).not.toMatch(/\bany\b/);
  });

  it('no crea su propio cliente de supabase: lo recibe inyectado del singleton compartido', () => {
    expect(FUENTE_REPOSITORY).toContain("from '../supabaseClient'");
    expect(FUENTE_REPOSITORY).not.toContain('createClient');
  });

  it('no consulta modulos.permisos ni modulos.modulos directamente (el gateo es responsabilidad de RLS)', () => {
    expect(FUENTE_REPOSITORY).not.toContain(".from('permisos')");
    expect(FUENTE_REPOSITORY).not.toContain(".from('modulos')");
    expect(FUENTE_REPOSITORY).not.toContain("schema('modulos')");
  });
});
