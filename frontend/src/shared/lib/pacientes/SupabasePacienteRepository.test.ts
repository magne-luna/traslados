/// <reference types="node" />
// `?raw` no sirve para la migración: vive fuera de `frontend/` (`../../../../../supabase/`) y el
// servidor de Vite deniega `fs.allow` fuera de la raíz del proyecto (probado empíricamente — error
// "Denied ID"). Se lee con `node:fs`, tal como anticipa la tarea 3.12b. `tsconfig.app.json` no
// incluye `types: ["node"]` a propósito (código de `src/` es de navegador) — la referencia de tipos
// de abajo trae los tipos de `@types/node` solo para este archivo de test, sin tocar la config
// compartida.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, beforeEach, vi } from 'vitest';
// Import Vite `?raw` (declarado en vite/client.d.ts), mismo patrón que
// SupabaseCuentaRepository.test.ts: código fuente como string en build time.
import supabasePacienteRepositorySource from './SupabasePacienteRepository.ts?raw';
import { ensamblarPaciente } from './pacienteMapping';
import type { ActualizacionPaciente, Direccion, NuevoPaciente } from '../../types/paciente';
import { geocodificarDireccion } from '../googleMapsClient';

// Change hojas-de-ruta-geocoding (RF-701): `geocodificarDireccion` se mockea acá (nunca golpea la
// red real en un test) — cada `it` controla su propio resultado con `mockResolvedValueOnce`/
// `mockImplementation`. Default: `undefined` (mismo comportamiento que "sin API key configurada"),
// para que los tests de 3.2-3.11 que no le prestan atención al geocoding sigan pasando sin cambios.
vi.mock('../googleMapsClient', () => ({ geocodificarDireccion: vi.fn() }));
const geocodificarDireccionMock = vi.mocked(geocodificarDireccion);

// -------------------------------------------------------------------------------------------
// 3.1 — Fake tipado del subconjunto de supabase-js usado. Sin `any`, sin `as`. Registra todas las
// llamadas emitidas (para que 3.6/3.12 puedan afirmar sobre qué se llamó y qué NO se llamó).
// -------------------------------------------------------------------------------------------

interface FakeError {
  code?: string;
  message: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
  /** paginacion-listados (tasks.md 12.x): eco de `{ count: 'exact' }` de PostgREST. */
  count?: number | null;
}

type FakeOp = 'select' | 'update' | 'delete' | 'upsert' | 'insert' | 'rpc';

interface RecordedCall {
  op: FakeOp;
  schema: string;
  table: string;
  eq: Array<[string, unknown]>;
  /** paginacion-listados (tasks.md 12.x): un elemento por cada `.order()` encadenado, en orden —
   * antes era un único `{column,ascending}` porque nada encadenaba más de un `.order()`. */
  orders?: Array<{ column: string; ascending: boolean }>;
  /** paginacion-listados (tasks.md 12.6): un elemento por cada `.or(...)` encadenado (N tokens ⇒
   * N llamadas ⇒ AND de N ORs, ver construirFiltroBusqueda). */
  orFilters?: string[];
  /** paginacion-listados (tasks.md 12.1): `.range(desde, hasta)`. */
  range?: { desde: number; hasta: number };
  /** paginacion-listados (tasks.md 12.7): `.in(columna, valores)` — usado para acotar
   * `leerCoberturasBatch` a los pacientes de la página. */
  in?: Array<[string, readonly unknown[]]>;
  /** paginacion-listados (tasks.md 12.1): eco de `{ count: 'exact' }` pasado a `.select()`. */
  count?: 'exact' | 'planned' | 'estimated';
  payload?: unknown;
  onConflict?: string;
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

// paginacion-listados (tasks.md 12.1/12.5): variante de `ok` que además hace eco del `count`
// exacto que PostgREST devuelve junto a `data` cuando se pide `{ count: 'exact' }`.
function okConCount(data: unknown, count: number | null): FakeResult {
  return { data, error: null, count };
}

function configurar(schema: string, table: string, op: FakeOp, handler: Handler): void {
  handlers.set(`${schema}.${table}.${op}`, handler);
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

  in(column: string, values: readonly unknown[]): FakeSelectBuilder {
    this.call.in = [...(this.call.in ?? []), [column, values]];
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
    const rows = Array.isArray(result.data) ? result.data : [];
    return Promise.resolve({ data: rows[0] ?? null, error: result.error });
  }

  then<TResult1 = FakeResult, TResult2 = never>(
    onfulfilled?: ((value: FakeResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    calls.push(this.call);
    return Promise.resolve(resolver(this.call)).then(onfulfilled, onrejected);
  }
}

class FakeWriteBuilder implements PromiseLike<FakeResult> {
  private readonly call: RecordedCall;

  constructor(call: RecordedCall) {
    this.call = call;
  }

  eq(column: string, value: unknown): FakeWriteBuilder {
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
            select(columns: string, options?: { count?: 'exact' | 'planned' | 'estimated' }) {
              return new FakeSelectBuilder({ op: 'select', schema: schemaName, table, eq: [] }).select(columns, options);
            },
            update(payload: unknown) {
              return new FakeWriteBuilder({ op: 'update', schema: schemaName, table, eq: [], payload });
            },
            delete() {
              return new FakeWriteBuilder({ op: 'delete', schema: schemaName, table, eq: [] });
            },
            upsert(payload: unknown, options?: { onConflict?: string }) {
              return new FakeWriteBuilder({ op: 'upsert', schema: schemaName, table, eq: [], payload, onConflict: options?.onConflict });
            },
            insert(payload: unknown) {
              return new FakeWriteBuilder({ op: 'insert', schema: schemaName, table, eq: [], payload });
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

const { supabasePacienteRepository } = await import('./SupabasePacienteRepository');

beforeEach(() => {
  resetFake();
  geocodificarDireccionMock.mockReset();
  geocodificarDireccionMock.mockResolvedValue(undefined);
});

// -------------------------------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------------------------------

function filaPaciente(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'p-1',
    nombre_a: 'Juana',
    nombre_b: null,
    apellido_a: 'Pérez',
    apellido_b: null,
    fecha_nacimiento: '2015-03-01',
    dni: '40111222',
    cuil_titular: null,
    domicilio: null,
    obra_social_id: 'os-1',
    amparo_judicial: false,
    cud: [{ numero_cud: 'C-1', emision: '2023-01-01', vencimiento: '2027-01-01' }],
    clinicos: { diagnostico: 'TEA', condicion: null },
    personas_a_cargo: [
      { id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: '30111222', telefono: null, telefono_alternativo: null },
    ],
    direcciones: [{ id: 'd-1', calle: 'San Martín', numero: '123', tipo_lugar: 'domicilio' }],
    accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }],
    ...overrides,
  };
}

function buildNuevoPacienteMinimo(): NuevoPaciente {
  return {
    apellido: 'Pérez',
    nombre: 'Juana',
    fechaNacimiento: '',
    dni: '40111222',
    cuilTitular: '',
    diagnostico: '',
    accesorioMovilidad: [],
    obraSocialId: null,
    numeroAfiliado: { valor: '' },
    cud: null,
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
  };
}

function buildNuevoPacienteConAfiliado(): NuevoPaciente {
  return {
    ...buildNuevoPacienteMinimo(),
    obraSocialId: 'os-1',
    numeroAfiliado: { valor: 'AF-1' },
  };
}

// -------------------------------------------------------------------------------------------
// 3.2 — list()
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.list (3.2)', () => {
  it('devuelve los pacientes ensamblados a partir de una sola consulta con embeds', async () => {
    const filas = [filaPaciente({ id: 'p-1' }), filaPaciente({ id: 'p-2', dni: '40111333' })];
    configurar('pacientes', 'paciente', 'select', () => ok(filas));

    const resultado = await supabasePacienteRepository.list();

    expect(resultado).toEqual([ensamblarPaciente(filas[0], null), ensamblarPaciente(filas[1], null)]);
  });

  it('un listado de N pacientes no dispara una consulta por paciente (anti N+1)', async () => {
    const filas = [
      filaPaciente({ id: 'p-1' }),
      filaPaciente({ id: 'p-2', dni: '2' }),
      filaPaciente({ id: 'p-3', dni: '3' }),
    ];
    configurar('pacientes', 'paciente', 'select', () => ok(filas));
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok([]));

    await supabasePacienteRepository.list();

    const consultasPaciente = calls.filter((c) => c.schema === 'pacientes' && c.table === 'paciente' && c.op === 'select');
    const consultasCobertura = calls.filter(
      (c) => c.schema === 'obra_social' && c.table === 'coberturas_paciente' && c.op === 'select',
    );
    expect(consultasPaciente).toHaveLength(1);
    expect(consultasCobertura).toHaveLength(1);
  });

  it('enriquece numeroAfiliado.valor con una única consulta batch a coberturas_paciente', async () => {
    const filas = [filaPaciente({ id: 'p-1', obra_social_id: 'os-1' })];
    configurar('pacientes', 'paciente', 'select', () => ok(filas));
    configurar('obra_social', 'coberturas_paciente', 'select', () =>
      ok([{ paciente_id: 'p-1', obra_social_id: 'os-1', num_afiliado: 'AF-777' }]),
    );

    const [resultado] = await supabasePacienteRepository.list();

    expect(resultado?.numeroAfiliado.valor).toBe('AF-777');
  });

  it('lanza un error traducido si la consulta principal falla', async () => {
    configurar('pacientes', 'paciente', 'select', () => fail({ code: 'PGRST106', message: 'schema not exposed' }));

    await expect(supabasePacienteRepository.list()).rejects.toThrow('El módulo de Pacientes no está habilitado en el servidor.');
  });

  it('devuelve [] si la consulta principal no trae un array (defensivo)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok(null));

    await expect(supabasePacienteRepository.list()).resolves.toEqual([]);
  });

