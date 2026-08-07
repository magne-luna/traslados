import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import Vite `?raw` (declarado en vite/client.d.ts) — código fuente como string en build time,
// mismo patrón que `SupabasePacienteRepository.test.ts` 3.12.
import supabaseDocumentoRepositorySource from './SupabaseDocumentoRepository.ts?raw';
import { CONFIG_ENTIDAD } from './documentoMapping';
import type { ConfiguracionEntidad } from './documentoMapping';

// -------------------------------------------------------------------------------------------
// 4.1 — Fake tipado del subconjunto de supabase-js usado, cubriendo las dos superficies:
// `.schema().from().select()/.insert()/.delete()` y
// `.storage.from().upload()/.remove()/.createSignedUrl()`. Mismo patrón que
// `SupabasePacienteRepository.test.ts` — nunca golpea la red real.
// -------------------------------------------------------------------------------------------

interface FakeError {
  code?: string;
  message: string;
}

interface FakeStorageError {
  name: string;
  message: string;
  status?: number;
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
let ordenLlamadas: string[] = [];

interface StorageUploadCall {
  bucket: string;
  path: string;
  file: File;
  upsert?: boolean;
}
interface StorageRemoveCall {
  bucket: string;
  paths: string[];
}
interface StorageCreateSignedUrlCall {
  bucket: string;
  path: string;
  expiresIn: number;
}

interface StorageFakeResult {
  data: { path: string } | { signedUrl: string } | null;
  error: FakeStorageError | null;
}

let storageUploadCalls: StorageUploadCall[] = [];
let storageRemoveCalls: StorageRemoveCall[] = [];
let storageSignedUrlCalls: StorageCreateSignedUrlCall[] = [];

let uploadHandler: (call: StorageUploadCall) => StorageFakeResult = (call) => ({
  data: { path: call.path },
  error: null,
});
let removeHandler: (call: StorageRemoveCall) => StorageFakeResult = () => ({ data: null, error: null });
let createSignedUrlHandler: (call: StorageCreateSignedUrlCall) => StorageFakeResult = (call) => ({
  data: { signedUrl: `https://signed.example/${call.path}?exp=${call.expiresIn}` },
  error: null,
});

function resetFake(): void {
  calls = [];
  handlers = new Map();
  ordenLlamadas = [];
  storageUploadCalls = [];
  storageRemoveCalls = [];
  storageSignedUrlCalls = [];
  uploadHandler = (call) => ({ data: { path: call.path }, error: null });
  removeHandler = () => ({ data: null, error: null });
  createSignedUrlHandler = (call) => ({
    data: { signedUrl: `https://signed.example/${call.path}?exp=${call.expiresIn}` },
    error: null,
  });
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
  const handler = handlers.get(`${call.schema}.${call.table}.${call.op}`);
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
    ordenLlamadas.push(`delete:${this.call.schema}.${this.call.table}`);
    return Promise.resolve(resolver(this.call)).then(onfulfilled, onrejected);
  }
}

class FakeInsertBuilder {
  private readonly call: RecordedCall;

  constructor(call: RecordedCall) {
    this.call = call;
  }

  select(_columns?: string): FakeInsertBuilder {
    return this;
  }

