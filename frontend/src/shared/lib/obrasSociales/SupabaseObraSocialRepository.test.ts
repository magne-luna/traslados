import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import Vite `?raw` (declarado en vite/client.d.ts), mismo patrón que
// SupabasePacienteRepository.test.ts: código fuente como string en build time.
import supabaseObraSocialRepositorySource from './SupabaseObraSocialRepository.ts?raw';
import { ensamblarObraSocial } from './obraSocialMapping';
import type { NuevaObraSocial } from '../../types/obraSocial';

// -------------------------------------------------------------------------------------------
// 4.1 — Fake tipado del subconjunto de supabase-js usado. Sin `any`, sin `as`. Registra todas las
// llamadas emitidas (para que 4.2/4.5 puedan afirmar sobre qué se llamó y qué NO se llamó). Mismo
// molde que `SupabasePacienteRepository.test.ts` (a su vez siguiendo a `SupabaseCuentaRepository`),
// recortado a lo que este repository usa: `select().eq().maybeSingle()` y `rpc()` — no hace falta
// `.order()` (D5: todo va en un único schema, sin segunda consulta).
// -------------------------------------------------------------------------------------------

interface FakeError {
  code?: string;
  message: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

type FakeOp = 'select' | 'rpc' | 'insert' | 'update' | 'delete' | 'upsert';

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

  select(_columns: string): FakeSelectBuilder {
    return this;
  }