  it('con 0 pacientes no consulta coberturas (corta antes de la consulta batch)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([]));

    const resultado = await supabasePacienteRepository.list();

    expect(resultado).toEqual([]);
    expect(calls.filter((c) => c.table === 'coberturas_paciente')).toHaveLength(0);
  });

  it('degrada numeroAfiliado.valor a "" para todos si la consulta batch de coberturas falla', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'p-1', obra_social_id: 'os-1' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', () => fail({ code: '42501', message: 'no access' }));

    const [resultado] = await supabasePacienteRepository.list();

    expect(resultado?.numeroAfiliado.valor).toBe('');
  });

  it('degrada numeroAfiliado.valor a "" si la consulta batch de coberturas no devuelve un array', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'p-1', obra_social_id: 'os-1' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok(null));

    const [resultado] = await supabasePacienteRepository.list();

    expect(resultado?.numeroAfiliado.valor).toBe('');
  });

  it('ignora en silencio filas de cobertura malformadas de la consulta batch, sin romper el listado', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'p-1', obra_social_id: 'os-1' })]));
    // Mezcla de un valor no-objeto y un objeto sin las claves mínimas — ninguno debe romper el loop.
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok([42, { num_afiliado: 'AF-1' }]));

    const [resultado] = await supabasePacienteRepository.list();

    expect(resultado?.numeroAfiliado.valor).toBe('');
  });
});

// -------------------------------------------------------------------------------------------
// 3.3 — getById()
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.getById (3.3)', () => {
  it('resuelve un paciente ensamblado cuando la fila existe', async () => {
    const fila = filaPaciente();
    configurar('pacientes', 'paciente', 'select', () => ok([fila]));

    const resultado = await supabasePacienteRepository.getById('p-1');

    expect(resultado).toEqual(ensamblarPaciente(fila, null));
  });

  it('resuelve null (sin lanzar) si no hay fila para ese id', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([]));

    await expect(supabasePacienteRepository.getById('inexistente')).resolves.toBeNull();
  });

  it('resuelve null (sin lanzar) si RLS filtra la fila de un paciente que sí existe', async () => {
    // El fake modela el filtrado de RLS igual que PostgREST: 0 filas, sin `error`.
    configurar('pacientes', 'paciente', 'select', () => ok([]));

    await expect(supabasePacienteRepository.getById('existe-pero-sin-permiso')).resolves.toBeNull();
  });

  it('lanza un error traducido si la consulta falla de verdad (no es un 0-filas de RLS)', async () => {
    configurar('pacientes', 'paciente', 'select', () => fail({ code: '55000', message: 'internal error' }));

    await expect(supabasePacienteRepository.getById('p-1')).rejects.toThrow('No se pudo cargar el paciente.');
  });
});

// -------------------------------------------------------------------------------------------
// 3.4 — cobertura (D3)
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository — cobertura de obra social (3.4)', () => {
  it('getById degrada numeroAfiliado.valor a "" si la consulta de cobertura falla (sin obra_social:read)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: 'os-1' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', () => fail({ code: '42501', message: 'no access' }));

    const resultado = await supabasePacienteRepository.getById('p-1');

    expect(resultado?.numeroAfiliado.valor).toBe('');
  });

  it('getById degrada a "" si la consulta de cobertura devuelve 0 filas', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: 'os-1' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok([]));

    const resultado = await supabasePacienteRepository.getById('p-1');

    expect(resultado?.numeroAfiliado.valor).toBe('');
  });

  it('getById toma la cobertura de fecha_desde más reciente cuando hay varias', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: 'os-1' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', (call) => {
      // El repository ordena server-side: el fake solo verifica que se pidió el orden correcto.
      expect(call.orders).toEqual([{ column: 'fecha_desde', ascending: false }]);
      return ok([{ num_afiliado: 'AF-MAS-RECIENTE' }]);
    });

    const resultado = await supabasePacienteRepository.getById('p-1');

    expect(resultado?.numeroAfiliado.valor).toBe('AF-MAS-RECIENTE');
  });

  it('getById no consulta cobertura si el paciente no tiene obra social asignada', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: null })]));

    const resultado = await supabasePacienteRepository.getById('p-1');

    const consultasCobertura = calls.filter((c) => c.schema === 'obra_social' && c.table === 'coberturas_paciente');
    expect(consultasCobertura).toHaveLength(0);
    expect(resultado?.numeroAfiliado.valor).toBe('');
  });

  it('la ficha se muestra completa (sin lanzar) aunque falle la cobertura', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: 'os-1', dni: '99999999' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', () => fail({ code: '42501', message: 'no access' }));

    const resultado = await supabasePacienteRepository.getById('p-1');

    expect(resultado?.dni).toBe('99999999');
  });

  it('getById degrada a "" si la consulta de cobertura no devuelve un array (defensivo)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: 'os-1' })]));
    // Sin `error`, pero `data` no es un array — la traducción no debe romper por eso.
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok(null));

    const resultado = await supabasePacienteRepository.getById('p-1');

    expect(resultado?.numeroAfiliado.valor).toBe('');
  });
});

// -------------------------------------------------------------------------------------------
// 3.5 — mapearErrorPaciente (probado indirectamente vía list(), un test por rama de D7)
// -------------------------------------------------------------------------------------------