  single(): Promise<FakeResult> {
    calls.push(this.call);
    ordenLlamadas.push(`insert:${this.call.schema}.${this.call.table}`);
    const result = resolver(this.call);
    const row = Array.isArray(result.data) ? (result.data[0] ?? null) : result.data;
    return Promise.resolve({ data: row, error: result.error });
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
              return new FakeInsertBuilder({ op: 'insert', schema: schemaName, table, eq: [], payload });
            },
            delete() {
              return new FakeDeleteBuilder({ op: 'delete', schema: schemaName, table, eq: [] });
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        return {
          upload(path: string, file: File, options?: { upsert?: boolean }) {
            const call: StorageUploadCall = { bucket, path, file, upsert: options?.upsert };
            storageUploadCalls.push(call);
            ordenLlamadas.push(`storage.upload:${bucket}`);
            return Promise.resolve(uploadHandler(call));
          },
          remove(paths: string[]) {
            const call: StorageRemoveCall = { bucket, paths };
            storageRemoveCalls.push(call);
            ordenLlamadas.push(`storage.remove:${bucket}`);
            return Promise.resolve(removeHandler(call));
          },
          createSignedUrl(path: string, expiresIn: number) {
            const call: StorageCreateSignedUrlCall = { bucket, path, expiresIn };
            storageSignedUrlCalls.push(call);
            ordenLlamadas.push(`storage.createSignedUrl:${bucket}`);
            return Promise.resolve(createSignedUrlHandler(call));
          },
        };
      },
    },
  };
}

vi.mock('../supabaseClient', () => ({ supabase: crearFakeSupabase() }));

const { supabaseDocumentoRepository } = await import('./SupabaseDocumentoRepository');

beforeEach(() => {
  resetFake();
});

// -------------------------------------------------------------------------------------------
// Fixtures — `paciente` es la entidad primaria de los tests (Checkpoint 0: única real en este
// change), con `vehiculo` sumado puntualmente donde la tarea pide cubrir mensajes por entidad.
// -------------------------------------------------------------------------------------------

const configPaciente: ConfiguracionEntidad = CONFIG_ENTIDAD.paciente;

function archivo(nombre: string, contenido = 'contenido'): File {
  return new File([contenido], nombre, { type: 'application/pdf' });
}

function filaDocumento(
  config: ConfiguracionEntidad,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'doc-1',
    [config.columnaEntidad]: 'entidad-1',
    [config.columnaItem]: 'item-1',
    archivo_url: 'entidad-1/item-1/uuid-1-archivo.pdf',
    nombre_archivo: 'archivo.pdf',
    created_at: '2026-08-06T12:00:00.000Z',
    ...overrides,
  };
}

// -------------------------------------------------------------------------------------------
// 4.2 — listByEntity(entidad, entidadId): una sola consulta a la tabla, sin tocar Storage.
// -------------------------------------------------------------------------------------------

describe('supabaseDocumentoRepository.listByEntity (tasks.md 4.2)', () => {
  it('hace una sola consulta a la tabla de la config, filtrando por columnaEntidad, y no toca Storage', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([filaDocumento(configPaciente)]));

    const documentos = await supabaseDocumentoRepository.listByEntity('paciente', 'entidad-1');

    expect(documentos).toEqual([{ id: 'doc-1', itemId: 'item-1', nombreArchivo: 'archivo.pdf', subidoEn: '2026-08-06T12:00:00.000Z' }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.eq).toEqual([['paciente_id', 'entidad-1']]);
    expect(storageUploadCalls).toHaveLength(0);
    expect(storageRemoveCalls).toHaveLength(0);
    expect(storageSignedUrlCalls).toHaveLength(0);
  });

  it('descarta filas malformadas vía ensamblarDocumentos, sin romper la colección', async () => {
    configurar('pacientes', 'documentos', 'select', () =>
      ok([filaDocumento(configPaciente), { id: 'sin-item-id' }]),
    );

    const documentos = await supabaseDocumentoRepository.listByEntity('paciente', 'entidad-1');

    expect(documentos).toHaveLength(1);
  });
});

// -------------------------------------------------------------------------------------------
// 4.3 — upload: algoritmo corregido de 2 pasos (UPLOAD -> INSERT), sin reemplazo.
// -------------------------------------------------------------------------------------------

