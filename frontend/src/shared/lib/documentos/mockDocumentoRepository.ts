import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
import { generateId } from '../id';
import type { DocumentoRepository } from './DocumentoRepository';

const store = new Map<string, DocumentoAdjunto[]>();

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
  async upload(entidad, entidadId, itemId, file, vigenciaDesde) {
    const k = keyOf(entidad, entidadId);
    const existing = store.get(k) ?? [];
    const nuevo: DocumentoAdjunto = {
      id: generateId('documento'),
      itemId,
      nombreArchivo: file.name,
      subidoEn: new Date().toISOString(),
      vigenciaDesde,
    };
    store.set(k, [...existing, nuevo]);
    return withLatency(nuevo);
  },

  // pacientes-documentos-multiples (design.md D1): apunta al documento puntual por su `id`, no
  // por `itemId` — con colección, "el" documento de un ítem deja de existir, puede haber N.
  async remove(entidad, entidadId, documentoId) {
    const k = keyOf(entidad, entidadId);
    store.set(k, (store.get(k) ?? []).filter((doc) => doc.id !== documentoId));
    return withLatency(undefined);
  },
};