describe('mapeo de errores D7 (3.5)', () => {
  function esperarErrorDeList(codigo: string, mensajeEsperado: string): Promise<void> {
    configurar('pacientes', 'paciente', 'select', () => fail({ code: codigo, message: 'texto crudo de postgres, tabla xyz' }));
    return expect(supabasePacienteRepository.list()).rejects.toThrow(mensajeEsperado);
  }

  it('42501 -> falta de permiso genérica', () => esperarErrorDeList('42501', 'No tenés permiso para modificar pacientes.'));
  it('PGRST301 -> falta de permiso genérica', () => esperarErrorDeList('PGRST301', 'No tenés permiso para modificar pacientes.'));
  it('PGRST106 -> schema no expuesto', () =>
    esperarErrorDeList('PGRST106', 'El módulo de Pacientes no está habilitado en el servidor.'));
  it('PGRST202 -> función de alta no habilitada', () =>
    esperarErrorDeList('PGRST202', 'El alta de pacientes no está habilitada en el servidor todavía.'));
  it('45002 -> mensaje genérico de guardado (no expone que es un bug de payload)', () =>
    esperarErrorDeList('45002', 'No se pudo guardar el paciente.'));
  it('código desconocido -> mensaje genérico según la operación (listar)', () =>
    esperarErrorDeList('55000', 'No se pudo cargar el paciente.'));

  it('23505 nombra el DNI duplicado sin exponer texto crudo de Postgres', async () => {
    // dni duplicado en update: primero getById existente debe resolver, luego falla el update.
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));
    configurar('pacientes', 'paciente', 'update', () => fail({ code: '23505', message: 'duplicate key (dni)=(40111222)' }));

    await expect(
      supabasePacienteRepository.update('p-1', { dni: '40111222' } satisfies ActualizacionPaciente),
    ).rejects.toThrow('Ya existe un paciente con el DNI «40111222».');
  });

  it('el mensaje nunca contiene el texto crudo de Postgres (nombres de tabla/columna)', async () => {
    configurar('pacientes', 'paciente', 'select', () =>
      fail({ code: '55000', message: 'relation "pacientes.paciente" does not exist raw internal text' }),
    );

    try {
      await supabasePacienteRepository.list();
      throw new Error('debía lanzar');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      expect(mensaje).not.toContain('pacientes.paciente');
      expect(mensaje).not.toContain('relation');
    }
  });

  it('45001 nombra el accesorio ausente sin exponer el resto del texto crudo', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () =>
      fail({ code: '45001', message: 'El accesorio de movilidad «andador» no está cargado en el maestro de accesorios.' }),
    );

    await expect(supabasePacienteRepository.create(buildNuevoPacienteMinimo())).rejects.toThrow(
      'El accesorio de movilidad «andador» no está cargado en el sistema. Pedí que lo agreguen al catálogo.',
    );
  });

  it('45001 sin comillas « » en el mensaje no rompe la extracción (rama defensiva)', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => fail({ code: '45001', message: 'mensaje sin comillas' }));

    await expect(supabasePacienteRepository.create(buildNuevoPacienteMinimo())).rejects.toThrow(
      'El accesorio de movilidad «» no está cargado en el sistema. Pedí que lo agreguen al catálogo.',
    );
  });

  it('23505 en update sin dni en el payload usa cadena vacía en el mensaje (rama defensiva D7)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));
    configurar('pacientes', 'paciente', 'update', () => fail({ code: '23505', message: 'duplicate key' }));

    await expect(supabasePacienteRepository.update('p-1', { apellido: 'Otro' })).rejects.toThrow(
      'Ya existe un paciente con el DNI «».',
    );
  });

  // Regresión (2026-08-06): el upsert de `clinicos` no pasaba `onConflict: 'paciente_id'` — como
  // `clinicos_pkey` es `id` (no `paciente_id`), sin eso el upsert intentaba un INSERT en cada
  // edición posterior a la primera, chocaba contra `clinicos_paciente_id_key` (UNIQUE) con 23505,
  // y ese código se mapeaba (incorrectamente, para esta tabla) a "Ya existe un paciente con el DNI
  // «»" — un bug real reportado en producción, nada que ver con el DNI.
  it('el upsert de clinicos usa onConflict: paciente_id (evita el 23505 espurio)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));
    configurar('pacientes', 'clinicos', 'upsert', () => ok(null));

    await supabasePacienteRepository.update('p-1', { diagnostico: 'nuevo diagnóstico' });

    const upsertClinicos = calls.find((c) => c.table === 'clinicos' && c.op === 'upsert');
    expect(upsertClinicos?.onConflict).toBe('paciente_id');
  });

  // Regresión (2026-08-06): mismo patrón que clinicos — `accesorios_pacientes_pkey` es `id`, el
  // UNIQUE real es el par (paciente_id, accesorio_id).
  it('el upsert de accesorios_pacientes usa onConflict: paciente_id,accesorio_id', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ accesorios_pacientes: [] })]));
    configurar('pacientes', 'accesorios', 'select', () => ok([{ id: 'acc-1', tipo: 'silla-plegable' }]));
    configurar('pacientes', 'accesorios_pacientes', 'upsert', () => ok(null));

    await supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['silla-plegable'] });

    const upsertAccesorio = calls.find((c) => c.table === 'accesorios_pacientes' && c.op === 'upsert');
    expect(upsertAccesorio?.onConflict).toBe('paciente_id,accesorio_id');
  });

  it('23503 fuera del contexto de eliminar-dirección da el mensaje de obra social inexistente', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));
    configurar('pacientes', 'clinicos', 'upsert', () => fail({ code: '23503', message: 'fk violation' }));

    await expect(supabasePacienteRepository.update('p-1', { diagnostico: 'nuevo diagnóstico' })).rejects.toThrow(
      'La obra social seleccionada ya no existe.',
    );
  });

  it('un código desconocido durante una escritura (no listar) da el mensaje genérico de guardado', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));
    configurar('pacientes', 'direcciones', 'upsert', () => fail({ code: '55000', message: 'unexpected' }));

    await expect(
      supabasePacienteRepository.update('p-1', {
        direcciones: [{ id: 'd-new', tipo: 'domicilio', calle: 'Nueva 1', localidad: '' }],
      }),
    ).rejects.toThrow('No se pudo guardar el paciente.');
  });
});

// -------------------------------------------------------------------------------------------
// 3.6 — create() atómico (D4)
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.create (3.6)', () => {
  it('happy path: una sola llamada rpc, y devuelve el paciente releído con el id generado', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => ok('nuevo-uuid'));
    const filaCreada = filaPaciente({ id: 'nuevo-uuid' });
    configurar('pacientes', 'paciente', 'select', () => ok([filaCreada]));

    const resultado = await supabasePacienteRepository.create(buildNuevoPacienteMinimo());

    expect(resultado).toEqual(ensamblarPaciente(filaCreada, null));
  });

  it('emite exactamente una llamada rpc y CERO insert sobre paciente o tablas hijas', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => ok('nuevo-uuid'));
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'nuevo-uuid' })]));

    await supabasePacienteRepository.create(buildNuevoPacienteMinimo());

    const llamadasRpc = calls.filter((c) => c.op === 'rpc');
    const llamadasInsert = calls.filter((c) => c.op === 'insert');
    expect(llamadasRpc).toHaveLength(1);
    expect(llamadasRpc[0]?.table).toBe('crear_paciente_completo');
    expect(llamadasInsert).toHaveLength(0);
  });

  it('si la relectura posterior devuelve null, lanza (no inventa un Paciente)', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => ok('nuevo-uuid'));
    configurar('pacientes', 'paciente', 'select', () => ok([]));

    await expect(supabasePacienteRepository.create(buildNuevoPacienteMinimo())).rejects.toThrow(
      'No se pudo recuperar el paciente recién creado.',
    );
  });

  it('si la RPC no devuelve un uuid string (sin error), lanza sin intentar releer', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => ok(null));

    await expect(supabasePacienteRepository.create(buildNuevoPacienteMinimo())).rejects.toThrow(
      'No se pudo guardar el paciente.',
    );

    expect(calls.filter((c) => c.op === 'select')).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------------------------
// 3.7 — create() errores de la RPC (D4)
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.create — errores de la RPC (3.7)', () => {
  function sinBorradoCompensatorio(): void {
    expect(calls.filter((c) => c.op === 'delete')).toHaveLength(0);
  }

  it('23505 -> DNI duplicado, sin borrado compensatorio', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => fail({ code: '23505', message: 'duplicate' }));

    await expect(supabasePacienteRepository.create({ ...buildNuevoPacienteMinimo(), dni: '111' })).rejects.toThrow(
      'Ya existe un paciente con el DNI «111».',
    );
    sinBorradoCompensatorio();
  });

  it('42501 con número de afiliado cargado -> mensaje que nombra Obras Sociales', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => fail({ code: '42501', message: 'denied' }));

    await expect(supabasePacienteRepository.create(buildNuevoPacienteConAfiliado())).rejects.toThrow(
      'No tenés permiso sobre Obras Sociales para guardar el número de afiliado. El paciente no se creó.',
    );
    sinBorradoCompensatorio();
  });

  it('42501 sin número de afiliado -> mensaje de falta de permiso sobre Pacientes', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => fail({ code: '42501', message: 'denied' }));

    await expect(supabasePacienteRepository.create(buildNuevoPacienteMinimo())).rejects.toThrow(
      'No tenés permiso para modificar pacientes.',
    );
    sinBorradoCompensatorio();
  });

  it('45001 -> nombra el accesorio faltante', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () =>
      fail({ code: '45001', message: 'El accesorio de movilidad «tripode» no está cargado en el maestro de accesorios.' }),
    );

    await expect(
      supabasePacienteRepository.create({ ...buildNuevoPacienteMinimo(), accesorioMovilidad: ['tripode'] }),
    ).rejects.toThrow('El accesorio de movilidad «tripode» no está cargado en el sistema.');
    sinBorradoCompensatorio();
  });

  it('PGRST202 -> el alta no está habilitada en el servidor', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => fail({ code: 'PGRST202', message: 'function not found' }));

    await expect(supabasePacienteRepository.create(buildNuevoPacienteMinimo())).rejects.toThrow(
      'El alta de pacientes no está habilitada en el servidor todavía.',
    );
    sinBorradoCompensatorio();
  });
});