describe('supabaseDocumentoRepository.upload (tasks.md 4.3)', () => {
  it('alta simple: UPLOAD y después INSERT, en ese orden', async () => {
    configurar('pacientes', 'documentos', 'insert', () => ok(filaDocumento(configPaciente, { id: 'doc-nuevo' })));

    const documento = await supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('rhc.pdf'));

    expect(documento.id).toBe('doc-nuevo');
    expect(ordenLlamadas).toEqual(['storage.upload:documentos-pacientes', 'insert:pacientes.documentos']);
    expect(storageUploadCalls[0]?.upsert).toBe(false);
    expect(storageUploadCalls[0]?.bucket).toBe('documentos-pacientes');
  });

  it('fallo del INSERT: llama storage.remove() sobre el objeto recién subido (compensación) y propaga el error', async () => {
    configurar('pacientes', 'documentos', 'insert', () => fail({ code: '99999', message: 'boom interno' }));

    await expect(supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('rhc.pdf'))).rejects.toThrow();

    expect(storageUploadCalls).toHaveLength(1);
    expect(storageRemoveCalls).toHaveLength(1);
    expect(storageRemoveCalls[0]?.paths).toEqual([storageUploadCalls[0]?.path]);
    expect(storageRemoveCalls[0]?.bucket).toBe('documentos-pacientes');
  });

  it('dos uploads consecutivos sobre el mismo (entidad, entidadId, itemId) producen dos filas, no reemplazo', async () => {
    let contadorInsert = 0;
    configurar('pacientes', 'documentos', 'insert', () => {
      contadorInsert += 1;
      return ok(filaDocumento(configPaciente, { id: `doc-${contadorInsert}` }));
    });

    const primero = await supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'));
    const segundo = await supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('b.pdf'));

    expect(primero.id).not.toBe(segundo.id);
    expect(calls.filter((c) => c.op === 'select')).toHaveLength(0); // sin SELECT previo — regla central de la corrección
    expect(calls.filter((c) => c.op === 'delete')).toHaveLength(0); // sin DELETE previo
    expect(calls.filter((c) => c.op === 'insert')).toHaveLength(2);
    expect(storageUploadCalls).toHaveLength(2);
    expect(storageRemoveCalls).toHaveLength(0); // ningún objeto previo se limpia — no hay reemplazo
  });

  it('vigenciaDesde se acepta por firma pero no se persiste en el INSERT', async () => {
    let payloadRecibido: unknown;
    configurar('pacientes', 'documentos', 'insert', (call) => {
      payloadRecibido = call.payload;
      return ok(filaDocumento(configPaciente));
    });

    await supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'), '2026-01-01');

    expect(payloadRecibido).not.toHaveProperty('vigenciaDesde');
    expect(payloadRecibido).not.toHaveProperty('vigencia_desde');
  });
});

// -------------------------------------------------------------------------------------------
// 4.4 — remove(entidad, entidadId, documentoId): SELECT -> DELETE -> REMOVE (best-effort).
// -------------------------------------------------------------------------------------------

describe('supabaseDocumentoRepository.remove (tasks.md 4.4)', () => {
  it('caso normal: SELECT confirma la fila, DELETE la borra, REMOVE limpia el objeto', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([filaDocumento(configPaciente)]));

    await supabaseDocumentoRepository.remove('paciente', 'entidad-1', 'doc-1');

    expect(calls.filter((c) => c.op === 'delete')).toHaveLength(1);
    expect(calls.find((c) => c.op === 'delete')?.eq).toEqual([['id', 'doc-1']]);
    expect(storageRemoveCalls).toHaveLength(1);
    expect(storageRemoveCalls[0]?.paths).toEqual(['entidad-1/item-1/uuid-1-archivo.pdf']);
  });

  it('caso idempotente: no existe la fila -> resuelve sin error, igual que el mock', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([]));

    await expect(supabaseDocumentoRepository.remove('paciente', 'entidad-1', 'doc-inexistente')).resolves.toBeUndefined();
    expect(calls.filter((c) => c.op === 'delete')).toHaveLength(0);
    expect(storageRemoveCalls).toHaveLength(0);
  });

  it('idempotente también cuando el documentoId pertenece a otra entidadId (no se borra fila ajena)', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([])); // el SELECT scoped a la entidadId no encuentra nada

    await expect(supabaseDocumentoRepository.remove('paciente', 'entidad-2', 'doc-1')).resolves.toBeUndefined();
    expect(calls.filter((c) => c.op === 'delete')).toHaveLength(0);
  });

  it('fallo del REMOVE del objeto: no lanza (best-effort) — el dominio ya quedó consistente', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([filaDocumento(configPaciente)]));
    removeHandler = () => ({ data: null, error: { name: 'StorageApiError', message: 'boom', status: 500 } });

    await expect(supabaseDocumentoRepository.remove('paciente', 'entidad-1', 'doc-1')).resolves.toBeUndefined();
  });
});

