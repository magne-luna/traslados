import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import Vite `?raw` (declarado en vite/client.d.ts) — código fuente como string en build time,
// mismo patrón que `SupabaseObraSocialRepository.test.ts`: asserts sobre el texto fuente, nunca eval.
import supabaseRequisitosActividadRepositorySource from './SupabaseRequisitosActividadRepository.ts?raw';

// -------------------------------------------------------------------------------------------
// Fake tipado del subconjunto de supabase-js que este repository usa: `select()` (thenable
// directo, sin `.eq()`/`.maybeSingle()` — este repository nunca filtra por id) y `rpc()`. Recorte
// más chico que el fake de `SupabaseObraSocialRepository.test.ts` porque este repository solo
// tiene dos operaciones.
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

// El resolver busca las RPC bajo `${schema}.rpc.${fn}` (ver `resolver()` abajo) — helper propio,
// mismo criterio que `configurarRpc` de `SupabaseObraSocialRepository.test.ts`, para no tener que
// recordar el orden distinto de la clave en cada test.
function configurarRpc(schema: string, fn: string, handler: Handler): void {
  handlers.set(`${schema}.rpc.${fn}`, handler);
}

function resolver(call: RecordedCall): FakeResult {
  const key = call.op === 'rpc' ? `${call.schema}.rpc.${call.table}` : `${call.schema}.${call.table}.${call.op}`;
  const handler = handlers.get(key);
  if (handler) return handler(call);
  return call.op === 'select' ? ok([]) : ok(null);
}

function crearFakeSupabase() {
  return {
    schema(schemaName: string) {
      return {
        from(table: string) {
          return {
            select(_columns: string) {
              const call: RecordedCall = { op: 'select', schema: schemaName, table };
              calls.push(call);
              return Promise.resolve(resolver(call));
            },
          };
        },
        rpc(fn: string, args: unknown) {
          const call: RecordedCall = { op: 'rpc', schema: schemaName, table: fn, payload: args };
          calls.push(call);
          return Promise.resolve(resolver(call));
        },
      };
    },
  };
}

vi.mock('../supabaseClient', () => ({ supabase: crearFakeSupabase() }));

const { supabaseRequisitosActividadRepository } = await import('./SupabaseRequisitosActividadRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// listAll()
// -------------------------------------------------------------------------------------------

describe('supabaseRequisitosActividadRepository.listAll', () => {
  it('devuelve la configuración agrupada por tipo a partir de una sola consulta', async () => {
    configurar('obra_social', 'requisitos_actividad', 'select', () =>
      ok([
        { id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } },
        { id: 'r-2', tipo_lugar: 'terapia', orden: 0, requerido: false, tipos_documento: { id: 't-2', tipo: 'Orden médica' } },
      ]),
    );

    const resultado = await supabaseRequisitosActividadRepository.listAll();

    expect(resultado.escuela).toEqual([{ id: 't-1', nombre: 'Constancia', requerido: true }]);
    expect(resultado.terapia).toEqual([{ id: 't-2', nombre: 'Orden médica', requerido: false }]);
  });

  it('un listado dispara una sola consulta (anti N+1)', async () => {
    configurar('obra_social', 'requisitos_actividad', 'select', () => ok([]));

    await supabaseRequisitosActividadRepository.listAll();

    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1);
  });

  it('sin ninguna configuración, devuelve un objeto vacío (default documentado, sin regresión)', async () => {
    configurar('obra_social', 'requisitos_actividad', 'select', () => ok([]));

    await expect(supabaseRequisitosActividadRepository.listAll()).resolves.toEqual({});
  });

  it('lanza un error traducido si el módulo obra_social no está habilitado', async () => {
    configurar('obra_social', 'requisitos_actividad', 'select', () => fail({ code: 'PGRST106', message: 'schema not exposed' }));

    await expect(supabaseRequisitosActividadRepository.listAll()).rejects.toThrow(
      'El módulo de Obras Sociales no está habilitado en el servidor.',
    );
  });

  it('lanza un error genérico traducido ante un código desconocido (nunca el mensaje crudo de Postgres)', async () => {
    configurar('obra_social', 'requisitos_actividad', 'select', () => fail({ code: '99999', message: 'boom interno de postgres' }));

    const promesa = supabaseRequisitosActividadRepository.listAll();
    await expect(promesa).rejects.toThrow('No se pudo cargar la configuración por tipo de actividad.');
    await expect(promesa).rejects.not.toThrow('boom interno de postgres');
  });
});