// -------------------------------------------------------------------------------------------
// 3.8 — update() diff parcial por tabla (D5)
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.update — diff parcial (3.8)', () => {
  it('una clave ausente no emite ninguna escritura sobre esa tabla (cud)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));

    await supabasePacienteRepository.update('p-1', { apellido: 'Nuevo' });

    const escriturasCud = calls.filter((c) => c.table === 'cud' && c.op !== 'select');
    expect(escriturasCud).toHaveLength(0);
  });

  it('cud: null borra las filas de CUD del paciente', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));

    await supabasePacienteRepository.update('p-1', { cud: null });

    const borrados = calls.filter((c) => c.table === 'cud' && c.op === 'delete');
    expect(borrados).toHaveLength(1);
    expect(borrados[0]?.eq).toEqual([['paciente_id', 'p-1']]);
    const upserts = calls.filter((c) => c.table === 'cud' && c.op === 'upsert');
    expect(upserts).toHaveLength(0);
  });

  it('claves de dirección/persona ausentes no tocan esas tablas', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));

    await supabasePacienteRepository.update('p-1', { apellido: 'Nuevo' });

    expect(calls.filter((c) => c.table === 'direcciones' && c.op !== 'select')).toHaveLength(0);
    expect(calls.filter((c) => c.table === 'personas_a_cargo' && c.op !== 'select')).toHaveLength(0);
  });

  it('actualiza todos los campos planos permitidos (construirCamposPaciente, todas las claves)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));

    await supabasePacienteRepository.update('p-1', {
      nombre: 'Juana',
      segundoNombre: 'Segunda',
      apellido: 'Pérez',
      segundoApellido: 'Gómez',
      fechaNacimiento: '2020-01-01',
      dni: '40999888',
      cuilTitular: '20-40111222-3',
      obraSocialId: 'os-2',
      amparoJudicial: true,
    });

    const updates = calls.filter((c) => c.table === 'paciente' && c.op === 'update');
    expect(updates).toHaveLength(1);
    expect(updates[0]?.payload).toEqual({
      nombre_a: 'Juana',
      nombre_b: 'Segunda',
      apellido_a: 'Pérez',
      apellido_b: 'Gómez',
      fecha_nacimiento: '2020-01-01',
      dni: '40999888',
      cuil_titular: '20-40111222-3',
      obra_social_id: 'os-2',
      amparo_judicial: true,
    });
  });

  it('campos opcionales vacíos se guardan como NULL, no como cadena vacía', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));

    await supabasePacienteRepository.update('p-1', {
      segundoNombre: '',
      segundoApellido: '',
      fechaNacimiento: '',
      cuilTitular: '',
    });

    const updates = calls.filter((c) => c.table === 'paciente' && c.op === 'update');
    expect(updates[0]?.payload).toEqual({
      nombre_b: null,
      apellido_b: null,
      fecha_nacimiento: null,
      cuil_titular: null,
    });
  });
});

// -------------------------------------------------------------------------------------------
// 3.9 — update() diff de colecciones preservando id
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.update — diff de colecciones (3.9)', () => {
  it('editar una dirección la actualiza por id, sin borrarla ni reinsertarla', async () => {
    const filaExistente = filaPaciente({
      direcciones: [
        { id: 'd-1', calle: 'San Martín', numero: '123', tipo_lugar: 'domicilio' },
        { id: 'd-2', calle: 'Belgrano', numero: null, tipo_lugar: 'escuela' },
      ],
    });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));

    await supabasePacienteRepository.update('p-1', {
      direcciones: [
        { id: 'd-1', tipo: 'domicilio', calle: 'San Martín 999', localidad: '' },
        { id: 'd-2', tipo: 'escuela', calle: 'Belgrano', localidad: '' },
      ],
    });

    const borrados = calls.filter((c) => c.table === 'direcciones' && c.op === 'delete');
    expect(borrados).toHaveLength(0);

    const upserts = calls.filter((c) => c.table === 'direcciones' && c.op === 'upsert');
    expect(upserts).toHaveLength(1);
    // RF-701: d-1 cambió de calle -> se reintenta geocodificar (el mock por defecto resuelve
    // `undefined` -> lat/lng viajan `null` explícito). d-2 no cambió -> lat/lng ni aparecen (el
    // upsert no debe pisar una coordenada ya guardada de una dirección sin cambios).
    expect(upserts[0]?.payload).toEqual([
      {
        id: 'd-1',
        calle: 'San Martín 999',
        numero: null,
        tipo_lugar: 'domicilio',
        localidad: '',
        descripcion: null,
        lat: null,
        lng: null,
        paciente_id: 'p-1',
      },
      { id: 'd-2', calle: 'Belgrano', numero: null, tipo_lugar: 'escuela', localidad: '', descripcion: null, paciente_id: 'p-1' },
    ]);
  });

  it('inserta las direcciones nuevas y borra las que ya no están', async () => {
    const filaExistente = filaPaciente({
      direcciones: [
        { id: 'd-1', calle: 'San Martín', numero: '123', tipo_lugar: 'domicilio' },
        { id: 'd-2', calle: 'Belgrano', numero: null, tipo_lugar: 'escuela' },
      ],
    });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));

    await supabasePacienteRepository.update('p-1', {
      direcciones: [
        { id: 'd-1', tipo: 'domicilio', calle: 'San Martín', localidad: '' },
        { id: 'd-3', tipo: 'terapia', calle: 'Nueva 456', localidad: '' },
      ],
    });

    const upserts = calls.filter((c) => c.table === 'direcciones' && c.op === 'upsert');
    expect(upserts).toHaveLength(1);
    // RF-701: d-1 llega con `calle: 'San Martín'`, distinta del `calle` combinado que devuelve
    // `parseDireccionRow` para la fila existente (`'San Martín 123'`, calle+numero) -> se
    // considera cambiada y se reintenta geocodificar (mock por defecto -> `undefined` -> null
    // explícito). d-3 es nueva -> también se geocodifica.
    expect(upserts[0]?.payload).toEqual([
      {
        id: 'd-1',
        calle: 'San Martín',
        numero: null,
        tipo_lugar: 'domicilio',
        localidad: '',
        descripcion: null,
        lat: null,
        lng: null,
        paciente_id: 'p-1',
      },
      {
        id: 'd-3',
        calle: 'Nueva 456',
        numero: null,
        tipo_lugar: 'terapia',
        localidad: '',
        descripcion: null,
        lat: null,
        lng: null,
        paciente_id: 'p-1',
      },
    ]);

    const borrados = calls.filter((c) => c.table === 'direcciones' && c.op === 'delete');
    expect(borrados).toHaveLength(1);
    expect(borrados[0]?.eq).toEqual([['id', 'd-2']]);
  });

  it('eliminar una dirección referenciada por un recorrido (23503) da un mensaje claro', async () => {
    const filaExistente = filaPaciente({
      direcciones: [{ id: 'd-1', calle: 'San Martín', numero: '123', tipo_lugar: 'domicilio' }],
    });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'direcciones', 'delete', () => fail({ code: '23503', message: 'restrict violation' }));

    await expect(supabasePacienteRepository.update('p-1', { direcciones: [] })).rejects.toThrow(
      'No se puede eliminar la dirección: hay recorridos que la usan.',
    );
  });

  it('preserva personasACargo por id igual que direcciones', async () => {
    const filaExistente = filaPaciente({
      personas_a_cargo: [
        { id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: null, telefono: null, telefono_alternativo: null },
      ],
    });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));

    await supabasePacienteRepository.update('p-1', {
      personasACargo: [{ id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: '30999888', parentesco: 'madre' }],
    });

    const upserts = calls.filter((c) => c.table === 'personas_a_cargo' && c.op === 'upsert');
    expect(upserts).toHaveLength(1);
    const borrados = calls.filter((c) => c.table === 'personas_a_cargo' && c.op === 'delete');
    expect(borrados).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------------------------
