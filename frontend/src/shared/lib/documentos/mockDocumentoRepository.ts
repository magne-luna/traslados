import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
import { generateId } from '../id';
import type { DocumentoRepository } from './DocumentoRepository';

const store = new Map<string, DocumentoAdjunto[]>();

// documentos-previsualizacion (tasks.md 2.1/2.4, design.md D1/D2/D6): contenido resoluble por
// documentoId, separado del store de DocumentoAdjunto — la URL NUNCA viaja en el modelo público
// (D1), se resuelve bajo demanda vía resolverPrevisualizacion(). Sigue siendo memoria de sesión
// pura (un segundo Map, ningún localStorage) — no hace falta SCHEMA_VERSION (D6) porque no hay
// dato persistido con forma vieja que migrar: tanto `store` como este Map se vacían con la sesión
// del navegador.
//
// Corrección (2026-08-06, bug real hallado en verificación manual de tasks.md 8.2): este Map
// guarda el `File`, NO una URL ya creada. Guardar la URL en `upload()` (como hacía antes) rompía
// cerrar-y-reabrir: `DocumentChecklist` revoca la URL al cerrar la ventana porque D2 la trata como
// efímera, y si siempre fuera "la misma" URL cacheada, la segunda apertura reusaba una `blob:` ya
// muerta → `ERR_FILE_NOT_FOUND`. Guardando el `File` y llamando `URL.createObjectURL(file)` recién
// en `resolverPrevisualizacion()` (bajo demanda, una vez por llamada), cada apertura obtiene una
// URL nueva — el mismo comportamiento que tendría una URL firmada real con expiración corta contra
// Storage. El `File`/`Blob` tampoco sería serializable si algún día se agregara persistencia (esa
// es una decisión aparte, no la de este change).
const archivoPorDocumentoId = new Map<string, File>();

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
  // `File` — lo conserva en `archivoPorDocumentoId` y puebla `tipoMime` desde `file.type`. La
  // forma pública de DocumentoAdjunto no cambia más allá de `tipoMime` (D1): el `File` no viaja en
  // el modelo, vive solo en el store interno de contenido. **No crea el ObjectURL acá** (ver
  // corrección arriba) — eso pasa recién bajo demanda, en `resolverPrevisualizacion()`.
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
    archivoPorDocumentoId.set(nuevo.id, file);
    return withLatency(nuevo);
  },

  // pacientes-documentos-multiples (design.md D1): apunta al documento puntual por su `id`, no
  // por `itemId` — con colección, "el" documento de un ítem deja de existir, puede haber N.
  // documentos-previsualizacion (corrección 2026-08-06): ya NO revoca ningún ObjectURL acá — el
  // mock no cachea una URL permanente que revocar (cada resolverPrevisualizacion() crea la suya y
  // el consumidor la revoca al cerrar la ventana, ver useDocumentChecklist.ts). Solo descarta el
  // `File`, para no retenerlo en memoria indefinidamente durante una sesión larga.
  async remove(entidad, entidadId, documentoId) {
    const k = keyOf(entidad, entidadId);
    store.set(k, (store.get(k) ?? []).filter((doc) => doc.id !== documentoId));
    archivoPorDocumentoId.delete(documentoId);
    return withLatency(undefined);
  },

  // documentos-previsualizacion (tasks.md 2.2, design.md D2, corrección 2026-08-06): crea un
  // ObjectURL NUEVO en cada llamada (nunca reutiliza uno viejo) — devuelve `null` (nunca lanza) si
  // ese id no tiene `File` asociado, el caso normal para documentos que ya existían antes de este
  // change (no hay `File` que recuperar retroactivamente) o para un id que no pertenece a esta
  // entidad. Se verifica pertenencia contra la lista pública de la entidad (no solo el store de
  // contenido) para no filtrar existencia de documentos de otras entidades/entidadId a través de
  // este método.
  async resolverPrevisualizacion(entidad, entidadId, documentoId) {
    const documentos = store.get(keyOf(entidad, entidadId)) ?? [];
    const perteneceAEstaEntidad = documentos.some((doc) => doc.id === documentoId);
    if (!perteneceAEstaEntidad) return withLatency(null);
    const file = archivoPorDocumentoId.get(documentoId);
    return withLatency(file ? URL.createObjectURL(file) : null);
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