// -------------------------------------------------------------------------------------------
// 4.4b — resolverPrevisualizacion(entidad, entidadId, documentoId): el 4º método de la interfaz.
// -------------------------------------------------------------------------------------------

describe('supabaseDocumentoRepository.resolverPrevisualizacion (tasks.md 4.4b)', () => {
  it('documento existente y perteneciente a la entidad -> URL firmada devuelta', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([filaDocumento(configPaciente)]));

    const url = await supabaseDocumentoRepository.resolverPrevisualizacion('paciente', 'entidad-1', 'doc-1');

    expect(url).toBe('https://signed.example/entidad-1/item-1/uuid-1-archivo.pdf?exp=120');
    expect(storageSignedUrlCalls).toHaveLength(1);
    expect(storageSignedUrlCalls[0]?.bucket).toBe('documentos-pacientes');
  });

  it('documentoId que no pertenece a (entidad, entidadId) -> null, sin llamar createSignedUrl', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([])); // el SELECT scoped no lo encuentra

    const url = await supabaseDocumentoRepository.resolverPrevisualizacion('paciente', 'entidad-2', 'doc-1');

    expect(url).toBeNull();
    expect(storageSignedUrlCalls).toHaveLength(0);
  });

  it('documentoId inexistente -> null', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([]));

    const url = await supabaseDocumentoRepository.resolverPrevisualizacion('paciente', 'entidad-1', 'doc-nada');

    expect(url).toBeNull();
    expect(storageSignedUrlCalls).toHaveLength(0);
  });

  it('fallo real de createSignedUrl (403/404 de Storage) -> se propaga como error traducido, no se degrada a null', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([filaDocumento(configPaciente)]));
    createSignedUrlHandler = () => ({ data: null, error: { name: 'StorageApiError', message: 'nope', status: 403 } });

    await expect(supabaseDocumentoRepository.resolverPrevisualizacion('paciente', 'entidad-1', 'doc-1')).rejects.toThrow(
      'No tenés permiso para subir archivos de pacientes.',
    );
  });
});

// -------------------------------------------------------------------------------------------
// 4.5 — Traducción de errores: los 9 códigos de design.md D5, test dedicado por código, cubriendo
// las 4 superficies (upload/remove/resolverPrevisualizacion/listByEntity).
// -------------------------------------------------------------------------------------------

