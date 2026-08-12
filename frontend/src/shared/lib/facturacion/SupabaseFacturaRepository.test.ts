/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensamblarFactura } from './facturaMapping';
import type { ActualizacionFactura, NuevaFactura } from '../../types/factura';

// -------------------------------------------------------------------------------------------
// 3.1 — Fake tipado del subconjunto de supabase-js usado (cero `any`, cero `as`). Registra cada
// llamada emitida para poder afirmar sobre el NÚMERO de llamadas (anti N+1, D5) y sobre qué NO se
// llamó (D4: ningún `.insert()` directo sobre `asistencia_prestacion`). Mismo molde que
// `SupabaseObraSocialRepository.test.ts`, recortado al subconjunto real: `schema`, `from`,
// `select`, `eq`, `maybeSingle`, `rpc`, `insert`, `delete`.
// -------------------------------------------------------------------------------------------

interface FakeError {
  code?: string;
  message: string;
}

interface FakeResult {
  data: unknown;
  error: FakeError | null;
}

type FakeOp = 'select' | 'rpc' | 'insert' | 'delete';

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
              const call: RecordedCall = { op: 'insert', schema: schemaName, table, eq: [], payload };
              calls.push(call);
              return Promise.resolve(resolver(call));
            },
            delete() {
              const call: RecordedCall = { op: 'delete', schema: schemaName, table, eq: [] };
              return {
                eq(column: string, value: unknown) {
                  call.eq.push([column, value]);
                  calls.push(call);
                  return Promise.resolve(resolver(call));
                },
              };
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

const { supabaseFacturaRepository } = await import('./SupabaseFacturaRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// Fixtures
// -------------------------------------------------------------------------------------------

function filaFactura(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'f-1',
    paciente_id: 'p-1',
    descripcion: 'Traslados agosto',
    dias: 20,
    valor_km: 150,
    monto: 30000,
    estado: 'a facturar',
    fecha_init: '2026-08-01',
    fecha_tope: '2026-08-31',
    tipo: 'A',
    cantidad_km: 200,
    fecha_estimada_cobro: null,
    fecha_factura: null,
    prestacion: 'Kinesiología',
    mes_facturado: 8,
    anio_facturado: 2026,
    dependencia_y_retorno: 'Sí',
    domicilio_id: 'dom-1',
    identificador_origen: null,
    identificador_valor: null,
    asistencia_prestacion: [{ id: 'a-1', fecha: '2026-08-01', prestacion: 'Kinesiología', dependencia: null, retorno: null, factura_sabados: false }],
    ...overrides,
  };
}

function nuevaFacturaMinima(): NuevaFactura {
  return {
    pacienteId: 'p-1',
    descripcion: 'Traslados agosto',
    dias: 20,
    valorKm: 150,
    monto: 30000,
    estado: 'a-facturar',
    fechaInicial: '2026-08-01',
    fechaTope: '2026-08-31',
    tipoComprobante: 'A',
    cantidadKm: 200,
    prestacion: 'Kinesiología',
    mesFacturado: 8,
    anioFacturado: 2026,
    dependenciaYRetorno: 'Sí',
    domicilioId: 'dom-1',
    asistencias: [{ id: 'tmp-1', fecha: '2026-08-01', prestacion: 'Kinesiología', dependencia: '', retorno: '', facturaSabados: false }],
  };
}

// -------------------------------------------------------------------------------------------
// 3.2 — list()
// -------------------------------------------------------------------------------------------

describe('supabaseFacturaRepository.list (3.2)', () => {
  it('devuelve las facturas ensambladas a partir de una sola consulta con embed de asistencias', async () => {
    const filas = [filaFactura({ id: 'f-1' }), filaFactura({ id: 'f-2' })];
    configurar('facturacion', 'facturas', 'select', () => ok(filas));

    const resultado = await supabaseFacturaRepository.list();

    expect(resultado).toEqual([ensamblarFactura(filas[0]), ensamblarFactura(filas[1])]);
  });

  it('un listado de 3 facturas dispara una sola consulta (anti N+1)', async () => {
    configurar('facturacion', 'facturas', 'select', () =>
      ok([filaFactura({ id: 'f-1' }), filaFactura({ id: 'f-2' }), filaFactura({ id: 'f-3' })]),
    );

    await supabaseFacturaRepository.list();

    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1);
  });

  it('devuelve [] si la consulta no trae un array (defensivo)', async () => {
    configurar('facturacion', 'facturas', 'select', () => ok(null));

    await expect(supabaseFacturaRepository.list()).resolves.toEqual([]);
  });

  it('lanza un error traducido si la consulta falla', async () => {
    configurar('facturacion', 'facturas', 'select', () => fail({ code: 'PGRST106', message: 'schema not exposed' }));

    await expect(supabaseFacturaRepository.list()).rejects.toThrow(
      'El módulo de Facturación no está habilitado en el servidor.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 3.3 — getById()
// -------------------------------------------------------------------------------------------

describe('supabaseFacturaRepository.getById (3.3)', () => {
  it('resuelve una factura ensamblada cuando la fila existe', async () => {
    const fila = filaFactura();
    configurar('facturacion', 'facturas', 'select', () => ok([fila]));

    const resultado = await supabaseFacturaRepository.getById('f-1');

    expect(resultado).toEqual(ensamblarFactura(fila));
  });

  it('resuelve null (sin lanzar) si no hay fila con ese id', async () => {
    configurar('facturacion', 'facturas', 'select', () => ok([]));

    await expect(supabaseFacturaRepository.getById('no-existe')).resolves.toBeNull();
  });

  it('resuelve null (sin lanzar) si RLS filtra la fila de una factura que sí existe — mismo camino de código, test separado por ser contrato explícito', async () => {
    configurar('facturacion', 'facturas', 'select', () => ok([]));

    await expect(supabaseFacturaRepository.getById('existe-sin-permiso')).resolves.toBeNull();
  });

  it('lanza un error traducido si la consulta falla de verdad (no un 0-filas de RLS)', async () => {
    configurar('facturacion', 'facturas', 'select', () => fail({ code: '55000', message: 'internal error' }));

    await expect(supabaseFacturaRepository.getById('f-1')).rejects.toThrow('No se pudo cargar la factura.');
  });
});

// -------------------------------------------------------------------------------------------
// 3.4 — listByPaciente()
// -------------------------------------------------------------------------------------------

describe('supabaseFacturaRepository.listByPaciente (3.4)', () => {
  it('aplica el filtro por paciente_id EN LA CONSULTA (.eq), no filtrando en memoria', async () => {
    configurar('facturacion', 'facturas', 'select', () => ok([filaFactura({ paciente_id: 'p-1' })]));

    await supabaseFacturaRepository.listByPaciente('p-1');

    const llamada = calls.find((c) => c.op === 'select');
    expect(llamada?.eq).toEqual([['paciente_id', 'p-1']]);
  });

  it('devuelve solo las facturas de ese paciente ensambladas', async () => {
    const fila = filaFactura({ paciente_id: 'p-1' });
    configurar('facturacion', 'facturas', 'select', () => ok([fila]));

    const resultado = await supabaseFacturaRepository.listByPaciente('p-1');

    expect(resultado).toEqual([ensamblarFactura(fila)]);
  });

  it('dispara una sola consulta (anti N+1, igual que list())', async () => {
    configurar('facturacion', 'facturas', 'select', () => ok([filaFactura()]));

    await supabaseFacturaRepository.listByPaciente('p-1');

    expect(calls.filter((c) => c.op === 'select')).toHaveLength(1);
  });
});

// -------------------------------------------------------------------------------------------
// 3.5 — create() atómico
// -------------------------------------------------------------------------------------------

describe('supabaseFacturaRepository.create (3.5)', () => {
  it('happy path: devuelve la factura releída con el id generado por la base', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => ok('nuevo-uuid'));
    const filaCreada = filaFactura({ id: 'nuevo-uuid' });
    configurar('facturacion', 'facturas', 'select', () => ok([filaCreada]));

    const resultado = await supabaseFacturaRepository.create(nuevaFacturaMinima());

    expect(resultado).toEqual(ensamblarFactura(filaCreada));
  });

  it('emite EXACTAMENTE una llamada rpc y CERO insert directo sobre asistencia_prestacion', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => ok('nuevo-uuid'));
    configurar('facturacion', 'facturas', 'select', () => ok([filaFactura({ id: 'nuevo-uuid' })]));

    await supabaseFacturaRepository.create(nuevaFacturaMinima());

    const rpcs = calls.filter((c) => c.op === 'rpc');
    const inserts = calls.filter((c) => c.op === 'insert');
    expect(rpcs).toHaveLength(1);
    expect(rpcs[0]?.table).toBe('crear_factura_completa');
    expect(inserts).toHaveLength(0);
    expect(inserts.filter((c) => c.table === 'asistencia_prestacion')).toHaveLength(0);
  });

  it('si la relectura posterior devuelve null, lanza (no inventa una Factura)', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => ok('nuevo-uuid'));
    configurar('facturacion', 'facturas', 'select', () => ok([]));

    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'No se pudo recuperar la factura recién creada.',
    );
  });

  it('si la RPC no devuelve un uuid string (sin error), lanza sin intentar releer', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => ok(null));

    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'No se pudo guardar la factura.',
    );
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------------------------
// 3.6 — update() atómico
// -------------------------------------------------------------------------------------------