  eq(column: string, value: unknown): FakeSelectBuilder {
    this.call.eq.push([column, value]);
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
              calls.push({ op: 'insert', schema: schemaName, table, eq: [], payload });
              return Promise.resolve(resolver({ op: 'insert', schema: schemaName, table, eq: [], payload }));
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

const { supabaseObraSocialRepository } = await import('./SupabaseObraSocialRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------------------------------

function filaObraSocial(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'os-1',
    razon_social: 'OSECAC',
    cuit: '30-54155200-6',
    codigo: null,
    direccion: null,
    telefono: null,
    condicion_iva: null,
    tipo_comprobante: 'A',
    plazo_cobro_dias: 90,
    modalidad_facturacion: 'por-prestacion',
    admite_pagos_parciales: false,
    identificador_origen: 'paciente.numeroAfiliado',
    requisitos_os: [{ id: 'r-1', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'RHC' } }],
    plantilla_campo: [],
    ...overrides,
  };
}

function nuevaObraSocialMinima(): NuevaObraSocial {
  return {
    nombre: 'Swiss Medical',
    cuit: '30-11111111-1',
    plazoCobroDias: 90,
    tipoComprobante: 'A',
    modalidadFacturacion: 'por-prestacion',
    admitePagosParciales: false,
    checklist: [],
    plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
  };
}

// -------------------------------------------------------------------------------------------
// 4.2 — list()
// -------------------------------------------------------------------------------------------

describe('supabaseObraSocialRepository.list (4.2)', () => {
  it('devuelve las obras sociales ensambladas a partir de una sola consulta con embeds de dos niveles', async () => {
    const filas = [filaObraSocial({ id: 'os-1' }), filaObraSocial({ id: 'os-2', razon_social: 'Swiss Medical' })];
    configurar('obra_social', 'obra_social', 'select', () => ok(filas));

    const resultado = await supabaseObraSocialRepository.list();

    expect(resultado).toEqual([ensamblarObraSocial(filas[0]), ensamblarObraSocial(filas[1])]);
  });

  it('un listado de 3 obras sociales dispara una sola consulta (anti N+1)', async () => {
    configurar('obra_social', 'obra_social', 'select', () =>
      ok([filaObraSocial({ id: 'os-1' }), filaObraSocial({ id: 'os-2' }), filaObraSocial({ id: 'os-3' })]),
    );

    await supabaseObraSocialRepository.list();

    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1);
  });

  it('devuelve [] si la consulta no trae un array (defensivo)', async () => {
    configurar('obra_social', 'obra_social', 'select', () => ok(null));

    await expect(supabaseObraSocialRepository.list()).resolves.toEqual([]);
  });

  it('lanza un error traducido si la consulta falla', async () => {
    configurar('obra_social', 'obra_social', 'select', () => fail({ code: 'PGRST106', message: 'schema not exposed' }));

    await expect(supabaseObraSocialRepository.list()).rejects.toThrow(
      'El módulo de Obras Sociales no está habilitado en el servidor.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 4.3 — getById()
// -------------------------------------------------------------------------------------------

describe('supabaseObraSocialRepository.getById (4.3)', () => {
  it('resuelve una obra social ensamblada cuando la fila existe', async () => {
    const fila = filaObraSocial();
    configurar('obra_social', 'obra_social', 'select', () => ok([fila]));

    const resultado = await supabaseObraSocialRepository.getById('os-1');

    expect(resultado).toEqual(ensamblarObraSocial(fila));
  });

  it('resuelve null (sin lanzar) si no hay fila con ese id', async () => {
    configurar('obra_social', 'obra_social', 'select', () => ok([]));

    await expect(supabaseObraSocialRepository.getById('no-existe')).resolves.toBeNull();
  });

  it('resuelve null (sin lanzar) si RLS filtra la fila de una obra social que sí existe', async () => {
    // Indistinguible desde el cliente del caso "no existe" — mismo contrato que
    // `SupabasePacienteRepository`, deliberado (D5).
    configurar('obra_social', 'obra_social', 'select', () => ok([]));

    await expect(supabaseObraSocialRepository.getById('existe-sin-permiso')).resolves.toBeNull();
  });

  it('lanza un error traducido si la consulta falla de verdad (no un 0-filas de RLS)', async () => {
    configurar('obra_social', 'obra_social', 'select', () => fail({ code: '55000', message: 'internal error' }));

    await expect(supabaseObraSocialRepository.getById('os-1')).rejects.toThrow(
      'No se pudo cargar la obra social.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 4.4 — mapearErrorObraSocial (D7), un test por rama + no-filtra-texto-crudo
// -------------------------------------------------------------------------------------------

describe('mapeo de errores D7 (4.4)', () => {
  function esperarErrorDeList(codigo: string, mensajeEsperado: string): Promise<void> {
    configurar('obra_social', 'obra_social', 'select', () => fail({ code: codigo, message: 'texto crudo de postgres' }));
    return expect(supabaseObraSocialRepository.list()).rejects.toThrow(mensajeEsperado);
  }

  it('42501 -> falta de permiso genérica', () =>
    esperarErrorDeList('42501', 'No tenés permiso para modificar obras sociales.'));
  it('PGRST301 -> falta de permiso genérica', () =>
    esperarErrorDeList('PGRST301', 'No tenés permiso para modificar obras sociales.'));
  it('PGRST106 -> schema no expuesto', () =>
    esperarErrorDeList('PGRST106', 'El módulo de Obras Sociales no está habilitado en el servidor.'));
  it('PGRST202 -> el alta no está habilitada en el servidor', () =>
    esperarErrorDeList('PGRST202', 'El alta de obras sociales no está habilitada en el servidor todavía.'));
  it('PGRST204 -> la configuración de facturación no está habilitada en el servidor', () =>
    esperarErrorDeList('PGRST204', 'La configuración de facturación no está habilitada en el servidor todavía.'));
  it('45102 -> mensaje genérico de guardado (no expone que es un bug de payload)', () =>
    esperarErrorDeList('45102', 'No se pudo guardar la obra social.'));
  it('código desconocido -> mensaje genérico según la operación (listar)', () =>
    esperarErrorDeList('55000', 'No se pudo cargar la obra social.'));

  it('23505 sobre cuit nombra el CUIT duplicado', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () =>
      fail({ code: '23505', message: 'duplicate key value violates unique constraint "obra_social_cuit_key"' }),
    );

    await expect(
      supabaseObraSocialRepository.create({ ...nuevaObraSocialMinima(), cuit: '30-11111111-1' }),
    ).rejects.toThrow('Ya existe una obra social con el CUIT «30-11111111-1».');
  });

  it('23505 sobre tipos_documento.tipo da el mensaje de tipo de documento duplicado', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () =>
      fail({ code: '23505', message: 'duplicate key value violates unique constraint "tipos_documento_tipo_key"' }),
    );

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'Ya existe un tipo de documento con ese nombre.',
    );
  });

  it('23503 (documento de paciente que usa el tipo) da el mensaje de restricción', async () => {
    configurarRpc('obra_social', 'actualizar_obra_social_completa', () =>
      fail({ code: '23503', message: 'update or delete violates foreign key constraint' }),
    );
    configurar('obra_social', 'obra_social', 'select', () => ok([filaObraSocial()]));

    await expect(supabaseObraSocialRepository.update('os-1', { checklist: [] })).rejects.toThrow(
      'No se puede quitar ese ítem: hay documentos de pacientes que lo usan.',
    );
  });

  it('45101 -> todos los ítems del checklist necesitan un nombre', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () =>
      fail({ code: '45101', message: 'checklist item sin nombre' }),
    );

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'Todos los ítems del checklist necesitan un nombre.',
    );
  });

  it('45103 -> mensaje idéntico al del mock, usando el id que ya conoce el repository', async () => {
    configurarRpc('obra_social', 'actualizar_obra_social_completa', () =>
      fail({ code: '45103', message: 'no existe' }),
    );

    await expect(supabaseObraSocialRepository.update('no-existe', { nombre: 'X' })).rejects.toThrow(
      'No existe una obra social con id "no-existe".',
    );
  });

  it('el mensaje nunca contiene el texto crudo de Postgres', async () => {
    configurar('obra_social', 'obra_social', 'select', () =>
      fail({ code: '55000', message: 'relation "obra_social.obra_social" does not exist raw internal text' }),
    );

    try {
      await supabaseObraSocialRepository.list();
      throw new Error('debía lanzar');
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      expect(mensaje).not.toContain('obra_social.obra_social');
      expect(mensaje).not.toContain('relation');
    }
  });
});

// -------------------------------------------------------------------------------------------
// 4.5 — create() atómico
// -------------------------------------------------------------------------------------------

describe('supabaseObraSocialRepository.create (4.5)', () => {
  it('happy path: devuelve la obra social releída con el id generado por la base', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () => ok('nuevo-uuid'));
    const filaCreada = filaObraSocial({ id: 'nuevo-uuid' });
    configurar('obra_social', 'obra_social', 'select', () => ok([filaCreada]));

    const resultado = await supabaseObraSocialRepository.create(nuevaObraSocialMinima());

    expect(resultado).toEqual(ensamblarObraSocial(filaCreada));
  });

  it('emite exactamente una llamada rpc y CERO insert sobre las cuatro tablas', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () => ok('nuevo-uuid'));
    configurar('obra_social', 'obra_social', 'select', () => ok([filaObraSocial({ id: 'nuevo-uuid' })]));

    await supabaseObraSocialRepository.create(nuevaObraSocialMinima());

    const rpcs = calls.filter((c) => c.op === 'rpc');
    const inserts = calls.filter((c) => c.op === 'insert');
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]?.table).toBe('crear_obra_social_completa');
    expect(inserts).toHaveLength(0);
  });

  it('si la relectura posterior devuelve null, lanza (no inventa una ObraSocial)', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () => ok('nuevo-uuid'));
    configurar('obra_social', 'obra_social', 'select', () => ok([]));

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'No se pudo recuperar la obra social recién creada.',
    );
  });

  it('si la RPC no devuelve un uuid string (sin error), lanza sin intentar releer', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () => ok(null));

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'No se pudo guardar la obra social.',
    );
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------------------------
// 4.6 — create() errores de la RPC (sin borrado compensatorio)
// -------------------------------------------------------------------------------------------