// 3.10 — update() relectura final
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.update — relectura final (3.10)', () => {
  it('devuelve lo que getById trae de la base después de escribir', async () => {
    let filaActual = filaPaciente({ apellido_a: 'Viejo' });
    configurar('pacientes', 'paciente', 'select', () => ok([filaActual]));
    configurar('pacientes', 'paciente', 'update', (call) => {
      const payload = call.payload;
      if (payload && typeof payload === 'object') {
        filaActual = { ...filaActual, ...payload };
      }
      return ok(null);
    });

    const resultado = await supabasePacienteRepository.update('p-1', { apellido: 'Nuevo' });

    expect(resultado.apellido).toBe('Nuevo');
  });

  it('lanza el mismo error que update de un id inexistente si la relectura inicial da null', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([]));

    await expect(supabasePacienteRepository.update('no-existe', { apellido: 'X' })).rejects.toThrow(
      'No existe un paciente con id "no-existe".',
    );
  });

  it('si la relectura final (después de escribir) no encuentra al paciente, lanza en vez de devolver undefined', async () => {
    let llamadas = 0;
    configurar('pacientes', 'paciente', 'select', () => {
      llamadas += 1;
      // Primera lectura (existente, antes de escribir): fila real. Relectura final: 0 filas —
      // caso límite defensivo (p. ej. RLS empezó a filtrar entre la lectura y la escritura).
      return llamadas === 1 ? ok([filaPaciente()]) : ok([]);
    });

    await expect(supabasePacienteRepository.update('p-1', { apellido: 'Nuevo' })).rejects.toThrow(
      'No se pudo recuperar el paciente actualizado.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 3.10b — update() reemplazo de CUD con datos (rama complementaria a `cud: null` de 3.8)
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.update — reemplazo de CUD con datos (3.10b)', () => {
  const cudNuevo = { numero: 'C-2', fechaEmision: '2024-01-01', fechaVencimiento: '2028-01-01' };

  it('borra el CUD existente y lo vuelve a escribir con upsert (nunca insert)', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));

    await supabasePacienteRepository.update('p-1', { cud: cudNuevo });

    const borrados = calls.filter((c) => c.table === 'cud' && c.op === 'delete');
    expect(borrados).toHaveLength(1);
    expect(borrados[0]?.eq).toEqual([['paciente_id', 'p-1']]);

    const upserts = calls.filter((c) => c.table === 'cud' && c.op === 'upsert');
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.payload).toEqual({
      paciente_id: 'p-1',
      numero_cud: 'C-2',
      emision: '2024-01-01',
      vencimiento: '2028-01-01',
    });

    const inserts = calls.filter((c) => c.table === 'cud' && c.op === 'insert');
    expect(inserts).toHaveLength(0);
  });

  it('si falla el borrado previo al reemplazo, no llega a escribir el CUD nuevo', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));
    configurar('pacientes', 'cud', 'delete', () => fail({ code: '55000', message: 'boom' }));

    await expect(supabasePacienteRepository.update('p-1', { cud: cudNuevo })).rejects.toThrow(
      'No se pudo guardar el paciente.',
    );

    expect(calls.filter((c) => c.table === 'cud' && c.op === 'upsert')).toHaveLength(0);
  });

  it('si falla el borrado al vaciar el CUD (cud: null), el error se traduce', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));
    configurar('pacientes', 'cud', 'delete', () => fail({ code: '55000', message: 'boom' }));

    await expect(supabasePacienteRepository.update('p-1', { cud: null })).rejects.toThrow(
      'No se pudo guardar el paciente.',
    );
  });

  it('si falla el upsert al reemplazar el CUD, el error se traduce', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente()]));
    configurar('pacientes', 'cud', 'upsert', () => fail({ code: '55000', message: 'boom' }));

    await expect(supabasePacienteRepository.update('p-1', { cud: cudNuevo })).rejects.toThrow(
      'No se pudo guardar el paciente.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 3.11 — update() cobertura (D3)
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.update — cobertura (3.11)', () => {
  it('sin cambio en numeroAfiliado.valor no escribe sobre coberturas_paciente', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: 'os-1' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok([{ num_afiliado: 'AF-1' }]));

    await supabasePacienteRepository.update('p-1', {
      apellido: 'Nuevo',
      numeroAfiliado: { valor: 'AF-1' },
    });

    const escrituras = calls.filter((c) => c.table === 'coberturas_paciente' && c.op !== 'select');
    expect(escrituras).toHaveLength(0);
  });

  it('escribe la cobertura cuando numeroAfiliado.valor cambió', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: 'os-1' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok([{ num_afiliado: 'AF-VIEJO' }]));

    await supabasePacienteRepository.update('p-1', {
      numeroAfiliado: { valor: 'AF-NUEVO' },
    });

    const escrituras = calls.filter((c) => c.table === 'coberturas_paciente' && c.op === 'upsert');
    expect(escrituras).toHaveLength(1);
  });

  it('rechazo de RLS al escribir la cobertura da un mensaje que nombra Obras Sociales', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ obra_social_id: 'os-1' })]));
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok([{ num_afiliado: 'AF-VIEJO' }]));
    configurar('obra_social', 'coberturas_paciente', 'upsert', () => fail({ code: '42501', message: 'denied' }));

    await expect(
      supabasePacienteRepository.update('p-1', { numeroAfiliado: { valor: 'AF-NUEVO' } }),
    ).rejects.toThrow('No tenés permiso sobre Obras Sociales para editar el número de afiliado.');
  });
});

// -------------------------------------------------------------------------------------------
// 3.9b — update() diff de accesorios de movilidad (D9 #11, aplicarDiffAccesorios/resolverAccesorioIds)
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.update — diff de accesorios de movilidad (3.9b)', () => {
  it('sin cambios en el set de accesorios no consulta el maestro ni escribe nada', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));

    await supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['andador'] });

    expect(calls.filter((c) => c.table === 'accesorios')).toHaveLength(0);
    expect(calls.filter((c) => c.table === 'accesorios_pacientes')).toHaveLength(0);
  });

  it('agregar un accesorio resuelve su id contra el maestro y hace upsert', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () =>
      ok([
        { id: 'ac-andador', tipo: 'andador' },
        { id: 'ac-tripode', tipo: 'tripode' },
      ]),
    );

    await supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['andador', 'tripode'] });

    const upserts = calls.filter((c) => c.table === 'accesorios_pacientes' && c.op === 'upsert');
    expect(upserts).toHaveLength(1);
    expect(upserts[0]?.payload).toEqual({ paciente_id: 'p-1', accesorio_id: 'ac-tripode' });
    expect(calls.filter((c) => c.table === 'accesorios_pacientes' && c.op === 'delete')).toHaveLength(0);
  });

  it('quitar un accesorio borra por paciente_id + accesorio_id', async () => {
    const filaExistente = filaPaciente({
      accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }, { accesorios: { tipo: 'tripode' } }],
    });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () =>
      ok([
        { id: 'ac-andador', tipo: 'andador' },
        { id: 'ac-tripode', tipo: 'tripode' },
      ]),
    );

    await supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['andador'] });

    const borrados = calls.filter((c) => c.table === 'accesorios_pacientes' && c.op === 'delete');
    expect(borrados).toHaveLength(1);
    expect(borrados[0]?.eq).toEqual([
      ['paciente_id', 'p-1'],
      ['accesorio_id', 'ac-tripode'],
    ]);
    expect(calls.filter((c) => c.table === 'accesorios_pacientes' && c.op === 'upsert')).toHaveLength(0);
  });

  it('agregar y quitar en la misma edición (swap) dispara ambas operaciones', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () =>
      ok([
        { id: 'ac-andador', tipo: 'andador' },
        { id: 'ac-tripode', tipo: 'tripode' },
      ]),
    );

    await supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['tripode'] });

    expect(calls.filter((c) => c.table === 'accesorios_pacientes' && c.op === 'upsert')).toHaveLength(1);
    expect(calls.filter((c) => c.table === 'accesorios_pacientes' && c.op === 'delete')).toHaveLength(1);
  });

  it('un tipo a agregar que no está en el maestro se ignora en silencio (no rompe la edición)', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () => ok([]));

    await expect(
      supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['silla-rigida'] }),
    ).resolves.toBeDefined();

    expect(calls.filter((c) => c.table === 'accesorios_pacientes')).toHaveLength(0);
  });

  it('un tipo a quitar que ya no está en el maestro se ignora en silencio (no rompe la edición)', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [{ accesorios: { tipo: 'silla-rigida' } }] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () => ok([]));

    await expect(supabasePacienteRepository.update('p-1', { accesorioMovilidad: [] })).resolves.toBeDefined();

    expect(calls.filter((c) => c.table === 'accesorios_pacientes')).toHaveLength(0);
  });

  it('si falla la consulta al maestro de accesorios, degrada sin romper la edición (ningún match)', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () => fail({ code: '42501', message: 'no access' }));

    await expect(
      supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['andador', 'tripode'] }),
    ).resolves.toBeDefined();

    expect(calls.filter((c) => c.table === 'accesorios_pacientes')).toHaveLength(0);
  });

  it('si la consulta al maestro de accesorios no devuelve un array, degrada sin romper (defensivo)', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () => ok(null));

    await expect(
      supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['andador', 'tripode'] }),
    ).resolves.toBeDefined();

    expect(calls.filter((c) => c.table === 'accesorios_pacientes')).toHaveLength(0);
  });

  it('ignora filas malformadas del maestro de accesorios sin romper la resolución del resto', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () =>
      ok([{ id: 123, tipo: 'tripode' }, { id: 'ac-andador', tipo: 'andador' }]),
    );

    await supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['andador', 'tripode'] });

    // La fila malformada (id numérico) se descarta; 'tripode' queda sin id resuelto -> se ignora.
    expect(calls.filter((c) => c.table === 'accesorios_pacientes')).toHaveLength(0);
  });

  it('si falla el upsert al agregar un accesorio, el error se traduce (D7)', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () => ok([{ id: 'ac-andador', tipo: 'andador' }]));
    configurar('pacientes', 'accesorios_pacientes', 'upsert', () => fail({ code: '55000', message: 'boom' }));

    await expect(supabasePacienteRepository.update('p-1', { accesorioMovilidad: ['andador'] })).rejects.toThrow(
      'No se pudo guardar el paciente.',
    );
  });

  it('si falla el delete al quitar un accesorio, el error se traduce (D7)', async () => {
    const filaExistente = filaPaciente({ accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }] });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistente]));
    configurar('pacientes', 'accesorios', 'select', () => ok([{ id: 'ac-andador', tipo: 'andador' }]));
    configurar('pacientes', 'accesorios_pacientes', 'delete', () => fail({ code: '55000', message: 'boom' }));

    await expect(supabasePacienteRepository.update('p-1', { accesorioMovilidad: [] })).rejects.toThrow(
      'No se pudo guardar el paciente.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 3.12 — código fuente del repository
// -------------------------------------------------------------------------------------------

describe('código fuente de SupabasePacienteRepository.ts (3.12)', () => {
  it('no contiene service_role, ni any, ni consulta modulos.permisos/modulos.modulos', () => {
    expect(supabasePacienteRepositorySource).not.toContain('service_role');
    expect(supabasePacienteRepositorySource).not.toMatch(/\bany\b/);
    expect(supabasePacienteRepositorySource).not.toContain(".from('permisos')");
    expect(supabasePacienteRepositorySource).not.toContain(".from('modulos')");
    expect(supabasePacienteRepositorySource).not.toContain("schema('modulos')");
  });

  it('importa el singleton supabase de shared/lib/supabaseClient.ts', () => {
    expect(supabasePacienteRepositorySource).toContain("from '../supabaseClient'");
  });
});

// -------------------------------------------------------------------------------------------
// 3.12b — la migración sigue declarando SECURITY INVOKER (única barrera automatizada, D4)
// -------------------------------------------------------------------------------------------

// El archivo menciona "SECURITY DEFINER" varias veces DENTRO de comentarios `--` y del literal de
// `COMMENT ON FUNCTION` (advirtiendo, en castellano, que no hay que usarlo) — eso es documentación
// deliberada (D4), no la cláusula activa. El chequeo real es que, quitando comentarios y literales
// de cadena, la única cláusula de seguridad que queda en el SQL activo es `SECURITY INVOKER`.
function quitarComentariosYStrings(sql: string): string {
  const sinComentarios = sql
    .split('\n')
    .map((linea) => {
      const idx = linea.indexOf('--');
      return idx === -1 ? linea : linea.slice(0, idx);
    })
    .join('\n');
  return sinComentarios.replace(/'(?:[^']|'')*'/g, "''");
}

