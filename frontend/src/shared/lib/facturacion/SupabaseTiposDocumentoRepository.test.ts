/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { mapearErrorTipoDocumento } from './SupabaseTiposDocumentoRepository';
import type { TipoDocumentoFactura } from '../../types/tiposDocumento';

// -------------------------------------------------------------------------------------------
// Fake tipado del subconjunto de supabase-js usado por el repository de tipos de documento (cero
// `any`, cero `as`), mismo molde que SupabaseCobroRepository.test.ts (CRUD directo sobre una sola
// tabla, sin RPC): `.select().eq().order()`, `.insert().select().single()` y `.update().eq()`
// (con y sin `.select().single()` según la operación).
// -------------------------------------------------------------------------------------------

interface FakeError {
  code?: string;
  message: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

type FakeOp = 'select' | 'insert' | 'update';

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

  order(_column: string, _opciones: { ascending: boolean }): FakeSelectBuilder {
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

class FakeUpdateBuilder implements PromiseLike<FakeResult> {
  private readonly call: RecordedCall;

  constructor(call: RecordedCall) {
    this.call = call;
  }

  eq(column: string, value: unknown): FakeUpdateBuilder {
    this.call.eq.push([column, value]);
    return this;
  }

  select(_columns: string): FakeInsertSelectBuilder {
    return new FakeInsertSelectBuilder(this.call);
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
            update(payload: unknown) {
              return new FakeUpdateBuilder({ op: 'update', schema: schemaName, table, eq: [], payload });
            },
          };
        },
      };
    },
  };
}

vi.mock('../supabaseClient', () => ({ supabase: crearFakeSupabase() }));

// El repository cachea por sesión (mismo patron que SupabaseCatalogoAccesoriosRepository: las
// lecturas se cachean hasta la primera escritura). Sin reset de módulos, la cache del primer
// test contaminaría el resto del archivo — `vi.resetModules()` + re-import en cada test fuerza
// una instancia nueva (y re-ejecuta el factory del mock, que cierra sobre los mismos arrays
// `calls`/`handlers` de este archivo, así que `resetFake()` sigue siendo la fuente de verdad).
type ModuloRepository = typeof import('./SupabaseTiposDocumentoRepository');
let modulo: ModuloRepository;

beforeEach(async () => {
  resetFake();
  vi.resetModules();
  modulo = await import('./SupabaseTiposDocumentoRepository');
});

// -------------------------------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------------------------------

function filaTipo(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 't-1',
    tipo: 'Comprobante ARCA',
    requerido: true,
    activa: true,
    ...overrides,
  };
}

function tipoEsperado(fila: Record<string, unknown>): TipoDocumentoFactura {
  return { id: fila.id as string, tipo: fila.tipo as string, requerido: fila.requerido as boolean, activa: fila.activa as boolean };
}

// -------------------------------------------------------------------------------------------
// listarActivos / listarTodos
// -------------------------------------------------------------------------------------------

describe('modulo.SupabaseTiposDocumentoRepository.listarActivos (a)', () => {
  it('filtra la consulta EXACTAMENTE por activa = true y ordena por tipo ascendente', async () => {
    configurar('facturacion', 'tipos_documento', 'select', () => ok([filaTipo()]));

    await modulo.SupabaseTiposDocumentoRepository.listarActivos();

    const llamada = calls.find((c) => c.op === 'select');
    expect(llamada?.schema).toBe('facturacion');
    expect(llamada?.table).toBe('tipos_documento');
    expect(llamada?.eq).toEqual([['activa', true]]);
  });

  it('devuelve los activos mapeados, ignorando filas con forma inesperada (defensivo)', async () => {
    configurar('facturacion', 'tipos_documento', 'select', () =>
      ok([filaTipo(), { id: 'rara', tipo: 42 }, null]),
    );

    const resultado = await modulo.SupabaseTiposDocumentoRepository.listarActivos();

    expect(resultado).toEqual([tipoEsperado(filaTipo())]);
  });

  it('devuelve [] si la consulta no trae un array (defensivo)', async () => {
    configurar('facturacion', 'tipos_documento', 'select', () => ok(null));

    await expect(modulo.SupabaseTiposDocumentoRepository.listarActivos()).resolves.toEqual([]);
  });

  it('lanza un error traducido si la consulta falla (mismo mapeo unico que accesorios)', async () => {
    configurar('facturacion', 'tipos_documento', 'select', () => fail({ code: '55000', message: 'internal error' }));

    await expect(modulo.SupabaseTiposDocumentoRepository.listarActivos()).rejects.toThrow(
      'No se pudo guardar el tipo de documento.',
    );
  });
});

