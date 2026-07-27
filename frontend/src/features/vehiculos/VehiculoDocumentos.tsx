import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import { VEHICULO_DOCUMENTOS_ITEMS } from './vehiculoDocumentosItems';

interface VehiculoDocumentosProps {
  vehiculoId: string;
  repository: DocumentoRepository;
}

// Documentos del vehículo (tasks.md 8.2, RF-506): reutiliza el renderer DocumentChecklist y el
// hook useDocumentChecklist de FE-1 con entidad = 'vehiculo', sin modelo documental paralelo
// (design.md Decisión 5).
export function VehiculoDocumentos({ vehiculoId, repository }: VehiculoDocumentosProps) {
  const { items, documentos, upload, remove } = useDocumentChecklist(
    'vehiculo',
    vehiculoId,
    VEHICULO_DOCUMENTOS_ITEMS,
    repository,
  );

  return <DocumentChecklist items={items} documentos={documentos} onUpload={upload} onRemove={remove} />;
}
