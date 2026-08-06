import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
import { generateId } from '../id';
import type { DocumentoRepository } from './DocumentoRepository';

const store = new Map<string, DocumentoAdjunto[]>();

// documentos-previsualizacion (tasks.md 2.1/2.4, design.md D1/D2/D6): contenido resoluble por
// documentoId, separado del store de DocumentoAdjunto — la URL NUNCA viaja en el modelo público
// (D1), se resuelve bajo demanda vía resolverPrevisualizacion(). Sigue siendo memoria de sesión
// pura (un segundo Map, ningún localStorage) — no hace falta SCHEMA_VERSION (D6) porque no hay
// dato persistido con forma vieja que migrar: tanto `store` como este Map se vacían con la sesión
// del navegador, y el `File`/`Blob` detrás del ObjectURL tampoco sería serializable si algún día
// se agregara persistencia (esa sería una decisión aparte, no la de este change).
const contenidoPorDocumentoId = new Map<string, string>();

function keyOf(entidad: EntidadDocumental, entidadId: string): string {
  return `${entidad}:${entidadId}`;
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// Implementación en memoria — fixtures viven solo mientras dure la sesión del navegador.
// Cumple DocumentoRepository al pie de la letra para que el día que exista Storage real
// (C-03) el reemplazo sea mecánico.
export const mockDocumentoRepository: DocumentoRepository = {
  async listByEntity(entidad, entidadId) {
    return withLatency([...(store.get(keyOf(entidad, entidadId)) ?? [])]);
  },

  // pacientes-documentos-multiples: acumula en vez de reemplazar — ya no filtra por itemId antes
  // de agregar (Checkpoint (a), VEREDICTO Enzo 2026-08-06: sin límite, colección real).
  // documentos-previsualizacion (tasks.md 2.1, Checkpoint (a) Opción A): deja de descartar el
  // `File` — lo conserva vía ObjectURL en `contenidoPorDocumentoId` y puebla `tipoMime` desde
  // `file.type`. La forma pública de DocumentoAdjunto no cambia más allá de `tipoMime` (D1): la
  // URL no viaja en el modelo, vive solo en el store interno de contenido.
  async upload(entidad, entidadId, itemId, file, vigenciaDesde) {
    const k = keyOf(entidad, entidadId);
    const existing = store.get(k) ?? [];
    const nuevo: DocumentoAdjunto = {
      id: generateId('documento'),
      itemId,
      nombreArchivo: file.name,
      subidoEn: new Date().toISOString(),
      vigenciaDesde,
      tipoMime: file.type || undefined,
    };
    store.set(k, [...existing, nuevo]);
    contenidoPorDocumentoId.set(nuevo.id, URL.createObjectURL(file));
    return withLatency(nuevo);
  },

  // pacientes-documentos-multiples (design.md D1): apunta al documento puntual por su `id`, no
  // por `itemId` — con colección, "el" documento de un ítem deja de existir, puede haber N.
  // documentos-previsualizacion (tasks.md 2.3): además revoca el ObjectURL del documento
  // eliminado, para no filtrar memoria durante una sesión larga.
  async remove(entidad, entidadId, documentoId) {
    const k = keyOf(entidad, entidadId);
    store.set(k, (store.get(k) ?? []).filter((doc) => doc.id !== documentoId));
    const url = contenidoPorDocumentoId.get(documentoId);
    if (url !== undefined) {
      URL.revokeObjectURL(url);
      contenidoPorDocumentoId.delete(documentoId);
    }
    return withLatency(undefined);
  },

  // documentos-previsualizacion (tasks.md 2.2, design.md D2): devuelve el ObjectURL del documento
  // pedido, o `null` (nunca lanza) si ese id no tiene contenido resoluble — el caso normal para
  // documentos que ya existían antes de este change (no hay File que recuperar retroactivamente)
  // o para un id que no pertenece a esta entidad. Se verifica pertenencia contra la lista pública
  // de la entidad (no solo el store de contenido) para no filtrar existencia de documentos de
  // otras entidades/entidadId a través de este método.
  async resolverPrevisualizacion(entidad, entidadId, documentoId) {
    const documentos = store.get(keyOf(entidad, entidadId)) ?? [];
    const perteneceAEstaEntidad = documentos.some((doc) => doc.id === documentoId);
    if (!perteneceAEstaEntidad) return withLatency(null);
    return withLatency(contenidoPorDocumentoId.get(documentoId) ?? null);
  },
};

// documentos-previsualizacion (tasks.md 2.2): solo para tests. Simula el estado de un documento
// que ya existía en el store antes de este change — presente en listByEntity() pero sin contenido
// resoluble en resolverPrevisualizacion(). La API pública del mock no puede producir ese estado
// por sí sola porque, desde este change, upload() siempre guarda contenido junto al documento; el
// test necesita construirlo directamente para probar la degradación explícita del contrato (D2).
export function seedDocumentoSinContenidoParaTest(
  entidad: EntidadDocumental,
  entidadId: string,
  documento: DocumentoAdjunto,
): void {
  const k = keyOf(entidad, entidadId);
  store.set(k, [...(store.get(k) ?? []), documento]);
}