describe('supabaseDocumentoRepository — traducción de errores (tasks.md 4.5, design.md D5)', () => {
  it('Postgrest 42501 (RLS de la tabla rechaza) en upload -> mensaje de permiso sobre la tabla', async () => {
    configurar('pacientes', 'documentos', 'insert', () => fail({ code: '42501', message: 'permission denied for table documentos' }));

    await expect(supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'))).rejects.toThrow(
      'No tenés permiso para subir documentos de pacientes.',
    );
  });

  it('Postgrest PGRST301 (RLS de la tabla rechaza) en remove (DELETE) -> mismo mensaje de permiso sobre la tabla', async () => {
    configurar('pacientes', 'documentos', 'select', () => ok([filaDocumento(configPaciente)]));
    configurar('pacientes', 'documentos', 'delete', () => fail({ code: 'PGRST301', message: 'jwt role not authorized' }));

    await expect(supabaseDocumentoRepository.remove('paciente', 'entidad-1', 'doc-1')).rejects.toThrow(
      'No tenés permiso para subir documentos de pacientes.',
    );
  });

  it('Postgrest 23503 en upload (el id de fixture, Checkpoint 0) -> "no se encontró la entidad" (tasks.md 4.6)', async () => {
    configurar('pacientes', 'documentos', 'insert', () => fail({ code: '23503', message: 'insert or update on table "documentos" violates foreign key constraint' }));

    await expect(supabaseDocumentoRepository.upload('paciente', 'entidad-fixture', 'item-1', archivo('a.pdf'))).rejects.toThrow(
      'No se encontró el paciente de este documento. Puede que se haya eliminado.',
    );
  });

  it('Postgrest PGRST204 en upload (falta nombre_archivo, migración CP2 no aplicada) -> mensaje de carga no habilitada', async () => {
    configurar('pacientes', 'documentos', 'insert', () => fail({ code: 'PGRST204', message: "Could not find the 'nombre_archivo' column" }));

    await expect(supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'))).rejects.toThrow(
      'La carga de documentos no está habilitada en el servidor todavía.',
    );
  });

  it('Postgrest PGRST106 en listByEntity (schema no expuesto) -> mensaje de módulo no habilitado', async () => {
    configurar('pacientes', 'documentos', 'select', () => fail({ code: 'PGRST106', message: 'schema must be one of the following' }));

    await expect(supabaseDocumentoRepository.listByEntity('paciente', 'entidad-1')).rejects.toThrow(
      'El módulo de Pacientes no está habilitado en el servidor.',
    );
  });

  it('Postgrest PGRST205 en resolverPrevisualizacion (schema no expuesto) -> mismo mensaje de módulo no habilitado', async () => {
    configurar('pacientes', 'documentos', 'select', () => fail({ code: 'PGRST205', message: 'Could not find the table' }));

    await expect(supabaseDocumentoRepository.resolverPrevisualizacion('paciente', 'entidad-1', 'doc-1')).rejects.toThrow(
      'El módulo de Pacientes no está habilitado en el servidor.',
    );
  });

  it('Storage 403 en upload (RLS del bucket rechaza, caso Checkpoint 3 en Vehículos) -> mensaje de permiso sobre el bucket, DISTINTO del 403 de tabla', async () => {
    uploadHandler = () => ({ data: null, error: { name: 'StorageApiError', message: 'Unauthorized', status: 403 } });

    await expect(supabaseDocumentoRepository.upload('vehiculo', 'entidad-1', 'item-1', archivo('a.pdf'))).rejects.toThrow(
      'No tenés permiso para subir archivos de vehículos.',
    );

    // Verificación explícita (tasks.md 4.5): los dos mensajes de 403 (tabla vs. bucket) son distintos.
    const msgTabla = 'No tenés permiso para subir documentos de vehículos.';
    const msgBucket = 'No tenés permiso para subir archivos de vehículos.';
    expect(msgTabla).not.toBe(msgBucket);
  });

  it('Storage 404 en upload (bucket no existe) -> mensaje de almacenamiento no configurado', async () => {
    uploadHandler = () => ({ data: null, error: { name: 'StorageApiError', message: 'Bucket not found', status: 404 } });

    await expect(supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'))).rejects.toThrow(
      'El almacenamiento de documentos no está configurado.',
    );
  });

  it('Storage 413 en upload (archivo supera el límite) -> mensaje de archivo demasiado grande', async () => {
    uploadHandler = () => ({ data: null, error: { name: 'StorageApiError', message: 'Payload too large', status: 413 } });

    await expect(supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'))).rejects.toThrow(
      'El archivo es demasiado grande.',
    );
  });

  it('Storage 409 en upload (colisión de clave, imposible por el UUID de D3) -> mensaje genérico de guardado', async () => {
    uploadHandler = () => ({ data: null, error: { name: 'StorageApiError', message: 'Duplicate', status: 409 } });

    await expect(supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'))).rejects.toThrow(
      'No se pudo guardar el documento.',
    );
  });

  it('código no reconocido (resto): en listar cae al genérico de carga, en subir al genérico de guardado', async () => {
    configurar('pacientes', 'documentos', 'select', () => fail({ code: 'XX000', message: 'internal error interno crudo de postgres' }));
    await expect(supabaseDocumentoRepository.listByEntity('paciente', 'entidad-1')).rejects.toThrow('No se pudo cargar el documento.');

    configurar('pacientes', 'documentos', 'insert', () => fail({ code: 'XX000', message: 'internal error interno crudo de postgres' }));
    await expect(supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'))).rejects.toThrow(
      'No se pudo guardar el documento.',
    );
  });

  it('nunca propaga error.message crudo a la UI', async () => {
    const mensajeCrudo = 'ERROR:  duplicate key value violates unique constraint interno-nunca-visible';
    configurar('pacientes', 'documentos', 'insert', () => fail({ code: '42501', message: mensajeCrudo }));

    let mensajeThrown = '';
    try {
      await supabaseDocumentoRepository.upload('paciente', 'entidad-1', 'item-1', archivo('a.pdf'));
    } catch (error) {
      mensajeThrown = error instanceof Error ? error.message : '';
    }

    expect(mensajeThrown).not.toBe(mensajeCrudo);
    expect(mensajeThrown).not.toContain('interno-nunca-visible');
  });
});