describe('migración 20260730180000_crear_paciente_completo.sql (3.12b)', () => {
  it('declara SECURITY INVOKER y la cláusula activa nunca es SECURITY DEFINER', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const rutaMigracion = resolve(
      __dirname,
      '../../../../../supabase/migrations/20260730180000_crear_paciente_completo.sql',
    );
    const fuenteMigracion = readFileSync(rutaMigracion, 'utf-8');
    const codigoActivo = quitarComentariosYStrings(fuenteMigracion);

    expect(codigoActivo).toContain('SECURITY INVOKER');
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });
});

// -------------------------------------------------------------------------------------------
// 8.0 — migración 20260731130000_crear_paciente_completo_formato_afiliado.sql: bug bloqueante
// (`23502`, coberturas_paciente.formato_afiliado NOT NULL sin default nunca completado en el
// INSERT de la RPC). Barrera de texto sobre el SQL, mismo criterio que 3.12b (no hay harness para
// testear funciones de Postgres, D8/1B.5): declara SECURITY INVOKER, nunca SECURITY DEFINER, y el
// INSERT a obra_social.coberturas_paciente ahora incluye formato_afiliado.
// -------------------------------------------------------------------------------------------

describe('migración 20260731130000_crear_paciente_completo_formato_afiliado.sql (8.0)', () => {
  function leerMigracion(): string {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const ruta = resolve(
      __dirname,
      '../../../../../supabase/migrations/20260731130000_crear_paciente_completo_formato_afiliado.sql',
    );
    return readFileSync(ruta, 'utf-8');
  }

  it('declara SECURITY INVOKER y la cláusula activa nunca es SECURITY DEFINER', () => {
    const codigoActivo = quitarComentariosYStrings(leerMigracion());

    expect(codigoActivo).toContain('SECURITY INVOKER');
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });

  it('el INSERT a obra_social.coberturas_paciente incluye formato_afiliado (fix del bug 23502)', () => {
    const codigoActivo = quitarComentariosYStrings(leerMigracion());
    const inicioInsert = codigoActivo.indexOf('INSERT INTO obra_social.coberturas_paciente');
    expect(inicioInsert).toBeGreaterThanOrEqual(0);

    // La columna tiene que estar tanto en la lista de columnas como en los VALUES del mismo
    // statement (no en otro lado del archivo) — se recorta el statement completo (hasta el `;`).
    const finInsert = codigoActivo.indexOf(';', inicioInsert);
    const statement = codigoActivo.slice(inicioInsert, finInsert === -1 ? undefined : finInsert + 1);

    expect(statement).toContain('formato_afiliado');
    // No debe seguir siendo un INSERT de solo 3 columnas (regresión al bug original: la firma
    // completa antes del fix era `paciente_id, obra_social_id, num_afiliado, fecha_desde`, 4
    // columnas, ninguna formato_afiliado).
    expect(statement).toMatch(/formato_afiliado[^)]*\)\s*VALUES|VALUES[\s\S]*formato_afiliado/);
  });

  it('no toca la firma de la función (mismo nombre, mismo único argumento p_paciente jsonb)', () => {
    const codigoActivo = quitarComentariosYStrings(leerMigracion());

    expect(codigoActivo).toContain('CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo(p_paciente jsonb)');
    expect(codigoActivo).toContain('RETURNS uuid');
  });
});

// -------------------------------------------------------------------------------------------
// 8.0 — create(): bug 23502 (`coberturas_paciente.formato_afiliado` NOT NULL sin default nunca
// completado en el INSERT de la RPC, ver migración 20260731130000 y el test de texto en 8.0 más
// arriba). RF-106 (revertida D12 → vigente de nuevo): `formato_afiliado` es una propiedad de la
// obra social (`ObraSocial.formatoAfiliado`), no del paciente/cobertura — el payload de
// `toCrearPacientePayload` NUNCA manda esa clave. El NOT NULL de la columna se sigue satisfaciendo
// del lado de la base, con el propio `COALESCE(..., 'numero-documento')` de la migración — nunca
// con un valor que viaje desde el frontend.
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.create — bug 23502 formato_afiliado (tasks.md 8.0)', () => {
  it('el payload de la RPC no manda formato_afiliado: el NOT NULL se satisface del lado de la base (COALESCE de la migración), no con una clave del frontend', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => ok('nuevo-uuid'));
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'nuevo-uuid' })]));

    await expect(supabasePacienteRepository.create(buildNuevoPacienteConAfiliado())).resolves.toBeDefined();

    const llamadaRpc = calls.find((c) => c.op === 'rpc');
    const args = llamadaRpc?.payload as { p_paciente: Record<string, unknown> };
    expect(args.p_paciente).not.toHaveProperty('formato_afiliado');
  });

  it('si la base igual respondiera 23502 (defensa en profundidad), el error se traduce sin exponer texto crudo de Postgres', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () =>
      fail({
        code: '23502',
        message:
          'null value in column "formato_afiliado" of relation "coberturas_paciente" violates not-null constraint',
      }),
    );

    const error = await supabasePacienteRepository.create(buildNuevoPacienteConAfiliado()).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    const mensaje = (error as Error).message;
    expect(mensaje).toBe('No se pudo guardar el paciente.');
    expect(mensaje).not.toMatch(/coberturas_paciente|violates|not-null|formato_afiliado/i);
  });
});

