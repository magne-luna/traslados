/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import { parseRecorridoHabitualRow } from './recorridoHabitualMapping';
import type { NuevoRecorridoHabitual } from '../../types/recorridoHabitual';

// -------------------------------------------------------------------------------------------
// Fake tipado del subconjunto de supabase-js usado por RecorridoHabitual (cero `any`, cero `as`).
// Mismo fake que SupabaseCobroRepository.test.ts: `.select()`, `.insert().select().single()`,
// `.delete()`, todos con `.eq()`.
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

const { supabaseRecorridoHabitualRepository } = await import('./SupabaseRecorridoHabitualRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------------------------------

function filaRecorrido(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'r-1',
    paciente_id: 'p-1',
    id_dir_inicial: 'd-1',
    id_dir_final: 'd-2',
    dia_semana: 'lunes',
    hora: '08:30:00',
    ...overrides,
  };
}

function nuevoRecorridoMinimo(): NuevoRecorridoHabitual {
  return { pacienteId: 'p-1', direccionInicialId: 'd-1', direccionFinalId: 'd-2', diaSemana: 'lunes', hora: '08:30' };
}

// -------------------------------------------------------------------------------------------
// list(pacienteId)
// -------------------------------------------------------------------------------------------

describe('supabaseRecorridoHabitualRepository.list', () => {
  it('devuelve los destinos habituales del paciente, mapeados', async () => {
    const fila = filaRecorrido();
    configurar('pacientes', 'recorridos', 'select', () => ok([fila]));

    const resultado = await supabaseRecorridoHabitualRepository.list('p-1');

    expect(resultado).toEqual([parseRecorridoHabitualRow(fila)]);
  });

  it('filtra EXACTAMENTE por la columna "paciente_id"', async () => {
    configurar('pacientes', 'recorridos', 'select', () => ok([filaRecorrido()]));

    await supabaseRecorridoHabitualRepository.list('p-1');

    const seleccion = calls.find((c) => c.op === 'select');
    expect(seleccion?.eq).toEqual([['paciente_id', 'p-1']]);
  });

  it('dispara una sola consulta (anti N+1)', async () => {
    configurar('pacientes', 'recorridos', 'select', () => ok([filaRecorrido()]));

    await supabaseRecorridoHabitualRepository.list('p-1');

    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1);
  });

  it('devuelve [] si la consulta no trae un array (defensivo)', async () => {
    configurar('pacientes', 'recorridos', 'select', () => ok(null));

    await expect(supabaseRecorridoHabitualRepository.list('p-1')).resolves.toEqual([]);
  });

  it('paciente sin destinos habituales -> []', async () => {
    configurar('pacientes', 'recorridos', 'select', () => ok([]));

    await expect(supabaseRecorridoHabitualRepository.list('p-1')).resolves.toEqual([]);
  });

  it('lanza un error traducido si la consulta falla', async () => {
    configurar('pacientes', 'recorridos', 'select', () => fail({ code: '55000', message: 'internal error' }));

    await expect(supabaseRecorridoHabitualRepository.list('p-1')).rejects.toThrow(
      'No se pudieron cargar los destinos habituales.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// create(data)
// -------------------------------------------------------------------------------------------

describe('supabaseRecorridoHabitualRepository.create', () => {
  it('inserta y devuelve el destino habitual mapeado desde la fila que la base devolvió', async () => {
    const filaCreada = filaRecorrido({ id: 'nuevo-id' });
    configurar('pacientes', 'recorridos', 'insert', () => ok(filaCreada));

    const resultado = await supabaseRecorridoHabitualRepository.create(nuevoRecorridoMinimo());

    expect(resultado).toEqual(parseRecorridoHabitualRow(filaCreada));
  });

  it('emite EXACTAMENTE un insert, con el payload snake_case', async () => {
    configurar('pacientes', 'recorridos', 'insert', () => ok(filaRecorrido({ id: 'nuevo-id' })));

    await supabaseRecorridoHabitualRepository.create(nuevoRecorridoMinimo());

    const inserts = calls.filter((c) => c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.payload).toEqual({
      paciente_id: 'p-1',
      id_dir_inicial: 'd-1',
      id_dir_final: 'd-2',
      dia_semana: 'lunes',
      hora: '08:30',
    });
  });

  it('si la relectura del insert devuelve null (sin error), lanza en vez de inventar un RecorridoHabitual', async () => {
    configurar('pacientes', 'recorridos', 'insert', () => ok(null));

    await expect(supabaseRecorridoHabitualRepository.create(nuevoRecorridoMinimo())).rejects.toThrow(
      'No se pudo guardar el destino habitual.',
    );
  });

  it('23503 (FK violation, ej. una dirección referenciada ya no existe) -> mensaje claro', async () => {
    configurar('pacientes', 'recorridos', 'insert', () =>
      fail({ code: '23503', message: 'insert on table "recorridos" violates foreign key constraint "recorridos_id_dir_inicial_fkey"' }),
    );

    await expect(supabaseRecorridoHabitualRepository.create(nuevoRecorridoMinimo())).rejects.toThrow(
      'Una de las direcciones elegidas ya no existe. Actualizá la lista de direcciones e intentá de nuevo.',
    );
  });

  it('42501/PGRST301 -> falta de permiso (módulo Hojas de Ruta)', async () => {
    configurar('pacientes', 'recorridos', 'insert', () => fail({ code: '42501', message: 'permission denied' }));

    await expect(supabaseRecorridoHabitualRepository.create(nuevoRecorridoMinimo())).rejects.toThrow(
      'No tenés permiso para modificar los destinos habituales.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// remove(id)
// -------------------------------------------------------------------------------------------

describe('supabaseRecorridoHabitualRepository.remove', () => {
  it('emite .delete().eq("id", id) con el id exacto', async () => {
    configurar('pacientes', 'recorridos', 'delete', () => ok(null));

    await supabaseRecorridoHabitualRepository.remove('r-1');

    const eliminacion = calls.find((c) => c.op === 'delete');
    expect(eliminacion?.eq).toEqual([['id', 'r-1']]);
  });

  it('una lectura posterior (mock) ya no incluye el destino habitual eliminado', async () => {
    let restantes = [filaRecorrido({ id: 'r-1' }), filaRecorrido({ id: 'r-2' })];
    configurar('pacientes', 'recorridos', 'delete', (call) => {
      const [, idEliminado] = call.eq[0] ?? [];
      restantes = restantes.filter((r) => r.id !== idEliminado);
      return ok(null);
    });
    configurar('pacientes', 'recorridos', 'select', () => ok(restantes));

    await supabaseRecorridoHabitualRepository.remove('r-1');
    const resultado = await supabaseRecorridoHabitualRepository.list('p-1');

    expect(resultado.map((r) => r.id)).toEqual(['r-2']);
  });

  it('lanza un error traducido si la eliminación falla por falta de permiso', async () => {
    configurar('pacientes', 'recorridos', 'delete', () => fail({ code: '42501', message: 'permission denied' }));

    await expect(supabaseRecorridoHabitualRepository.remove('r-1')).rejects.toThrow(
      'No tenés permiso para modificar los destinos habituales.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// Traducción de errores — mensajes sin jerga técnica en inglés ni nombres de tabla/columna
// -------------------------------------------------------------------------------------------

describe('mapeo de errores de SupabaseRecorridoHabitualRepository', () => {
  const CODIGOS = ['42501', 'PGRST301', '23503', '55000'];
  const FRAGMENTOS_PROHIBIDOS = [
    'pacientes.recorridos',
    'id_dir_inicial',
    'id_dir_final',
    'paciente_id',
    'schema',
    'table',
    'column',
    'constraint',
    'permission denied',
    'relation',
  ];

  it.each(CODIGOS)('el mensaje de %s no contiene nombres de tabla/columna ni texto en inglés', async (codigo) => {
    configurar('pacientes', 'recorridos', 'select', () =>
      fail({ code: codigo, message: 'relation "pacientes.recorridos" violates foreign key constraint on column paciente_id' }),
    );

    try {
      await supabaseRecorridoHabitualRepository.list('p-1');
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
// Aserción de código fuente (node:fs, no `?raw`), equivalente a SupabaseCobroRepository.test.ts 4.7
// -------------------------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUENTE_REPOSITORY = readFileSync(resolve(__dirname, 'SupabaseRecorridoHabitualRepository.ts'), 'utf-8');

describe('código fuente de SupabaseRecorridoHabitualRepository.ts', () => {
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
