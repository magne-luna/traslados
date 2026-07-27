import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import type { ChecklistItem } from '../../shared/types/documento';

interface PacienteDocumentosChecklistProps {
  pacienteId: string;
  items: ChecklistItem[];
  repository: DocumentoRepository;
}

// Wrapper delgado que llama a useDocumentChecklist con entidad 'paciente' (tasks.md 9.1),
// mismo patrón que VehiculoDocumentos (FE-2). Separado de PacienteDocumentos.tsx para que el
// hook (que dispara su propio fetch por entidad) solo se monte una vez resuelto el checklist de
// la obra social — nunca con `items` vacío por estar aún cargando.
export function PacienteDocumentosChecklist({ pacienteId, items, repository }: PacienteDocumentosChecklistProps) {
  const { documentos, upload, remove } = useDocumentChecklist('paciente', pacienteId, items, repository);

  return <DocumentChecklist items={items} documentos={documentos} onUpload={upload} onRemove={remove} />;
}
