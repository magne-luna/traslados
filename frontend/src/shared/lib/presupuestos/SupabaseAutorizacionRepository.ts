import { supabase } from '../supabaseClient';
import type { Autorizacion } from '../../types/presupuesto';
import type { AutorizacionRepository } from './AutorizacionRepository';
import { esErrorNotFound, mapearErrorEdgeFunction } from './edgeFunctionErrors';
import { parseAutorizacionApi, toActualizarAutorizacionPayload, toCrearAutorizacionPayload } from './autorizacionMapping';
import { nombreArchivoSeguro } from '../documentos/documentoMapping';

// Implementación real de AutorizacionRepository (design.md D1/D2/D4/D7 del change
// `integracion-presupuestos`), mismo criterio que SupabasePresupuestoRepository.ts: toda la I/O
// pasa por la Edge Function `autorizaciones`, nunca PostgREST directo, y este archivo no consulta
// `modulos.permisos` ni `modulos.modulos` (el gateo real es del servidor, D3; verificado por test de
// código fuente, 3.10).

// Nadie lo importa todavía (tasks.md §3): el swap real ocurre en un único commit en la §4.
//
// `uploadArchivo`/`removeArchivo` (integracion-documentos-autorizaciones, tasks.md Fase 3, design.md
// D3/D5): el archivo sube DIRECTO navegador->Storage (bucket `documentos-autorizaciones`), la
// referencia se persiste con el mismo PATCH que usa `update()`. Reemplazo compensado (D5): sube el
// objeto nuevo -> PATCH -> borra el viejo; si el PATCH falla, borra el nuevo y deja la fila intacta
// (nunca un puntero roto — un huérfano en Storage sí es tolerable, mismo criterio que
// `SupabaseDocumentoRepository.subirDocumento`/`quitarDocumento`).

// ---------------------------------------------------------------------------------------------
// uploadArchivo()/removeArchivo() — helpers
// ---------------------------------------------------------------------------------------------

const BUCKET = 'documentos-autorizaciones';

/** Mismos 3 formatos que `storage-buckets` (spec `autorizacion-archivo-storage`, requirement
 * "Validación de tipo y tamaño antes de subir"). JPEG cubre `.jpg`/`.jpeg` (mismo `file.type`). */
const TIPOS_PERMITIDOS = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const TAMANO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10 MB, mismo límite que `storage-buckets`.

const MSG_TIPO_NO_PERMITIDO = 'El archivo debe ser PDF, JPG o PNG.';
const MSG_TAMANO_EXCEDIDO = 'El archivo no puede superar los 10 MB.';

/** Valida ANTES de tocar Storage (spec: "el sistema lo rechaza... antes de invocar
 * supabase.storage") — nunca sube un archivo inválido para descartarlo después. */
function validarArchivo(file: File): void {
  if (!TIPOS_PERMITIDOS.has(file.type)) throw new Error(MSG_TIPO_NO_PERMITIDO);
  if (file.size > TAMANO_MAXIMO_BYTES) throw new Error(MSG_TAMANO_EXCEDIDO);
}

/** `{autorizacionId}/{uuid}-{nombreSeguro}` (design.md D5/D2, spec "Clave de objeto determinista y
 * saneada") — un solo archivo por autorización, sin segmento de itemId (a diferencia de
 * `documentoMapping.construirClaveStorage`, que sí lo tiene: acá no hay colección). Mismo saneado
 * de nombre (`nombreArchivoSeguro`, reusado de `documentoMapping.ts`, no reimplementado). */