describe('modulo.SupabaseTiposDocumentoRepository.listarTodos (a)', () => {
  it('trae todos los tipos SIN ningún filtro .eq (activos e inactivos, para reactivar)', async () => {
    const filas = [filaTipo(), filaTipo({ id: 't-2', tipo: 'CODEM', requerido: false, activa: false })];
    configurar('facturacion', 'tipos_documento', 'select', () => ok(filas));

    const resultado = await modulo.SupabaseTiposDocumentoRepository.listarTodos();

    expect(resultado).toEqual(filas.map(tipoEsperado));
    const llamada = calls.find((c) => c.op === 'select');
    expect(llamada?.eq).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------
// crear / editar
// -------------------------------------------------------------------------------------------

describe('modulo.SupabaseTiposDocumentoRepository.crear (b)', () => {
  it('inserta con tipo recortado y requerido, relee y devuelve la fila mapeada', async () => {
    const filaCreada = filaTipo({ id: 'nuevo-id', tipo: 'Reintegro', requerido: false });
    configurar('facturacion', 'tipos_documento', 'insert', () => ok(filaCreada));

    const resultado = await modulo.SupabaseTiposDocumentoRepository.crear('  Reintegro  ', false);

    expect(resultado).toEqual(tipoEsperado(filaCreada));
    const inserts = calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.payload).toEqual({ tipo: 'Reintegro', requerido: false });
  });

  it('si la relectura del insert devuelve null (sin error), lanza en vez de inventar un tipo', async () => {
    configurar('facturacion', 'tipos_documento', 'insert', () => ok(null));

    await expect(modulo.SupabaseTiposDocumentoRepository.crear('Reintegro', false)).rejects.toThrow(
      'No existe ese tipo de documento en el catálogo.',
    );
  });

  it('23505 (UNIQUE tipo) traduce a mensaje accionable que nombra el duplicado', async () => {
    configurar('facturacion', 'tipos_documento', 'insert', () =>
      fail({ code: '23505', message: 'duplicate key value violates unique constraint "tipos_documento_tipo_key"' }),
    );

    await expect(modulo.SupabaseTiposDocumentoRepository.crear('Comprobante ARCA', true)).rejects.toThrow(
      'Ya existe un tipo de documento con ese nombre: «Comprobante ARCA».',
    );
  });
});

describe('modulo.SupabaseTiposDocumentoRepository.editar (c)', () => {
  it('emite .update(cambios).eq("id", id) con SOLO los campos pasados y devuelve la fila actualizada', async () => {
    const filaEditada = filaTipo({ id: 't-1', tipo: 'Comprobante ARCA x2', requerido: false });
    configurar('facturacion', 'tipos_documento', 'update', () => ok(filaEditada));

    const resultado = await modulo.SupabaseTiposDocumentoRepository.editar('t-1', { tipo: 'Comprobante ARCA x2' });

    expect(resultado).toEqual(tipoEsperado(filaEditada));
    const updates = calls.filter((c) => c.op === 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.payload).toEqual({ tipo: 'Comprobante ARCA x2' });
    expect(updates[0]?.eq).toEqual([['id', 't-1']]);
  });

  it('puede editar solo `requerido` sin tocar el nombre', async () => {
    configurar('facturacion', 'tipos_documento', 'update', () => ok(filaTipo({ requerido: false })));

    await modulo.SupabaseTiposDocumentoRepository.editar('t-1', { requerido: false });

    const updates = calls.filter((c) => c.op === 'update');
    expect(updates[0]?.payload).toEqual({ requerido: false });
  });
});

// -------------------------------------------------------------------------------------------
// desactivar / reactivar
// -------------------------------------------------------------------------------------------

describe('modulo.SupabaseTiposDocumentoRepository.desactivar/reactivar (d)', () => {
  it('desactivar emite .update({activa:false}).eq("id", id) sin relectura', async () => {
    configurar('facturacion', 'tipos_documento', 'update', () => ok(null));

    await modulo.SupabaseTiposDocumentoRepository.desactivar('t-1');

    const updates = calls.filter((c) => c.op === 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.payload).toEqual({ activa: false });
    expect(updates[0]?.eq).toEqual([['id', 't-1']]);
  });

  it('reactivar emite .update({activa:true}).eq("id", id)', async () => {
    configurar('facturacion', 'tipos_documento', 'update', () => ok(null));

    await modulo.SupabaseTiposDocumentoRepository.reactivar('t-1');

    const updates = calls.filter((c) => c.op === 'update');
    expect(updates[0]?.payload).toEqual({ activa: true });
  });

  it('tras desactivar, una lectura posterior (mock) ya no incluye el tipo inactivo en listarActivos', async () => {
    let restantes = [filaTipo({ id: 't-1' }), filaTipo({ id: 't-2', tipo: 'CODEM', requerido: false })];
    configurar('facturacion', 'tipos_documento', 'update', (call) => {
      const [, idModificado] = call.eq[0] ?? [];
      restantes = restantes.map((t) => (t.id === idModificado ? { ...t, activa: false } : t));
      return ok(null);
    });
    configurar('facturacion', 'tipos_documento', 'select', () => ok(restantes.filter((t) => t.activa)));

    await modulo.SupabaseTiposDocumentoRepository.desactivar('t-1');
    const resultado = await modulo.SupabaseTiposDocumentoRepository.listarActivos();

    expect(resultado.map((t) => t.tipo)).toEqual(['CODEM']);
  });
});

// -------------------------------------------------------------------------------------------
// Traduccion de errores (molde mapearErrorCatalogo)
// -------------------------------------------------------------------------------------------

describe('mapearErrorTipoDocumento (e)', () => {
  it('23505 traduce a mensaje accionable que nombra el tipo duplicado', () => {
    const error = mapearErrorTipoDocumento(
      { code: '23505', message: 'duplicate key value violates unique constraint "tipos_documento_tipo_key"' },
      { tipo: 'CODEM' },
    );
    expect(error.message).toContain('Ya existe un tipo de documento');
    expect(error.message).toContain('CODEM');
  });

  it('23505 sin contexto cae al mensaje generico de duplicado', () => {
    const error = mapearErrorTipoDocumento({
      code: '23505',
      message: 'duplicate key value violates unique constraint "tipos_documento_tipo_key"',
    });
    expect(error.message).toContain('Ya existe un tipo de documento');
  });

  it('42501 traduce a falta de permiso de escritura', () => {
    const error = mapearErrorTipoDocumento({ code: '42501', message: 'new row violates row-level security policy' });
    expect(error.message).toContain('No tenés permiso');
  });

  it('PGRST301 (permiso PostgREST) tambien traduce a falta de permiso', () => {
    const error = mapearErrorTipoDocumento({ code: 'PGRST301', message: 'permission denied' });
    expect(error.message).toContain('No tenés permiso');
  });

  it('código desconocido cae a generico sin propagar el mensaje crudo de Postgres', () => {
    const error = mapearErrorTipoDocumento({ code: 'XX000', message: 'internal_error ALTER SYSTEM SET x' });
    expect(error.message).toBe('No se pudo guardar el tipo de documento.');
    expect(error.message).not.toContain('internal_error');
  });
});

// -------------------------------------------------------------------------------------------
// Asercion de código fuente (equivalente a 4.7 de SupabaseCobroRepository.test.ts)
// -------------------------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUENTE_REPOSITORY = readFileSync(resolve(__dirname, 'SupabaseTiposDocumentoRepository.ts'), 'utf-8');

describe('código fuente de SupabaseTiposDocumentoRepository.ts (f)', () => {
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