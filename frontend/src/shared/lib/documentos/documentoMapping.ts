// Mapeo puro fila<->dominio para Documentos (tasks.md §3, design.md D1/D2/D3/D4 del change
// `integracion-documentos`). Funciones exportadas, sin red, sin Supabase. Todo dato externo llega
// tipado `unknown` y se angosta con guardas explícitas — nunca queda sin tipar ni se fuerza contra
// su forma real. `SupabaseDocumentoRepository.ts` (§4) es la única capa de I/O; acá solo se
// traduce.
//
// Nombres de tabla/columna tomados LITERALMENTE del schema real, verificado con
// `supabase db query --linked` (2026-08-06) — la migración `20260806190000_documentos_nombre_archivo.sql`
// que agrega `nombre_archivo`/`created_at` ya está aplicada en el remoto al momento de escribir
// este archivo.
//
// ⚠️ Nota de deriva respecto de `design.md` (documentada acá, no descubierta en silencio): D2/D3
// describían `DocumentoAdjunto` como `{ itemId, nombreArchivo, subidoEn }`. Desde entonces
// `pacientes-documentos-multiples` y `documentos-previsualizacion` (ya aplicados, ver
// `shared/types/documento.ts`) le agregaron `id` (identifica el documento puntual dentro de la
// colección del mismo `itemId`, necesario para que `remove()` no dependa de `itemId`),
// `vigenciaDesde?` y `tipoMime?`. `id` se resuelve acá con la columna `id` (clave primaria, igual
// en las 4 tablas). `vigenciaDesde`/`tipoMime` NO tienen columna persistida en ninguna de las 4
// tablas reales (fuera del alcance aditivo de este change) — quedan `undefined`, que es válido
// porque el tipo los declara opcionales. No se inventa ninguna columna nueva acá.
import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';

export interface ConfiguracionEntidad {
  readonly schema: 'pacientes' | 'conductores' | 'facturacion';
  readonly tabla: string;
  readonly columnaEntidad: string; // FK a la entidad dueña
  readonly columnaItem: string; // dónde vive el itemId (UUID de tipos_documento o TEXT libre)
  readonly bucket: string;
  readonly modulo: string; // solo redacta el mensaje de error — nunca autoriza (design.md D2/D7)
}

// -------------------------------------------------------------------------------------------
// 3.1/3.2 — CONFIG_ENTIDAD (design.md D2). `Record<EntidadDocumental, …>` sobre la unión cerrada:
// si se agrega una quinta entidad sin cablear su fila acá, `tsc` falla en este archivo.
// -------------------------------------------------------------------------------------------

export const CONFIG_ENTIDAD: Record<EntidadDocumental, ConfiguracionEntidad> = {
  paciente: {
    schema: 'pacientes',
    tabla: 'documentos',
    columnaEntidad: 'paciente_id',
    columnaItem: 'id_tipo_documento',
    bucket: 'documentos-pacientes',
    modulo: 'pacientes',
  },
  vehiculo: {
    schema: 'conductores',
    tabla: 'documentacion_vehiculo',
    columnaEntidad: 'vehiculo_id',
    columnaItem: 'tipo_documento',
    bucket: 'documentos-vehiculos',
    modulo: 'vehiculos',
  },
  conductor: {
    schema: 'conductores',
    tabla: 'documentacion_conductores',
    columnaEntidad: 'conductor_id',
    columnaItem: 'tipo_documento',
    bucket: 'documentos-conductores',
    modulo: 'conductores',
  },
  factura: {
    schema: 'facturacion',
    tabla: 'documento_factura',
    columnaEntidad: 'factura_id',
    columnaItem: 'id_tipo_documento',
    bucket: 'documentos-facturas',
    modulo: 'facturacion',
  },
};

// -------------------------------------------------------------------------------------------
// 3.3/3.4 — nombreArchivoSeguro (design.md D3): minúsculas, NFD sin diacríticos, todo lo que no
// sea [a-z0-9.-] pasa a '-', colapsa guiones repetidos, recorta a 100 caracteres preservando la
// extensión. Es puro higiene de la clave de Storage — el nombre que ve la usuaria vive en la
// columna `nombre_archivo`, no en la clave.
// -------------------------------------------------------------------------------------------

const LONGITUD_MAXIMA_NOMBRE = 100;
const RANGO_DIACRITICOS = /[\u0300-\u036f]/g;
const CARACTERES_NO_PERMITIDOS = /[^a-z0-9.-]/g;
const GUIONES_REPETIDOS = /-+/g;

function recortarPreservandoExtension(nombre: string, longitudMaxima: number): string {
  if (nombre.length <= longitudMaxima) return nombre;

  const indiceDelPunto = nombre.lastIndexOf('.');
  const sinExtensionReconocible = indiceDelPunto <= 0;
  if (sinExtensionReconocible) return nombre.slice(0, longitudMaxima);

  const extension = nombre.slice(indiceDelPunto);
  const longitudMaximaDeBase = longitudMaxima - extension.length;
  if (longitudMaximaDeBase <= 0) return nombre.slice(0, longitudMaxima);

  const base = nombre.slice(0, indiceDelPunto);
  return base.slice(0, longitudMaximaDeBase) + extension;
}

