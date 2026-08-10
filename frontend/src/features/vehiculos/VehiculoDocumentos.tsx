import { AvisoModeloDatos } from '../../design-system/components';
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
  const { items, documentos, upload, remove, resolverPrevisualizacion, revocarPrevisualizacion } = useDocumentChecklist(
    'vehiculo',
    vehiculoId,
    VEHICULO_DOCUMENTOS_ITEMS,
    repository,
  );
  const puedeEscribir = usePuedeEscribir();

  return (
    <div className="flex flex-col gap-sm">
      <AvisoModeloDatos>
        La subida de documentos del vehículo sigue siendo simulada (el archivo no se guarda) hasta
        que <code>integracion-conductores-vehiculos</code> aterrice.
      </AvisoModeloDatos>
      <DocumentChecklist
        items={items}
        documentos={documentos}
        onUpload={upload}
        onRemove={remove}
        readOnly={!puedeEscribir}
        onResolverPrevisualizacion={resolverPrevisualizacion}
        onRevocarPrevisualizacion={revocarPrevisualizacion}
        // checklist-documental-progreso-visual (skill `prototype`, variante "Progreso visual"
        // elegida 2026-08-10 para Pacientes, extendida 2026-08-10 a los 4 dominios documentales
        // para consistencia — puramente visual, ver DocumentChecklist.tsx).
        variant="ring"
      />
    </div>
  );
}
