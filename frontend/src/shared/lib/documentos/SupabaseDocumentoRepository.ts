import { supabase } from '../supabaseClient';
import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
import type { DocumentoRepository } from './DocumentoRepository';
import {
  CONFIG_ENTIDAD,
  construirClaveStorage,
  ensamblarDocumentos,
  parseDocumentoRow,
  toInsertPayload,
} from './documentoMapping';

// Implementación real de DocumentoRepository (tasks.md §4, design.md D4-D7 del change
// `integracion-documentos`). Toda la traducción fila<->dominio vive en `documentoMapping.ts` (§3);
// acá solo hay I/O: Storage + Postgres, que NO comparten transacción (D4).
//
// ⚠️ Algoritmo de `upload`/`remove` — usar la versión CORREGIDA de design.md D4 (bloque "⚠️
// CORRECCIÓN 2026-08-06"), no la original de 5 pasos que sigue documentada más arriba en la misma
// sección como registro histórico. La original describía `upload` con semántica de "reemplazo"
// (SELECT previa → DELETE previa → INSERT → REMOVE previo) — eso dejó de ser cierto desde
// `pacientes-documentos-multiples` (mock: "siempre agrega", sin límite, colección real). El
// algoritmo real es:
//   upload: 1. UPLOAD (upsert: false)  2. INSERT fila nueva — sin SELECT/DELETE previos, cada
//   upload es un documento independiente en la colección.
//   remove: sigue en 3 pasos (SELECT/DELETE/REMOVE) pero filtra por `documentoId` (el `id` propio
//   del documento), no por `itemId` — con colección, "el" documento de un ítem no identifica nada.
//
// `resolverPrevisualizacion` (4º método, sumado por `documentos-previsualizacion`, design.md D6
// corrección) resuelve una URL firmada de expiración corta contra Storage — los 4 buckets siguen
// privados (D7), nunca se genera una URL pública.

const EXPIRACION_URL_FIRMADA_SEGUNDOS = 120; // "corta" (D6/D7) sin número fijado por design.md —
// alcanza para que el navegador cargue la imagen/PDF sin dejar la URL viva más de lo necesario.

// ---------------------------------------------------------------------------------------------
// Lectura (D4): una sola consulta a la tabla de la config, sin tocar Storage.
// ---------------------------------------------------------------------------------------------

// Corrección (2026-08-07, bug real hallado en verificación manual de tasks.md §9 de
// `documentos-checklist-por-actividad`): esta función ignoraba por completo `agrupacionId` —
// devolvía TODOS los documentos de la entidad sin importar de qué bloque se pedían, así que en
// Pacientes los tres bloques (General + cada actividad) mostraban exactamente los mismos
// documentos, y subir/quitar en uno se veía reflejado en los demás (misma fila para los tres).
// Ahora filtra por `config.columnaAgrupacion` (solo `paciente` la declara, ver
// documentoMapping.ts): con `agrupacionId`, solo esa agrupación puntual; sin él, solo los
// documentos SIN agrupación (`IS NULL`, no "todos") — mismo contrato que ya cumplía el mock
// (`mockDocumentoRepository.ts`). Vehículos/Conductores/Facturas no tienen `columnaAgrupacion`,
// así que el filtro nunca se aplica para esos tres dominios — cero cambio de comportamiento ahí.
async function listarDocumentos(
  entidad: EntidadDocumental,
  entidadId: string,
  agrupacionId?: string,
): Promise<DocumentoAdjunto[]> {
  const config = CONFIG_ENTIDAD[entidad];

  let query = supabase.schema(config.schema).from(config.tabla).select('*').eq(config.columnaEntidad, entidadId);
  if (config.columnaAgrupacion !== undefined) {
    query =
      agrupacionId !== undefined
        ? query.eq(config.columnaAgrupacion, agrupacionId)
        : query.is(config.columnaAgrupacion, null);
  }
  const { data, error } = await query;

  if (error) throw mapearErrorDocumento(error, { operacion: 'listar', entidad });

  return ensamblarDocumentos(data, config);
}