describe('supabaseFacturaRepository.update (3.6)', () => {
  it('happy path: devuelve la factura releída', async () => {
    configurarRpc('facturacion', 'actualizar_factura_completa', () => ok('f-1'));
    const filaActualizada = filaFactura({ id: 'f-1', estado: 'facturado' });
    configurar('facturacion', 'facturas', 'select', () => ok([filaActualizada]));

    const resultado = await supabaseFacturaRepository.update('f-1', { estado: 'facturado' });

    expect(resultado).toEqual(ensamblarFactura(filaActualizada));
  });

  it('emite EXACTAMENTE una llamada rpc', async () => {
    configurarRpc('facturacion', 'actualizar_factura_completa', () => ok('f-1'));
    configurar('facturacion', 'facturas', 'select', () => ok([filaFactura()]));

    await supabaseFacturaRepository.update('f-1', { estado: 'facturado' });

    expect(calls.filter((c) => c.op === 'rpc')).toHaveLength(1);
  });

  it('EL CASO CRÍTICO: editar SOLO el estado NO manda la clave "asistencias" en el jsonb', async () => {
    configurarRpc('facturacion', 'actualizar_factura_completa', () => ok('f-1'));
    configurar('facturacion', 'facturas', 'select', () => ok([filaFactura()]));

    await supabaseFacturaRepository.update('f-1', { estado: 'facturado' });

    const rpc = calls.find((c) => c.op === 'rpc');
    const payload = rpc?.payload as { p_id: string; p_cambios: Record<string, unknown> } | undefined;
    expect(payload?.p_id).toBe('f-1');
    expect(payload?.p_cambios).not.toHaveProperty('asistencias');
    expect(payload?.p_cambios).toEqual({ estado: 'facturado' });
  });

  it('editar las asistencias SÍ manda la clave, incluso con un array vacío', async () => {
    configurarRpc('facturacion', 'actualizar_factura_completa', () => ok('f-1'));
    configurar('facturacion', 'facturas', 'select', () => ok([filaFactura()]));

    const cambios: ActualizacionFactura = { asistencias: [] };
    await supabaseFacturaRepository.update('f-1', cambios);

    const rpc = calls.find((c) => c.op === 'rpc');
    const payload = rpc?.payload as { p_cambios: Record<string, unknown> } | undefined;
    expect(payload?.p_cambios).toHaveProperty('asistencias');
    expect(payload?.p_cambios.asistencias).toEqual([]);
  });

  it('45203 -> mensaje idéntico al del mock, usando el id que ya conoce el repository', async () => {
    configurarRpc('facturacion', 'actualizar_factura_completa', () => fail({ code: '45203', message: 'no existe' }));

    await expect(supabaseFacturaRepository.update('no-existe', { estado: 'facturado' })).rejects.toThrow(
      'No existe una factura con id "no-existe".',
    );
  });

  it('relectura null -> lanza (no devuelve una Factura inventada)', async () => {
    configurarRpc('facturacion', 'actualizar_factura_completa', () => ok('f-1'));
    configurar('facturacion', 'facturas', 'select', () => ok([]));

    await expect(supabaseFacturaRepository.update('f-1', { estado: 'facturado' })).rejects.toThrow(
      'No se pudo recuperar la factura actualizada.',
    );
  });

  it('si la RPC no devuelve un uuid string (sin error), lanza sin intentar releer', async () => {
    configurarRpc('facturacion', 'actualizar_factura_completa', () => ok(null));

    await expect(supabaseFacturaRepository.update('f-1', { estado: 'facturado' })).rejects.toThrow(
      'No se pudo guardar la factura.',
    );
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------------------------
// 3.7 — mapeo de errores D7, un test por código + TRIANGULATE (sin tablas/columnas/inglés)
// -------------------------------------------------------------------------------------------

describe('mapeo de errores D7 (3.7)', () => {
  function esperarErrorDeList(codigo: string, mensajeEsperado: string): Promise<void> {
    configurar('facturacion', 'facturas', 'select', () => fail({ code: codigo, message: 'texto crudo de postgres' }));
    return expect(supabaseFacturaRepository.list()).rejects.toThrow(mensajeEsperado);
  }

  it('42501 -> falta de permiso', () => esperarErrorDeList('42501', 'No tenés permiso para modificar facturas.'));
  it('PGRST301 -> falta de permiso', () => esperarErrorDeList('PGRST301', 'No tenés permiso para modificar facturas.'));

  it('23503 sobre paciente_id -> el paciente ya no existe', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () =>
      fail({ code: '23503', message: 'insert or update on table "facturas" violates foreign key constraint "facturas_paciente_id_fkey"' }),
    );
    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'El paciente seleccionado ya no existe.',
    );
  });

  it('23503 sobre domicilio_id -> el domicilio ya no existe', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () =>
      fail({ code: '23503', message: 'insert or update on table "facturas" violates foreign key constraint "facturas_domicilio_id_fkey"' }),
    );
    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'El domicilio seleccionado ya no existe en la ficha del paciente.',
    );
  });

  it('23514 -> el mes facturado debe estar entre 1 y 12', () =>
    esperarErrorDeList('23514', 'El mes facturado debe estar entre 1 y 12.'));

  it('22P02 -> mensaje genérico de guardado (enum inválido)', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => fail({ code: '22P02', message: 'invalid input value for enum' }));
    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'No se pudo guardar la factura.',
    );
  });

  it('45201 -> todas las asistencias necesitan fecha y prestación', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => fail({ code: '45201', message: 'asistencia sin fecha' }));
    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'Todas las asistencias necesitan fecha y prestación.',
    );
  });

  it('45202 -> mensaje genérico de guardado (payload inválido)', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => fail({ code: '45202', message: 'payload inválido' }));
    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'No se pudo guardar la factura.',
    );
  });

  it('45203 -> no existe una factura con ese id', async () => {
    configurarRpc('facturacion', 'actualizar_factura_completa', () => fail({ code: '45203', message: 'no existe' }));
    await expect(supabaseFacturaRepository.update('f-x', { estado: 'facturado' })).rejects.toThrow(
      'No existe una factura con id "f-x".',
    );
  });

  it('45204 -> el mes facturado debe estar entre 1 y 12', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => fail({ code: '45204', message: 'mes fuera de rango' }));
    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'El mes facturado debe estar entre 1 y 12.',
    );
  });

  it('PGRST202 -> el alta no está habilitada en el servidor', () =>
    esperarErrorDeList('PGRST202', 'El alta de facturas no está habilitada en el servidor todavía.'));

  it('PGRST204 -> la fecha de emisión no está habilitada en el servidor', () =>
    esperarErrorDeList('PGRST204', 'La fecha de emisión de factura no está habilitada en el servidor todavía.'));

  it('PGRST106 -> el módulo no está habilitado en el servidor', () =>
    esperarErrorDeList('PGRST106', 'El módulo de Facturación no está habilitado en el servidor.'));

  it('código desconocido en una carga (list) -> mensaje genérico de carga', () =>
    esperarErrorDeList('55000', 'No se pudo cargar la factura.'));

  it('código desconocido en un guardado (create) -> mensaje genérico de guardado, distinto del de carga', async () => {
    configurarRpc('facturacion', 'crear_factura_completa', () => fail({ code: '55000', message: 'internal error' }));
    await expect(supabaseFacturaRepository.create(nuevaFacturaMinima())).rejects.toThrow(
      'No se pudo guardar la factura.',
    );
  });

  it('getById sin fila no lanza -> resuelve null (contrato explícito de la interfaz, no un error de D7)', async () => {
    configurar('facturacion', 'facturas', 'select', () => ok([]));
    await expect(supabaseFacturaRepository.getById('no-existe')).resolves.toBeNull();
  });

  // TRIANGULATE: ningún mensaje de D7 contiene nombres de tabla, nombres de columna ni texto en
  // inglés (filtra el error crudo de Postgres/PostgREST hacia la UI, D7 §Nota de seguridad).
  const CODIGOS_D7 = ['42501', 'PGRST301', '23514', '22P02', '45201', '45202', '45203', '45204', 'PGRST202', 'PGRST204', 'PGRST106', '55000'];
  // "facturas"/"factura" son palabras legítimas del dominio en castellano (D7 las usa en varios
  // mensajes de UI) — lo prohibido es el nombre de tabla calificado, columnas snake_case y jerga
  // técnica en inglés que delataría el schema real (D7 §Nota de seguridad).
  const FRAGMENTOS_PROHIBIDOS = [
    'facturacion.facturas',
    'asistencia_prestacion',
    'paciente_id',
    'domicilio_id',
    'mes_facturado',
    'schema',
    'table',
    'column',
    'constraint',
    'permission denied',
    'relation',
  ];

  it.each(CODIGOS_D7)('el mensaje de %s no contiene nombres de tabla/columna ni texto en inglés', async (codigo) => {
    configurar('facturacion', 'facturas', 'select', () =>
      fail({ code: codigo, message: 'relation "facturacion.facturas" violates foreign key constraint on column paciente_id' }),
    );

    try {
      await supabaseFacturaRepository.list();
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
// 3.8 — aserción de código fuente (node:fs, no `?raw`: confirmado en design.md D14 que `?raw` de
// Vite no funciona para rutas fuera de `frontend/`; acá el archivo SÍ está dentro de `frontend/`,
// pero se usa `node:fs` de todas formas por instrucción explícita de esta sesión de apply).
// -------------------------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const FUENTE_REPOSITORY = readFileSync(resolve(__dirname, 'SupabaseFacturaRepository.ts'), 'utf-8');

describe('código fuente de SupabaseFacturaRepository.ts (3.8)', () => {
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