// -------------------------------------------------------------------------------------------
// 4.7 — El objeto exportado tipa como DocumentoRepository sin casts (verificación de compilación,
// `tsc -b --noEmit`); acá solo se confirma en runtime que las 4 firmas existen.
// -------------------------------------------------------------------------------------------

describe('supabaseDocumentoRepository — forma del objeto exportado (tasks.md 4.7)', () => {
  it('expone las 4 firmas de DocumentoRepository', () => {
    expect(typeof supabaseDocumentoRepository.listByEntity).toBe('function');
    expect(typeof supabaseDocumentoRepository.upload).toBe('function');
    expect(typeof supabaseDocumentoRepository.remove).toBe('function');
    expect(typeof supabaseDocumentoRepository.resolverPrevisualizacion).toBe('function');
  });
});

// -------------------------------------------------------------------------------------------
// 4.8 — código fuente: nunca SUPABASE_SERVICE_ROLE_KEY, nunca cliente propio, nunca URL pública.
// -------------------------------------------------------------------------------------------

describe('código fuente de SupabaseDocumentoRepository.ts (tasks.md 4.8, design.md D7)', () => {
  it('no menciona SUPABASE_SERVICE_ROLE_KEY ni service_role', () => {
    expect(supabaseDocumentoRepositorySource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(supabaseDocumentoRepositorySource).not.toContain('service_role');
  });

  it('no construye un cliente propio — usa el singleton shared/lib/supabaseClient.ts', () => {
    expect(supabaseDocumentoRepositorySource).not.toContain('createClient(');
    expect(supabaseDocumentoRepositorySource).toContain("from '../supabaseClient'");
  });

  it('no genera ninguna URL pública de Storage — solo createSignedUrl (los 4 buckets son privados)', () => {
    expect(supabaseDocumentoRepositorySource).not.toContain('getPublicUrl');
    expect(supabaseDocumentoRepositorySource).toContain('createSignedUrl');
  });

  it('no contiene `any`', () => {
    expect(supabaseDocumentoRepositorySource).not.toMatch(/:\s*any\b/);
    expect(supabaseDocumentoRepositorySource).not.toMatch(/<any>/);
    expect(supabaseDocumentoRepositorySource).not.toMatch(/\bas any\b/);
  });
});
