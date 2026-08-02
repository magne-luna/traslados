import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ActualizacionPrestador, NuevoPrestador } from '../../types/prestador';

// Testing reducido a propósito para esta rama de demo (ver cabecera de tasks.md, tarea 3.5): un
// solo smoke test que cubre create() + update() con `obrasSocialesIds` sin cambios reales — la
// única aserción de este change que vale la pena proteger con test (D2: que el diff del vínculo
// NO dispare `.delete()`/`.insert()` de más cuando el conjunto entrante coincide con el real). El
// resto de las ramas de error queda sin cubrir a propósito, mismo criterio que
// `SupabaseObraSocialRepository.test.ts`/`SupabasePacienteRepository.test.ts`, recortado al fake
// mínimo que este repository usa (`select`/`insert`/`update`/`delete`/`.eq()`/`.in()`).

interface FakeError {
  code?: string;
  message: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

type FakeOp = 'select' | 'insert' | 'update' | 'delete';

interface RecordedCall {
  op: FakeOp;
  schema: string;
  table: string;
  eq: Array<[string, unknown]>;
  in: Array<[string, unknown[]]>;
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

function configurar(schema: string, table: string, op: FakeOp, handler: Handler): void {
  handlers.set(`${schema}.${table}.${op}`, handler);
}

function resolver(call: RecordedCall): FakeResult {
  const handler = handlers.get(`${call.schema}.${call.table}.${call.op}`);
  if (handler) return handler(call);
  return call.op === 'select' ? ok([]) : ok(null);
}

class FakeQueryBuilder implements PromiseLike<FakeResult> {
  private readonly call: RecordedCall;

  constructor(call: RecordedCall) {
    this.call = call;
  }

  select(_columns?: string): FakeQueryBuilder {
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder {
    this.call.eq.push([column, value]);
    return this;
  }

  in(column: string, values: unknown[]): FakeQueryBuilder {
    this.call.in.push([column, values]);
    return this;
  }

  maybeSingle(): Promise<FakeResult> {
    calls.push(this.call);
    const result = resolver(this.call);
    const rows = Array.isArray(result.data) ? result.data : [];
    return Promise.resolve({ data: rows[0] ?? null, error: result.error });
  }

  single(): Promise<FakeResult> {
    calls.push(this.call);
    const result = resolver(this.call);
    if (Array.isArray(result.data)) return Promise.resolve({ data: result.data[0] ?? null, error: result.error });
    return Promise.resolve(result);
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
              return new FakeQueryBuilder({ op: 'select', schema: schemaName, table, eq: [], in: [] }).select(columns);
            },
            insert(payload: unknown) {
              return new FakeQueryBuilder({ op: 'insert', schema: schemaName, table, eq: [], in: [], payload });
            },
            update(payload: unknown) {
              return new FakeQueryBuilder({ op: 'update', schema: schemaName, table, eq: [], in: [], payload });
            },
            delete() {
              return new FakeQueryBuilder({ op: 'delete', schema: schemaName, table, eq: [], in: [] });
            },
          };
        },
      };
    },
  };
}

vi.mock('../supabaseClient', () => ({ supabase: crearFakeSupabase() }));

const { supabasePrestadorRepository } = await import('./SupabasePrestadorRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------------------------------

function filaPrestador(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p-1',
    razon_social: 'Traslados Andrea SA',
    cuit: '30-11111111-1',
    direccion: null,
    telefono: null,
    plazo_cobro_dias: 90,
    tipo_comprobante: 'A',
    obra_social_prestador: [{ obra_social_id: 'os-1' }, { obra_social_id: 'os-2' }],
    ...overrides,
  };
}

function buildNuevoPrestadorMinimo(): NuevoPrestador {
  return {
    razonSocial: 'Traslados Andrea SA',
    cuit: '30-11111111-1',
    plazoCobroDias: 90,
    tipoComprobante: 'A',
  };
}

// -------------------------------------------------------------------------------------------

describe('SupabasePrestadorRepository (3.5, smoke test)', () => {
  it('create() inserta los campos planos y devuelve el prestador recién creado', async () => {
    configurar('obra_social', 'prestadores', 'insert', () => ok({ id: 'p-1' }));
    configurar('obra_social', 'prestadores', 'select', () => ok([filaPrestador()]));

    const creado = await supabasePrestadorRepository.create(buildNuevoPrestadorMinimo());

    expect(creado.id).toBe('p-1');
    expect(creado.razonSocial).toBe('Traslados Andrea SA');
    expect(creado.cuit).toBe('30-11111111-1');
    expect(creado.plazoCobroDias).toBe(90);
    expect(creado.tipoComprobante).toBe('A');
  });

  it('update() con obrasSocialesIds sin cambios reales NO dispara ningún .delete()/.insert() sobre el vínculo', async () => {
    configurar('obra_social', 'prestadores', 'update', () => ok(null));
    configurar('obra_social', 'obra_social_prestador', 'select', () => ok([{ obra_social_id: 'os-1' }, { obra_social_id: 'os-2' }]));
    configurar('obra_social', 'prestadores', 'select', () => ok([filaPrestador()]));

    const cambios: ActualizacionPrestador = { plazoCobroDias: 60, obrasSocialesIds: ['os-1', 'os-2'] };
    const actualizado = await supabasePrestadorRepository.update('p-1', cambios);

    expect(actualizado.id).toBe('p-1');

    const llamadasAlVinculo = calls.filter((call) => call.table === 'obra_social_prestador');
    expect(llamadasAlVinculo.some((call) => call.op === 'delete')).toBe(false);
    expect(llamadasAlVinculo.some((call) => call.op === 'insert')).toBe(false);
    // La única llamada al vínculo es la lectura del diff (D2) — nunca escritura de más.
    expect(llamadasAlVinculo.every((call) => call.op === 'select')).toBe(true);
  });
});
