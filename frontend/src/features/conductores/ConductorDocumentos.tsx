import { Chip } from '../../design-system/components';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import { CONDUCTOR_DOCUMENTOS_ITEMS } from './conductorDocumentosItems';

interface ConductorDocumentosProps {
  conductorId: string;
  repository: DocumentoRepository;
}

// Documentos del conductor (tasks.md 7.2, 9.4): reutiliza el renderer DocumentChecklist y el
// hook useDocumentChecklist de FE-1 con entidad = 'conductor', sin modelo documental paralelo
// (design.md Decisión 8).
export function ConductorDocumentos({ conductorId, repository }: ConductorDocumentosProps) {
  const { items, documentos, upload, remove } = useDocumentChecklist(
    'conductor',
    conductorId,
    CONDUCTOR_DOCUMENTOS_ITEMS,
    repository,
  );

  return (
    <div className="flex flex-col gap-sm">
      <Chip kind="warning">
        ⚠️ Pendiente de confirmar con el cliente: documentos a precargar (licencia/DNI/apto médico)
      </Chip>
      <DocumentChecklist items={items} documentos={documentos} onUpload={upload} onRemove={remove} />
    </div>
  );
}