describe('supabaseObraSocialRepository.create — errores de la RPC (4.6)', () => {
  function sinBorradoCompensatorio(): void {
    expect(calls.filter((c) => c.op === 'delete')).toHaveLength(0);
  }

  it('23505 sobre cuit -> mensaje, sin borrado compensatorio', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () =>
      fail({ code: '23505', message: 'duplicate key value violates unique constraint "obra_social_cuit_key"' }),
    );

    await expect(
      supabaseObraSocialRepository.create({ ...nuevaObraSocialMinima(), cuit: '30-99999999-9' }),
    ).rejects.toThrow('Ya existe una obra social con el CUIT «30-99999999-9».');
    sinBorradoCompensatorio();
  });

  it('42501 -> falta de permiso, sin borrado compensatorio', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () => fail({ code: '42501', message: 'denied' }));

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'No tenés permiso para modificar obras sociales.',
    );
    sinBorradoCompensatorio();
  });

  it('45101 -> ítem del checklist sin nombre, sin borrado compensatorio', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () => fail({ code: '45101', message: 'sin nombre' }));

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'Todos los ítems del checklist necesitan un nombre.',
    );
    sinBorradoCompensatorio();
  });

  it('45102 -> mensaje genérico de guardado, sin borrado compensatorio', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () => fail({ code: '45102', message: 'payload' }));

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'No se pudo guardar la obra social.',
    );
    sinBorradoCompensatorio();
  });

  it('PGRST202 -> el alta no está habilitada en el servidor', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () =>
      fail({ code: 'PGRST202', message: 'function not found' }),
    );

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'El alta de obras sociales no está habilitada en el servidor todavía.',
    );
    sinBorradoCompensatorio();
  });

  it('PGRST204 -> la configuración de facturación no está habilitada', async () => {
    configurarRpc('obra_social', 'crear_obra_social_completa', () =>
      fail({ code: 'PGRST204', message: 'column not found' }),
    );

    await expect(supabaseObraSocialRepository.create(nuevaObraSocialMinima())).rejects.toThrow(
      'La configuración de facturación no está habilitada en el servidor todavía.',
    );
    sinBorradoCompensatorio();
  });
});

