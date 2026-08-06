import { useCallback, useEffect, useState } from 'react';
import type { ChecklistItem, DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
import type { DocumentoRepository } from './DocumentoRepository';

// Wiring de estado entre <DocumentChecklist /> (presentacional) y un DocumentoRepository
// (mock hoy, Supabase Storage el día de mañana — ver DocumentoRepository.ts).
export function useDocumentChecklist(
  entidad: EntidadDocumental,
  entidadId: string,
  items: ChecklistItem[],
  repository: DocumentoRepository,
) {
  const [documentos, setDocumentos] = useState<DocumentoAdjunto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    repository.listByEntity(entidad, entidadId).then((docs) => {
      if (!active) return;
      setDocumentos(docs);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [entidad, entidadId, repository]);

  // pacientes-documentos-multiples (tasks.md 3.1): acumula en vez de reemplazar — ya no filtra
  // por itemId antes de agregar el documento nuevo al estado local.
  const upload = useCallback(
    async (itemId: string, file: File) => {
      const doc = await repository.upload(entidad, entidadId, itemId, file);
      setDocumentos((prev) => [...prev, doc]);
    },
    [entidad, entidadId, repository],
  );

  // pacientes-documentos-multiples (tasks.md 3.2, design.md D1): filtra por `id` del documento,
  // no por `itemId` — con colección, quitar "el" documento de un ítem deja de tener sentido.
  const remove = useCallback(
    async (documentoId: string) => {
      await repository.remove(entidad, entidadId, documentoId);
      setDocumentos((prev) => prev.filter((d) => d.id !== documentoId));
    },
    [entidad, entidadId, repository],
  );

  return { items, documentos, loading, upload, remove };
}