export function nombreArchivoSeguro(nombre: string): string {
  const minusculas = nombre.toLowerCase();
  const sinDiacriticos = minusculas.normalize('NFD').replace(RANGO_DIACRITICOS, '');
  const saneado = sinDiacriticos.replace(CARACTERES_NO_PERMITIDOS, '-').replace(GUIONES_REPETIDOS, '-');
  return recortarPreservandoExtension(saneado, LONGITUD_MAXIMA_NOMBRE);
}

// -------------------------------------------------------------------------------------------
// 3.5 — construirClaveStorage (design.md D3): {entidadId}/{itemId}/{uuid}-{nombreSeguro}. El
// uuid entra por parámetro, nunca se genera adentro — es lo que vuelve a la función pura y
// testeable sin mockear crypto.
// -------------------------------------------------------------------------------------------

export function construirClaveStorage(
  entidadId: string,
  itemId: string,
  nombreArchivo: string,
  uuid: string,
): string {
  return `${entidadId}/${itemId}/${uuid}-${nombreArchivoSeguro(nombreArchivo)}`;
}

// -------------------------------------------------------------------------------------------
// 3.6 — parseDocumentoRow (design.md CP2/D2/D3). Angosta `unknown` con guardas de tipo explícitas
// — nunca deja el dato sin tipar ni fuerza una conversión. Fila malformada -> `null` (nunca rompe
// la colección que la contiene).
// -------------------------------------------------------------------------------------------

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function ultimoSegmentoDeClave(clave: string): string {
  const partes = clave.split('/');
  const ultima = partes[partes.length - 1];
  return ultima ?? '';
}

/** `pacientes.documentos`/`conductores.documentacion_vehiculo`/`conductores.documentacion_conductores`/
 * `facturacion.documento_factura` (una fila, según `config`) -> `DocumentoAdjunto`.
 *
 * `id` sale de la columna `id` (clave primaria, igual en las 4 tablas): sin ella, la fila no es
 * usable (no hay a qué documento puntual apuntaría `remove()`), se descarta.
 * `itemId` sale de `config.columnaItem` — ausente o de tipo distinto a `string` -> `null`, no se
 * inventa ningún valor.
 * `nombre_archivo` es `TEXT` nullable en el schema real (Checkpoint 2, `nombre_archivo TEXT` sin
 * `NOT NULL`): si viene `null`/ausente/vacío, degrada al último segmento de `archivo_url` (que
 * guarda la clave dentro del bucket, no una URL — design.md D3) en vez de romper la fila.
 * `created_at` puede faltar en filas parciales o de un backend anterior a la migración del
 * Checkpoint 2: degrada a `''` sin lanzar — nunca inventa una fecha. */
export function parseDocumentoRow(row: unknown, config: ConfiguracionEntidad): DocumentoAdjunto | null {
  if (!esRegistro(row)) return null;

  const id = row.id;
  if (typeof id !== 'string' || id === '') return null;

  const itemId = row[config.columnaItem];
  if (typeof itemId !== 'string' || itemId === '') return null;

  const archivoUrl = typeof row.archivo_url === 'string' ? row.archivo_url : '';

  const nombreArchivoCrudo = row.nombre_archivo;
  const nombreArchivo =
    typeof nombreArchivoCrudo === 'string' && nombreArchivoCrudo !== ''
      ? nombreArchivoCrudo
      : ultimoSegmentoDeClave(archivoUrl);

  const createdAtCrudo = row.created_at;
  const subidoEn = typeof createdAtCrudo === 'string' ? createdAtCrudo : '';

  return { id, itemId, nombreArchivo, subidoEn };
}

// -------------------------------------------------------------------------------------------
// 3.7 — ensamblarDocumentos: descarta las filas `null` sin propagar. `rows` que no es un array ->
// colección vacía, nunca lanza.
// -------------------------------------------------------------------------------------------

export function ensamblarDocumentos(rows: unknown, config: ConfiguracionEntidad): DocumentoAdjunto[] {
  if (!Array.isArray(rows)) return [];

  const documentos: DocumentoAdjunto[] = [];
  for (const row of rows) {
    const documento = parseDocumentoRow(row, config);
    if (documento !== null) documentos.push(documento);
  }
  return documentos;
}

// -------------------------------------------------------------------------------------------
// 3.8 — toInsertPayload (design.md D2/Checkpoint 1): arma el objeto de inserción con nombres de
// columna dinámicos según `config`. Las dos formas del Checkpoint 1 salen del mismo código: para
// paciente/factura `columnaItem` es `id_tipo_documento` (FK a `tipos_documento`); para
// vehículo/conductor es `tipo_documento` (TEXT libre) — acá no hay ninguna rama por entidad.
// -------------------------------------------------------------------------------------------

export type DocumentoInsertPayload = Record<string, string>;

export function toInsertPayload(
  entidadId: string,
  itemId: string,
  clave: string,
  nombreArchivo: string,
  config: ConfiguracionEntidad,
): DocumentoInsertPayload {
  return {
    [config.columnaEntidad]: entidadId,
    [config.columnaItem]: itemId,
    archivo_url: clave,
    nombre_archivo: nombreArchivo,
  };
}