// ---------------------------------------------------------------------------------------------
// Helpers de fila cruda (locales — `documentoMapping.ts` solo expone la forma pública
// `DocumentoAdjunto`, nunca la clave de Storage cruda que acá hace falta para `remove`/
// `resolverPrevisualizacion`).
// ---------------------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** `archivo_url` guarda la clave dentro del bucket, no una URL (design.md D3/comentario de
 * columna de la migración del Checkpoint 2). Ausente o de tipo distinto a `string` -> `null`. */
function claveStorageDeFila(row: unknown): string | null {
  if (!isRecord(row)) return null;
  return typeof row.archivo_url === 'string' && row.archivo_url !== '' ? row.archivo_url : null;
}

// ---------------------------------------------------------------------------------------------
// Alta (D4, algoritmo corregido): UPLOAD -> INSERT. Sin SELECT ni DELETE previos: cada upload
// agrega un documento nuevo a la colección, nunca reemplaza uno existente.
// ---------------------------------------------------------------------------------------------

async function subirDocumento(
  entidad: EntidadDocumental,
  entidadId: string,
  itemId: string,
  file: File,
  // Aceptado por firma (contrato de `DocumentoRepository`), no persistido: ninguna de las 4 tablas
  // reales tiene columna para `vigenciaDesde` (mismo criterio que `documentoMapping.ts` §3.6 con
  // `vigenciaDesde`/`tipoMime` en `DocumentoAdjunto`, design.md D4 corrección).
  _vigenciaDesde?: string,
  // Corrección (2026-08-07, mismo bug que `listarDocumentos`): antes esta firma ni siquiera
  // declaraba `agrupacionId` — el 6.º argumento que le mandaba `useDocumentChecklist.ts` se
  // perdía en silencio, así que ningún documento de Pacientes quedaba asociado a su actividad.
  // Se reenvía tal cual a `toInsertPayload`, que decide si la entidad tiene dónde guardarlo.
  agrupacionId?: string,
): Promise<DocumentoAdjunto> {
  const config = CONFIG_ENTIDAD[entidad];
  const clave = construirClaveStorage(entidadId, itemId, file.name, crypto.randomUUID());

  const { error: errorUpload } = await supabase.storage.from(config.bucket).upload(clave, file, { upsert: false });
  if (errorUpload) throw mapearErrorDocumento(errorUpload, { operacion: 'subir', entidad });

  const payload = toInsertPayload(entidadId, itemId, clave, file.name, config, agrupacionId);
  const { data, error: errorInsert } = await supabase
    .schema(config.schema)
    .from(config.tabla)
    .insert(payload)
    .select()
    .single();

  if (errorInsert) {
    // Compensación (D4): si el INSERT falla, el objeto recién subido queda huérfano si no se
    // limpia. Best-effort — su propio fallo NUNCA oculta el error real del INSERT.
    try {
      await supabase.storage.from(config.bucket).remove([clave]);
    } catch {
      // Un huérfano en Storage es tolerable (D4, criterio central de la sección); un puntero roto
      // no lo es. No hay puntero roto acá porque el INSERT nunca llegó a escribirse.
    }
    throw mapearErrorDocumento(errorInsert, { operacion: 'subir', entidad });
  }

  const documento = parseDocumentoRow(data, config);
  if (!documento) throw new Error(MSG_NO_SE_PUDO_GUARDAR);
  return documento;
}

// ---------------------------------------------------------------------------------------------
// Baja (D4): SELECT por `id` (=documentoId), scoped a la entidad -> DELETE fila -> REMOVE objeto
// (best-effort). Idempotente: si la fila no existe (o no pertenece a esta entidad), resuelve sin
// error, igual que el mock.
// ---------------------------------------------------------------------------------------------

