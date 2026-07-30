import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';
import { VEHICULO_DOCUMENTOS_ITEMS } from './vehiculoDocumentosItems';

interface VehiculoDocumentosProps {
  vehiculoId: string;
  repository: DocumentoRepository;
}

// Documentos del vehículo (tasks.md 8.2, RF-506): reutiliza el renderer DocumentChecklist y el
// hook useDocumentChecklist de FE-1 con entidad = 'vehiculo', sin modelo documental paralelo
// (design.md Decisión 5).
//
// gateo-conductores (design.md D5, tasks.md 4.3): solo la carga/baja se gatea, vía la prop
// `readOnly` que DocumentChecklist ya expone. La consulta de `items`/`documentos` no pasa por
// acá, así que sigue disponible con solo `read`.
export function VehiculoDocumentos({ vehiculoId, repository }: VehiculoDocumentosProps) {
  const { items, documentos, upload, remove } = useDocumentChecklist(
    'vehiculo',
    vehiculoId,
    VEHICULO_DOCUMENTOS_ITEMS,
    repository,
  );
  const puedeEscribir = usePuedeEscribir();

  return (
    <DocumentChecklist items={items} documentos={documentos} onUpload={upload} onRemove={remove} readOnly={!puedeEscribir} />
  );
}
