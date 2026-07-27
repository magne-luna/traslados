import type { DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
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

  async upload(entidad, entidadId, itemId, file) {
    const k = keyOf(entidad, entidadId);
    const existing = (store.get(k) ?? []).filter((doc) => doc.itemId !== itemId);
    const nuevo: DocumentoAdjunto = { itemId, nombreArchivo: file.name, subidoEn: new Date().toISOString() };
    store.set(k, [...existing, nuevo]);
    return withLatency(nuevo);
  },

  async remove(entidad, entidadId, itemId) {
    const k = keyOf(entidad, entidadId);
    store.set(k, (store.get(k) ?? []).filter((doc) => doc.itemId !== itemId));
    return withLatency(undefined);
  },
};