async function quitarDocumento(entidad: EntidadDocumental, entidadId: string, documentoId: string): Promise<void> {
  const config = CONFIG_ENTIDAD[entidad];

  const { data, error: errorSelect } = await supabase
    .schema(config.schema)
    .from(config.tabla)
    .select('*')
    .eq('id', documentoId)
    .eq(config.columnaEntidad, entidadId)
    .maybeSingle();

  if (errorSelect) throw mapearErrorDocumento(errorSelect, { operacion: 'quitar', entidad });
  if (data === null || data === undefined) return; // idempotente (D4), igual que el mock

  const clave = claveStorageDeFila(data);

  const { error: errorDelete } = await supabase.schema(config.schema).from(config.tabla).delete().eq('id', documentoId);
  if (errorDelete) throw mapearErrorDocumento(errorDelete, { operacion: 'quitar', entidad });

  if (clave) {
    try {
      await supabase.storage.from(config.bucket).remove([clave]);
    } catch {
      // Best-effort (D4): el dominio ya quedó consistente (la fila se borró); un huérfano en
      // Storage es tolerable y nunca bloquea la baja.
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Previsualización (4º método, design.md D6 corrección): SELECT scoped a la entidad para (a)
// confirmar pertenencia y (b) obtener la clave -> `createSignedUrl` de expiración corta. `null`
// (nunca lanza) cuando no hay nada que ver; un fallo real de Storage sí se propaga traducido.
// ---------------------------------------------------------------------------------------------

async function resolverPrevisualizacionDocumento(
  entidad: EntidadDocumental,
  entidadId: string,
  documentoId: string,
): Promise<string | null> {
  const config = CONFIG_ENTIDAD[entidad];

  const { data, error: errorSelect } = await supabase
    .schema(config.schema)
    .from(config.tabla)
    .select('*')
    .eq('id', documentoId)
    .eq(config.columnaEntidad, entidadId)
    .maybeSingle();

  if (errorSelect) throw mapearErrorDocumento(errorSelect, { operacion: 'previsualizar', entidad });
  // No pertenece a `(entidad, entidadId)` o no existe -> "no hay nada que ver" (D6), nunca lanza.
  // No se llama `createSignedUrl` en este caso: no se filtra pertenencia a través del intento.
  if (data === null || data === undefined) return null;

  const clave = claveStorageDeFila(data);
  if (!clave) return null;

  const { data: firmada, error: errorFirma } = await supabase.storage
    .from(config.bucket)
    .createSignedUrl(clave, EXPIRACION_URL_FIRMADA_SEGUNDOS);

  if (errorFirma) throw mapearErrorDocumento(errorFirma, { operacion: 'previsualizar', entidad });
  return firmada?.signedUrl ?? null;
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores (D5) — dos fuentes de forma distinta: `PostgrestError` (`{ code, message
// }`) y `StorageError` (`{ name, message }`, sin `code`). Se angostan con type guards, nunca con
// `as`. Nunca se propaga `error.message` crudo a la UI.
// ---------------------------------------------------------------------------------------------

interface PostgrestErrorLike {
  code: string;
  message: string;
}

/** `PostgrestError` real siempre trae `code` (string) — es la señal que la distingue de
 * `StorageError` (design.md D5). */
function esPostgrestError(error: unknown): error is PostgrestErrorLike {
  if (!isRecord(error)) return false;
  return typeof error.code === 'string' && typeof error.message === 'string';
}

interface StorageErrorLike {
  name: string;
  message: string;
  status?: number;
}

/** `StorageError` real trae `name`/`message`, nunca `code` (design.md D5) — se angosta
 * explícitamente por la AUSENCIA de `code`, nunca con `as`. */
function esStorageError(error: unknown): error is StorageErrorLike {
  if (!isRecord(error)) return false;
  if ('code' in error) return false;
  return typeof error.name === 'string' && typeof error.message === 'string';
}

type OperacionError = 'listar' | 'subir' | 'quitar' | 'previsualizar';

const NOMBRE_PLURAL: Record<EntidadDocumental, string> = {
  paciente: 'pacientes',
  vehiculo: 'vehículos',
  conductor: 'conductores',
  factura: 'facturas',
};

const ARTICULO_SINGULAR: Record<EntidadDocumental, string> = {
  paciente: 'el paciente',
  vehiculo: 'el vehículo',
  conductor: 'el conductor',
  factura: 'la factura',
};

const MODULO_CAPITALIZADO: Record<EntidadDocumental, string> = {
  paciente: 'Pacientes',
  vehiculo: 'Vehículos',
  conductor: 'Conductores',
  factura: 'Facturación',
};

const MSG_CARGA_NO_HABILITADA = 'La carga de documentos no está habilitada en el servidor todavía.';
const MSG_ALMACENAMIENTO_NO_CONFIGURADO = 'El almacenamiento de documentos no está configurado.';
const MSG_ARCHIVO_DEMASIADO_GRANDE = 'El archivo es demasiado grande.';
const MSG_NO_SE_PUDO_GUARDAR = 'No se pudo guardar el documento.';
const MSG_NO_SE_PUDO_CARGAR = 'No se pudo cargar el documento.';

function msgSinPermisoTabla(entidad: EntidadDocumental): string {
  return `No tenés permiso para subir documentos de ${NOMBRE_PLURAL[entidad]}.`;
}

function msgEntidadInexistente(entidad: EntidadDocumental): string {
  return `No se encontró ${ARTICULO_SINGULAR[entidad]} de este documento. Puede que se haya eliminado.`;
}

function msgModuloNoHabilitado(entidad: EntidadDocumental): string {
  return `El módulo de ${MODULO_CAPITALIZADO[entidad]} no está habilitado en el servidor.`;
}

function msgSinPermisoStorage(entidad: EntidadDocumental): string {
  return `No tenés permiso para subir archivos de ${NOMBRE_PLURAL[entidad]}.`;
}

function mensajeGenerico(operacion: OperacionError): string {
  return operacion === 'listar' || operacion === 'previsualizar' ? MSG_NO_SE_PUDO_CARGAR : MSG_NO_SE_PUDO_GUARDAR;
}

/** Traduce un error de PostgREST/Storage a un `Error` con mensaje en castellano listo para la UI
 * (design.md D5). Tabla completa de los 9 códigos en D5 — cubre las 4 superficies (listar/subir/
 * quitar/previsualizar). Nunca propaga `error.message` crudo. */
function mapearErrorDocumento(error: unknown, contexto: { operacion: OperacionError; entidad: EntidadDocumental }): Error {
  if (esPostgrestError(error)) {
    const codigo = error.code;
    if (codigo === '42501' || codigo === 'PGRST301') return new Error(msgSinPermisoTabla(contexto.entidad));
    if (codigo === '23503') return new Error(msgEntidadInexistente(contexto.entidad));
    if (codigo === 'PGRST204') return new Error(MSG_CARGA_NO_HABILITADA);
    if (codigo === 'PGRST106' || codigo === 'PGRST205') return new Error(msgModuloNoHabilitado(contexto.entidad));
    return new Error(mensajeGenerico(contexto.operacion));
  }

  if (esStorageError(error)) {
    const status = error.status;
    if (status === 403) return new Error(msgSinPermisoStorage(contexto.entidad));
    if (status === 404) return new Error(MSG_ALMACENAMIENTO_NO_CONFIGURADO);
    if (status === 413) return new Error(MSG_ARCHIVO_DEMASIADO_GRANDE);
    if (status === 409) return new Error(MSG_NO_SE_PUDO_GUARDAR);
    return new Error(mensajeGenerico(contexto.operacion));
  }

  return new Error(mensajeGenerico(contexto.operacion));
}

// ---------------------------------------------------------------------------------------------

export const supabaseDocumentoRepository: DocumentoRepository = {
  listByEntity: listarDocumentos,
  upload: subirDocumento,
  remove: quitarDocumento,
  resolverPrevisualizacion: resolverPrevisualizacionDocumento,
};