// -------------------------------------------------------------------------------------------
// Geocoding de direcciones (change hojas-de-ruta-geocoding, RF-701)
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.create — geocoding de direcciones (RF-701)', () => {
  function nuevoConDireccion(overrides: Partial<Direccion> = {}): NuevoPaciente {
    return {
      ...buildNuevoPacienteMinimo(),
      direcciones: [{ id: 'd-1', tipo: 'domicilio', calle: 'Corrientes 1000', localidad: 'CABA', ...overrides }],
    };
  }

  it('geocodifica todas las direcciones del alta (todas son nuevas) y las manda en el payload de la RPC', async () => {
    geocodificarDireccionMock.mockResolvedValueOnce({ lat: -34.6, lng: -58.4 });
    configurarRpc('pacientes', 'crear_paciente_completo', () => ok('nuevo-uuid'));
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'nuevo-uuid' })]));

    await supabasePacienteRepository.create(nuevoConDireccion());

    expect(geocodificarDireccionMock).toHaveBeenCalledTimes(1);
    expect(geocodificarDireccionMock).toHaveBeenCalledWith({
      id: 'd-1',
      tipo: 'domicilio',
      calle: 'Corrientes 1000',
      localidad: 'CABA',
    });

    const rpc = calls.find((c) => c.op === 'rpc');
    const payload = (rpc?.payload as { p_paciente: { direcciones: Array<{ lat: number | null; lng: number | null }> } })
      .p_paciente;
    expect(payload.direcciones[0]).toMatchObject({ lat: -34.6, lng: -58.4 });
  });

  it('un fallo de geocoding (undefined) no bloquea el alta: lat/lng viajan null, la RPC igual se llama', async () => {
    geocodificarDireccionMock.mockResolvedValueOnce(undefined);
    configurarRpc('pacientes', 'crear_paciente_completo', () => ok('nuevo-uuid'));
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'nuevo-uuid' })]));

    await expect(supabasePacienteRepository.create(nuevoConDireccion())).resolves.toBeDefined();

    const rpc = calls.find((c) => c.op === 'rpc');
    const payload = (rpc?.payload as { p_paciente: { direcciones: Array<{ lat: number | null; lng: number | null }> } })
      .p_paciente;
    expect(payload.direcciones[0]).toMatchObject({ lat: null, lng: null });
  });

  it('un paciente sin direcciones no llama a geocodificarDireccion', async () => {
    configurarRpc('pacientes', 'crear_paciente_completo', () => ok('nuevo-uuid'));
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'nuevo-uuid' })]));

    await supabasePacienteRepository.create(buildNuevoPacienteMinimo());

    expect(geocodificarDireccionMock).not.toHaveBeenCalled();
  });
});

describe('supabasePacienteRepository.update — geocoding de direcciones (RF-701)', () => {
  function filaExistenteConDireccion(): Record<string, unknown> {
    return filaPaciente({
      direcciones: [{ id: 'd-1', calle: 'Corrientes', numero: '1000', tipo_lugar: 'domicilio', localidad: 'CABA' }],
    });
  }

  it('una dirección sin cambios (calle/localidad idénticas) NO se re-geocodifica', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistenteConDireccion()]));

    await supabasePacienteRepository.update('p-1', {
      direcciones: [{ id: 'd-1', tipo: 'domicilio', calle: 'Corrientes 1000', localidad: 'CABA' }],
    });

    expect(geocodificarDireccionMock).not.toHaveBeenCalled();
  });

  it('una dirección con calle cambiada SÍ se re-geocodifica', async () => {
    geocodificarDireccionMock.mockResolvedValueOnce({ lat: 1, lng: 2 });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistenteConDireccion()]));

    await supabasePacienteRepository.update('p-1', {
      direcciones: [{ id: 'd-1', tipo: 'domicilio', calle: 'Otra calle 500', localidad: 'CABA' }],
    });

    expect(geocodificarDireccionMock).toHaveBeenCalledTimes(1);
    expect(geocodificarDireccionMock).toHaveBeenCalledWith(
      expect.objectContaining({ calle: 'Otra calle 500', localidad: 'CABA' }),
    );

    const upsert = calls.find((c) => c.table === 'direcciones' && c.op === 'upsert');
    const payload = upsert?.payload as Array<{ lat?: number | null; lng?: number | null }>;
    expect(payload[0]).toMatchObject({ lat: 1, lng: 2 });
  });

  it('una dirección con localidad cambiada SÍ se re-geocodifica (calle igual)', async () => {
    geocodificarDireccionMock.mockResolvedValueOnce({ lat: 3, lng: 4 });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistenteConDireccion()]));

    await supabasePacienteRepository.update('p-1', {
      direcciones: [{ id: 'd-1', tipo: 'domicilio', calle: 'Corrientes 1000', localidad: 'Vicente López' }],
    });

    expect(geocodificarDireccionMock).toHaveBeenCalledTimes(1);
  });

  it('un fallo de geocoding en update no bloquea el guardado: la dirección se guarda con lat/lng null', async () => {
    geocodificarDireccionMock.mockResolvedValueOnce(undefined);
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistenteConDireccion()]));

    const resultado = await supabasePacienteRepository.update('p-1', {
      direcciones: [{ id: 'd-1', tipo: 'domicilio', calle: 'Cambiada 1', localidad: 'CABA' }],
    });

    expect(resultado).toBeDefined();
    const upsert = calls.find((c) => c.table === 'direcciones' && c.op === 'upsert');
    const payload = upsert?.payload as Array<{ lat?: number | null; lng?: number | null }>;
    expect(payload[0]).toMatchObject({ lat: null, lng: null });
  });

  it('una dirección nueva agregada junto a una sin cambios: solo la nueva se geocodifica', async () => {
    geocodificarDireccionMock.mockResolvedValueOnce({ lat: 9, lng: 8 });
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistenteConDireccion()]));

    await supabasePacienteRepository.update('p-1', {
      direcciones: [
        { id: 'd-1', tipo: 'domicilio', calle: 'Corrientes 1000', localidad: 'CABA' },
        { id: 'd-nueva', tipo: 'terapia', calle: 'Terapia 200', localidad: 'CABA' },
      ],
    });

    expect(geocodificarDireccionMock).toHaveBeenCalledTimes(1);
    expect(geocodificarDireccionMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'd-nueva', calle: 'Terapia 200' }),
    );

    const upsert = calls.find((c) => c.table === 'direcciones' && c.op === 'upsert');
    const payload = upsert?.payload as Array<{ id: string; lat?: number | null; lng?: number | null }>;
    const filaSinCambios = payload.find((fila) => fila.id === 'd-1');
    const filaNueva = payload.find((fila) => fila.id === 'd-nueva');
    expect(filaSinCambios).not.toHaveProperty('lat');
    expect(filaNueva).toMatchObject({ lat: 9, lng: 8 });
  });

  it('sin cambio en direcciones (clave ausente del payload) no llama a geocodificarDireccion', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaExistenteConDireccion()]));

    await supabasePacienteRepository.update('p-1', { apellido: 'Otro' });

    expect(geocodificarDireccionMock).not.toHaveBeenCalled();
  });
});

// -------------------------------------------------------------------------------------------
// migración 20260805140000_direcciones_geocoding.sql — barrera de texto (mismo criterio que 3.12b
// y 8.0: no hay harness para ejecutar funciones de Postgres, se valida el SQL activo).
// -------------------------------------------------------------------------------------------

describe('migración 20260805140000_direcciones_geocoding.sql', () => {
  function leerMigracionGeocoding(): string {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const ruta = resolve(__dirname, '../../../../../supabase/migrations/20260805140000_direcciones_geocoding.sql');
    return readFileSync(ruta, 'utf-8');
  }

  it('agrega lat/lng como columnas nuevas de pacientes.direcciones', () => {
    const sql = leerMigracionGeocoding();

    expect(sql).toContain('ALTER TABLE pacientes.direcciones');
    expect(sql).toMatch(/ADD COLUMN lat DOUBLE PRECISION/i);
    expect(sql).toMatch(/ADD COLUMN lng DOUBLE PRECISION/i);
  });

  it('declara SECURITY INVOKER y la cláusula activa nunca es SECURITY DEFINER', () => {
    const codigoActivo = quitarComentariosYStrings(leerMigracionGeocoding());

    expect(codigoActivo).toContain('SECURITY INVOKER');
    expect(codigoActivo).not.toContain('SECURITY DEFINER');
  });

  it('el INSERT a pacientes.direcciones del paso 4 incluye lat y lng', () => {
    const codigoActivo = quitarComentariosYStrings(leerMigracionGeocoding());
    const inicioInsert = codigoActivo.indexOf('INSERT INTO pacientes.direcciones');
    expect(inicioInsert).toBeGreaterThanOrEqual(0);

    const finInsert = codigoActivo.indexOf(';', inicioInsert);
    const statement = codigoActivo.slice(inicioInsert, finInsert === -1 ? undefined : finInsert + 1);

    expect(statement).toContain('lat');
    expect(statement).toContain('lng');
  });

  it('no toca la firma de la función (mismo nombre, mismo único argumento p_paciente jsonb)', () => {
    const codigoActivo = quitarComentariosYStrings(leerMigracionGeocoding());

    expect(codigoActivo).toContain('CREATE OR REPLACE FUNCTION pacientes.crear_paciente_completo(p_paciente jsonb)');
    expect(codigoActivo).toContain('RETURNS uuid');
  });
});