// -------------------------------------------------------------------------------------------
// 4.7 — update()
// -------------------------------------------------------------------------------------------

describe('supabaseObraSocialRepository.update (4.7)', () => {
  it('una clave ausente en cambios no viaja en el payload de la rpc', async () => {
    configurar('obra_social', 'obra_social', 'select', () => ok([filaObraSocial()]));
    configurarRpc('obra_social', 'actualizar_obra_social_completa', () => ok('os-1'));

    await supabaseObraSocialRepository.update('os-1', { nombre: 'Nuevo nombre' });

    const rpc = calls.find((c) => c.op === 'rpc');
    const payload = rpc?.payload as { p_cambios: Record<string, unknown> } | undefined;
    expect(payload?.p_cambios).toEqual({ razon_social: 'Nuevo nombre' });
  });

  it('checklist: [] SÍ viaja en el payload de la rpc', async () => {
    configurar('obra_social', 'obra_social', 'select', () => ok([filaObraSocial()]));
    configurarRpc('obra_social', 'actualizar_obra_social_completa', () => ok('os-1'));

    await supabaseObraSocialRepository.update('os-1', { checklist: [] });

    const rpc = calls.find((c) => c.op === 'rpc');
    const payload = rpc?.payload as { p_cambios: Record<string, unknown> } | undefined;
    expect(payload?.p_cambios).toEqual({ checklist: [] });
  });

  it('45103 -> mensaje idéntico al del mock', async () => {
    configurarRpc('obra_social', 'actualizar_obra_social_completa', () => fail({ code: '45103', message: 'no existe' }));

    await expect(supabaseObraSocialRepository.update('inexistente', { nombre: 'X' })).rejects.toThrow(
      'No existe una obra social con id "inexistente".',
    );
  });

  it('relectura null -> lanza (no devuelve una ObraSocial inventada)', async () => {
    configurarRpc('obra_social', 'actualizar_obra_social_completa', () => ok('os-1'));
    configurar('obra_social', 'obra_social', 'select', () => ok([]));

    await expect(supabaseObraSocialRepository.update('os-1', { nombre: 'X' })).rejects.toThrow(
      'No se pudo recuperar la obra social actualizada.',
    );
  });

  it('emite exactamente una llamada rpc', async () => {
    configurar('obra_social', 'obra_social', 'select', () => ok([filaObraSocial()]));
    configurarRpc('obra_social', 'actualizar_obra_social_completa', () => ok('os-1'));

    await supabaseObraSocialRepository.update('os-1', { nombre: 'X' });

    expect(calls.filter((c) => c.op === 'rpc')).toHaveLength(1);
  });

  it('si la RPC no devuelve un uuid string (sin error), lanza sin intentar releer', async () => {
    configurarRpc('obra_social', 'actualizar_obra_social_completa', () => ok(null));

    await expect(supabaseObraSocialRepository.update('os-1', { nombre: 'X' })).rejects.toThrow(
      'No se pudo guardar la obra social.',
    );
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------------------------
// 4.8 — código fuente del repository
// -------------------------------------------------------------------------------------------

describe('código fuente de SupabaseObraSocialRepository.ts (4.8)', () => {
  it('no contiene service_role, ni any, ni consulta modulos.permisos/modulos.modulos', () => {
    expect(supabaseObraSocialRepositorySource).not.toContain('service_role');
    expect(supabaseObraSocialRepositorySource).not.toMatch(/\bany\b/);
    expect(supabaseObraSocialRepositorySource).not.toContain(".from('permisos')");
    expect(supabaseObraSocialRepositorySource).not.toContain(".from('modulos')");
    expect(supabaseObraSocialRepositorySource).not.toContain("schema('modulos')");
  });

  it('importa el singleton supabase de shared/lib/supabaseClient.ts', () => {
    expect(supabaseObraSocialRepositorySource).toContain("from '../supabaseClient'");
  });
});