function construirClaveArchivo(autorizacionId: string, nombreArchivo: string, uuid: string): string {
  return `${autorizacionId}/${uuid}-${nombreArchivoSeguro(nombreArchivo)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface StorageErrorLike {
  name: string;
  message: string;
  status?: number;
}

/** `StorageError` real trae `name`/`message`, nunca `code` (mismo criterio que
 * `SupabaseDocumentoRepository.esStorageError`) — se angosta por la AUSENCIA de `code`, nunca con
 * `as`. */
function esStorageError(error: unknown): error is StorageErrorLike {
  if (!isRecord(error)) return false;
  if ('code' in error) return false;
  return typeof error.name === 'string' && typeof error.message === 'string';
}

const MSG_SIN_PERMISO_STORAGE = 'No tenés permiso para subir el archivo de la autorización.';
const MSG_ALMACENAMIENTO_NO_CONFIGURADO = 'El almacenamiento de autorizaciones no está configurado.';
const MSG_NO_SE_PUDO_SUBIR = 'No se pudo subir el archivo.';

function mapearErrorStorage(error: unknown): Error {
  if (esStorageError(error)) {
    if (error.status === 403) return new Error(MSG_SIN_PERMISO_STORAGE);
    if (error.status === 404) return new Error(MSG_ALMACENAMIENTO_NO_CONFIGURADO);
  }
  return new Error(MSG_NO_SE_PUDO_SUBIR);
}

// ---------------------------------------------------------------------------------------------
// getUrlArchivo() (presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 7.1/7.2, design.md
// D6b, spec `autorizacion-archivo-vista-previa`)
// ---------------------------------------------------------------------------------------------

// "Corta" (mismo criterio y mismo valor que SupabaseDocumentoRepository.ts, D6/D7 de
// `integracion-documentos`): alcanza para que el navegador abra la pestaña nueva o cargue el
// Overlay de vista previa sin dejar la URL firmada viva más tiempo del necesario.
const EXPIRACION_URL_FIRMADA_SEGUNDOS = 120;

const MSG_SIN_PERMISO_FIRMA = 'No tenés permiso para ver el archivo de la autorización.';
const MSG_ARCHIVO_NO_ENCONTRADO_STORAGE = 'No se encontró el archivo en el almacenamiento.';
const MSG_NO_SE_PUDO_FIRMAR = 'No se pudo generar el enlace del archivo.';

/** Spec "Error real de Storage se traduce": nunca se propaga el mensaje crudo de Storage. */
function mapearErrorFirma(error: unknown): Error {
  if (esStorageError(error)) {
    if (error.status === 403) return new Error(MSG_SIN_PERMISO_FIRMA);
    if (error.status === 404) return new Error(MSG_ARCHIVO_NO_ENCONTRADO_STORAGE);
  }
  return new Error(MSG_NO_SE_PUDO_FIRMAR);
}

/**
 * `'inline'` vs `'descarga'` (design.md D6b) — **inverso deliberado** del fix de
 * `SupabaseDocumentoRepository.ts:201-211` (2026-08-10, "Descargar lleva a otra página"). Ahí la
 * opción `download` se pasa SIEMPRE porque el caso base de ese repositorio es forzar la descarga.
 * Acá el caso base (`'inline'`) es lo opuesto: mostrar el PDF/imagen en una pestaña nueva o dentro
 * del Overlay de vista previa. Si `'inline'` pasara `download` iría a la opción de todos modos,
 * Storage respondería con `Content-Disposition: attachment` y el navegador DESCARGARÍA el archivo
 * en lugar de renderizarlo — sin importar `target="_blank"` en el `<a>` que abre la pestaña, esa
 * cabecera la decide el servidor, no el atributo del link (mismo razonamiento que el comentario
 * original, aplicado al revés). Por eso `'inline'` omite la opción por completo (ni siquiera la
 * pasa como `undefined` con nombre) y solo `'descarga'` la incluye, con el nombre real del
 * archivo. Un solo método con un modo explícito, no dos métodos separados, para que quede un único
 * lugar donde leer el porqué y nadie "unifique" los dos casos hacia uno solo.
 */
async function resolverUrlArchivo(id: string, modo: 'inline' | 'descarga'): Promise<string | null> {
  const actual = await obtenerAutorizacion(id);
  const archivo = actual?.archivo;
  // Sin archivo (o autorización inexistente) -> nada que firmar (D6b, mismo criterio que
  // `getById`/`getByPresupuestoId`: resuelve `null`, nunca lanza).
  if (!archivo?.clave) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(
      archivo.clave,
      EXPIRACION_URL_FIRMADA_SEGUNDOS,
      modo === 'descarga' ? { download: archivo.nombre } : undefined,
    );

  if (error) throw mapearErrorFirma(error);
  return data?.signedUrl ?? null;
}

/** GET compartido por `getById` y por `uploadArchivo`/`removeArchivo` (necesitan conocer la clave
 * vieja del archivo, si había, antes de tocar Storage). */
async function obtenerAutorizacion(id: string): Promise<Autorizacion | null> {
  const { data, error } = await supabase.functions.invoke(`autorizaciones/${id}`, { method: 'GET' });
  if (error) {
    if (esErrorNotFound(error)) return null;
    throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'obtener' });
  }
  return parseAutorizacionApi(data);
}

/** Best-effort (D5): un huérfano en Storage es tolerable, nunca debe ocultar el error real de la
 * operación que lo llama. */
async function eliminarObjetoBestEffort(clave: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([clave]);
  } catch {
    // Ver comentario de la función.
  }
}

/** Sube (o reemplaza) el archivo único de la autorización (design.md D3/D5). Orden: UPLOAD (clave
 * nueva) -> PATCH (fila) -> DELETE (clave vieja, best-effort). Si el PATCH falla, se borra la clave
 * NUEVA (compensación) y la fila queda intacta — nunca un puntero roto. */
async function subirArchivoAutorizacion(id: string, file: File): Promise<Autorizacion> {
  validarArchivo(file);

  const actual = await obtenerAutorizacion(id);
  const claveVieja = actual?.archivo?.clave;

  const clave = construirClaveArchivo(id, file.name, crypto.randomUUID());
  const { error: errorUpload } = await supabase.storage.from(BUCKET).upload(clave, file, { upsert: false });
  if (errorUpload) throw mapearErrorStorage(errorUpload);

  const cargadoEn = new Date().toISOString();
  const { data, error: errorPatch } = await supabase.functions.invoke(`autorizaciones/${id}`, {
    method: 'PATCH',
    // `archivoTipoMime` (tasks.md 7.3, design.md D6c): se persiste desde `File.type`, el dato
    // exacto que ya está en la mano en el momento de subir — nunca inferido acá (el fallback por
    // extensión vive solo en la vista previa, D6 "Fallback acotado", para filas subidas ANTES de
    // este campo).
    body: { archivoUrl: clave, archivoNombre: file.name, archivoCargadoEn: cargadoEn, archivoTipoMime: file.type },
  });

  if (errorPatch) {
    // Compensación (D5): el objeto ya está en Storage pero la fila nunca llegó a apuntarle. Se
    // borra para no dejar un huérfano permanente; la referencia anterior (`claveVieja`, si había)
    // no se toca — el PATCH nunca la reemplazó.
    await eliminarObjetoBestEffort(clave);
    throw await mapearErrorEdgeFunction(errorPatch, { entidad: 'autorizacion', operacion: 'actualizar', id });
  }

  if (claveVieja && claveVieja !== clave) {
    // Solo después de que el PATCH confirmó que la fila ya apunta a la clave nueva (D5).
    await eliminarObjetoBestEffort(claveVieja);
  }

  const actualizada = parseAutorizacionApi(data);
  if (!actualizada) throw new Error('No se pudo guardar la autorización.');
  return actualizada;
}

/** Quita el archivo adjunto: PATCH con los tres campos de metadata en `null` -> borra el objeto
 * viejo (best-effort). Idempotente (spec "Quitar cuando no hay archivo no falla"): si la
 * autorización no tiene archivo, resuelve sin tocar Storage ni la Edge Function. */
async function quitarArchivoAutorizacion(id: string): Promise<Autorizacion> {
  const actual = await obtenerAutorizacion(id);
  if (!actual) throw new Error(`No existe una autorización con id "${id}".`);

  const claveVieja = actual.archivo?.clave;
  if (!claveVieja) return actual; // nada que limpiar (idempotente)

  const { data, error } = await supabase.functions.invoke(`autorizaciones/${id}`, {
    method: 'PATCH',
    body: { archivoUrl: null, archivoNombre: null, archivoCargadoEn: null },
  });
  if (error) {
    throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'actualizar', id });
  }

  await eliminarObjetoBestEffort(claveVieja);

  const actualizada = parseAutorizacionApi(data);
  if (!actualizada) throw new Error('No se pudo guardar la autorización.');
  return actualizada;
}

// ---------------------------------------------------------------------------------------------

export const supabaseAutorizacionRepository: AutorizacionRepository = {
  async list() {
    const { data, error } = await supabase.functions.invoke('autorizaciones', { method: 'GET' });
    if (error) {
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'listar' });
    }

    const filas = Array.isArray(data) ? data : [];
    const autorizaciones = [];
    for (const fila of filas) {
      const parseada = parseAutorizacionApi(fila);
      if (parseada) autorizaciones.push(parseada);
    }
    return autorizaciones;
  },

  getById: obtenerAutorizacion,

  async getByPresupuestoId(presupuestoId) {
    // `presupuestoId` va como querystring, no como segmento de path (D4/nota de implementación):
    // percent-encoded para no romper la URL si algún día deja de ser un UUID limpio.
    const { data, error } = await supabase.functions.invoke(`autorizaciones?presupuestoId=${encodeURIComponent(presupuestoId)}`, {
      method: 'GET',
    });
    if (error) {
      // El 404 acá es el caso normal (todavía no hay autorización asociada), no un error — mismo
      // criterio que getById.
      if (esErrorNotFound(error)) return null;
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'obtener' });
    }
    return parseAutorizacionApi(data);
  },

  async create(nueva) {
    const { data, error } = await supabase.functions.invoke('autorizaciones', {
      method: 'POST',
      body: toCrearAutorizacionPayload(nueva),
    });
    if (error) {
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'crear' });
    }
    const creada = parseAutorizacionApi(data);
    if (!creada) throw new Error('No se pudo guardar la autorización.');
    return creada;
  },

  async update(id, cambios) {
    const { data, error } = await supabase.functions.invoke(`autorizaciones/${id}`, {
      method: 'PATCH',
      body: toActualizarAutorizacionPayload(cambios),
    });
    if (error) {
      // Asimetría con getById (mismo criterio que SupabasePresupuestoRepository.update, 3.7): acá
      // el 404 SÍ lanza, con el mismo mensaje que ya lanza mockAutorizacionRepository.update().
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'actualizar', id });
    }
    const actualizada = parseAutorizacionApi(data);
    if (!actualizada) throw new Error('No se pudo guardar la autorización.');
    return actualizada;
  },

  uploadArchivo: subirArchivoAutorizacion,
  removeArchivo: quitarArchivoAutorizacion,
  getUrlArchivo: resolverUrlArchivo,
};