// -------------------------------------------------------------------------------------------
// listPage (paginacion-listados, tasks.md 12.x). Aditivo — `list()` (arriba, 3.2) queda
// intacto: sin `.order()`, sin `.range()`, sin `count`, misma consulta de siempre.
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.listPage (12.x)', () => {
  it('12.1 emite .range(0, 19) y pide { count: "exact" } para página 1 tamaño 20', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([], 0));

    await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    const consulta = calls.find((c) => c.schema === 'pacientes' && c.table === 'paciente' && c.op === 'select');
    expect(consulta?.range).toEqual({ desde: 0, hasta: 19 });
    expect(consulta?.count).toBe('exact');
  });

  it('12.3 encadena order(apellido_a), order(nombre_a) y order(id) como desempate', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([], 0));

    await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    const consulta = calls.find((c) => c.schema === 'pacientes' && c.table === 'paciente' && c.op === 'select');
    expect(consulta?.orders).toEqual([
      { column: 'apellido_a', ascending: true },
      { column: 'nombre_a', ascending: true },
      { column: 'id', ascending: true },
    ]);
  });

  it('12.4 dos páginas consecutivas piden rangos sin solapamiento sobre un conjunto fijo', async () => {
    const filas = [filaPaciente({ id: 'p-1' }), filaPaciente({ id: 'p-2', dni: '2' }), filaPaciente({ id: 'p-3', dni: '3' })];
    configurar('pacientes', 'paciente', 'select', (call) => {
      const rango = call.range;
      if (!rango) return okConCount([], 0);
      return okConCount(filas.slice(rango.desde, rango.hasta + 1), filas.length);
    });

    const p1 = await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 2, filtros: { busqueda: '' } });
    const p2 = await supabasePacienteRepository.listPage({ pagina: 2, tamanio: 2, filtros: { busqueda: '' } });

    const idsP1 = new Set(p1.items.map((p) => p.id));
    const idsP2 = new Set(p2.items.map((p) => p.id));
    expect([...idsP1].some((id) => idsP2.has(id))).toBe(false);
    expect(idsP1.size + idsP2.size).toBe(3);
  });

  it('12.5 propaga el count de PostgREST a Pagina.total (no es items.length)', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([filaPaciente({ id: 'p-1' })], 47));

    const pagina = await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    expect(pagina.total).toBe(47);
    expect(pagina.items).toHaveLength(1);
  });

  it('12.5 count null (degradación defensiva) se propaga como 0, nunca NaN/undefined', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([], null));

    const pagina = await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    expect(pagina.total).toBe(0);
  });

  it('12.6 sin término de búsqueda no emite ningún .or(...)', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([], 0));

    await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    const consulta = calls.find((c) => c.schema === 'pacientes' && c.table === 'paciente' && c.op === 'select');
    expect(consulta?.orFilters ?? []).toHaveLength(0);
  });

  it('12.6 un término de una palabra emite un .or(...) sobre nombre_a, nombre_b, apellido_a, apellido_b, dni', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([], 0));

    await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: 'perez' } });

    const consulta = calls.find((c) => c.schema === 'pacientes' && c.table === 'paciente' && c.op === 'select');
    expect(consulta?.orFilters).toHaveLength(1);
    const expresion = consulta?.orFilters?.[0] ?? '';
    expect(expresion).toContain('nombre_a.ilike');
    expect(expresion).toContain('nombre_b.ilike');
    expect(expresion).toContain('apellido_a.ilike');
    expect(expresion).toContain('apellido_b.ilike');
    expect(expresion).toContain('dni.ilike');
  });

  it('12.6 un término de dos palabras emite dos .or(...) (AND de dos ORs)', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([], 0));

    await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: 'juan perez' } });

    const consulta = calls.find((c) => c.schema === 'pacientes' && c.table === 'paciente' && c.op === 'select');
    expect(consulta?.orFilters).toHaveLength(2);
  });

  it('12.7 leerCoberturasBatch se acota a los ids de la página con .in(paciente_id, ids)', async () => {
    const filas = [filaPaciente({ id: 'p-1', obra_social_id: 'os-1' }), filaPaciente({ id: 'p-2', dni: '2', obra_social_id: 'os-1' })];
    configurar('pacientes', 'paciente', 'select', () => okConCount(filas, 2));
    configurar('obra_social', 'coberturas_paciente', 'select', () => ok([]));

    await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    const consultaCobertura = calls.find((c) => c.schema === 'obra_social' && c.table === 'coberturas_paciente');
    expect(consultaCobertura?.in).toEqual([['paciente_id', ['p-1', 'p-2']]]);
  });

  it('12.7 con 0 pacientes en la página no consulta coberturas (corta antes, igual que list())', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([], 0));

    await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    expect(calls.filter((c) => c.table === 'coberturas_paciente')).toHaveLength(0);
  });

  it('12.7 enriquece numeroAfiliado.valor con la cobertura acotada de la página', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([filaPaciente({ id: 'p-1', obra_social_id: 'os-1' })], 1));
    configurar('obra_social', 'coberturas_paciente', 'select', () =>
      ok([{ paciente_id: 'p-1', obra_social_id: 'os-1', num_afiliado: 'AF-PAGINA' }]),
    );

    const pagina = await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    expect(pagina.items[0]?.numeroAfiliado.valor).toBe('AF-PAGINA');
  });

  it('12.8 un error de PostgREST se traduce con mapearErrorPaciente (nunca el texto crudo)', async () => {
    configurar('pacientes', 'paciente', 'select', () => fail({ code: 'PGRST106', message: 'schema not exposed' }));

    await expect(
      supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } }),
    ).rejects.toThrow('El módulo de Pacientes no está habilitado en el servidor.');
  });

  it('12.8 un código desconocido da el mensaje genérico de listar, no el texto crudo de Postgres', async () => {
    configurar('pacientes', 'paciente', 'select', () =>
      fail({ code: '55000', message: 'relation "pacientes.paciente" does not exist raw internal text' }),
    );

    try {
      await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
      throw new Error('debía lanzar');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      expect(mensaje).toBe('No se pudo cargar el paciente.');
      expect(mensaje).not.toContain('pacientes.paciente');
    }
  });

  it('devuelve items vacío (defensivo) si la consulta principal no trae un array', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount(null, 0));

    const pagina = await supabasePacienteRepository.listPage({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });

    expect(pagina.items).toEqual([]);
  });

  it('eco de pagina/tamanio pedidos en la Pagina<T> devuelta', async () => {
    configurar('pacientes', 'paciente', 'select', () => okConCount([], 0));

    const pagina = await supabasePacienteRepository.listPage({ pagina: 3, tamanio: 10, filtros: { busqueda: '' } });

    expect(pagina.pagina).toBe(3);
    expect(pagina.tamanio).toBe(10);
  });
});

// -------------------------------------------------------------------------------------------
// list() sigue intacto tras agregar listPage (paginacion-listados, tasks.md 12.9 REFACTOR):
// mismo criterio que el resto de la suite de list() (3.2) — sin .order(), sin .range(), sin
// count. Regresión explícita: si el refactor que comparte código entre list() y listPage()
// alguna vez le cuela un .order()/.range() a list(), este test lo detecta.
// -------------------------------------------------------------------------------------------

describe('supabasePacienteRepository.list — sigue sin paginar tras agregar listPage (12.9)', () => {
  it('list() no emite .order(), .range() ni pide count', async () => {
    configurar('pacientes', 'paciente', 'select', () => ok([filaPaciente({ id: 'p-1' })]));

    await supabasePacienteRepository.list();

    const consulta = calls.find((c) => c.schema === 'pacientes' && c.table === 'paciente' && c.op === 'select');
    expect(consulta?.orders ?? []).toHaveLength(0);
    expect(consulta?.range).toBeUndefined();
    expect(consulta?.count).toBeUndefined();
  });
});

