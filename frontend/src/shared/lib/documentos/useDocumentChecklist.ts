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

  const upload = useCallback(
    async (itemId: string, file: File) => {
      const doc = await repository.upload(entidad, entidadId, itemId, file);
      setDocumentos((prev) => [...prev.filter((d) => d.itemId !== itemId), doc]);
    },
    [entidad, entidadId, repository],
  );

  const remove = useCallback(
    async (itemId: string) => {
      await repository.remove(entidad, entidadId, itemId);
      setDocumentos((prev) => prev.filter((d) => d.itemId !== itemId));
    },
    [entidad, entidadId, repository],
  );

  return { items, documentos, loading, upload, remove };
}