// -------------------------------------------------------------------------------------------
// actualizar()
// -------------------------------------------------------------------------------------------

describe('supabaseRequisitosActividadRepository.actualizar', () => {
  it('llama la RPC con el tipo y el payload derivado de los items, y devuelve lo que quedó persistido', async () => {
    configurarRpc('obra_social', 'actualizar_requisitos_actividad', () => ok(null));
    configurar('obra_social', 'requisitos_actividad', 'select', () =>
      ok([{ id: 'r-1', tipo_lugar: 'escuela', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Constancia' } }]),
    );

    const resultado = await supabaseRequisitosActividadRepository.actualizar('escuela', [
      { id: 't-1', nombre: 'Constancia', requerido: true },
    ]);

    expect(resultado).toEqual([{ id: 't-1', nombre: 'Constancia', requerido: true }]);
    const llamadaRpc = calls.find((c) => c.op === 'rpc');
    expect(llamadaRpc?.payload).toEqual({
      p_tipo_lugar: 'escuela',
      p_items: [{ nombre: 'Constancia', requerido: true }],
    });
  });

  it('devuelve [] si el tipo actualizado queda sin ítems (lista vacía = vaciar la configuración)', async () => {
    configurarRpc('obra_social', 'actualizar_requisitos_actividad', () => ok(null));
    configurar('obra_social', 'requisitos_actividad', 'select', () => ok([]));

    await expect(supabaseRequisitosActividadRepository.actualizar('escuela', [])).resolves.toEqual([]);
  });

  it('lanza un error traducido si algún ítem llega sin nombre (45101)', async () => {
    configurarRpc('obra_social', 'actualizar_requisitos_actividad', () => fail({ code: '45101', message: 'nombre vacío' }));

    await expect(
      supabaseRequisitosActividadRepository.actualizar('escuela', [{ id: 't-1', nombre: '', requerido: true }]),
    ).rejects.toThrow('Todos los ítems necesitan un nombre.');
  });

  it('lanza un error traducido si el usuario no tiene permiso de escritura (42501)', async () => {
    configurarRpc('obra_social', 'actualizar_requisitos_actividad', () => fail({ code: '42501', message: 'RLS denied' }));

    await expect(supabaseRequisitosActividadRepository.actualizar('escuela', [])).rejects.toThrow(
      'No tenés permiso para modificar la documentación por tipo de actividad.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// Superficie de código fuente (mismo criterio que SupabaseObraSocialRepository.test.ts): nunca
// service_role, nunca `any`, siempre RPC para escribir (nunca INSERT directo a tipos_documento).
// -------------------------------------------------------------------------------------------

describe('SupabaseRequisitosActividadRepository — superficie de código fuente', () => {
  it('nunca usa la service_role key ni el tipo `any`', () => {
    expect(supabaseRequisitosActividadRepositorySource).not.toContain('service_role');
    expect(supabaseRequisitosActividadRepositorySource).not.toMatch(/:\s*any\b/);
  });

  it('importa el cliente compartido, nunca crea uno propio', () => {
    expect(supabaseRequisitosActividadRepositorySource).toContain("from '../supabaseClient'");
  });

  it('nunca hace un INSERT/upsert directo contra tipos_documento — solo vía la RPC (D5)', () => {
    expect(supabaseRequisitosActividadRepositorySource).not.toContain(".from('tipos_documento')");
    expect(supabaseRequisitosActividadRepositorySource).toContain('actualizar_requisitos_actividad');
  });
});
