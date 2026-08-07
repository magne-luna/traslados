import { AvisoModeloDatos } from '../../design-system/components';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import type { ChecklistItem } from '../../shared/types/documento';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';

interface FacturaDocumentosProps {
  facturaId: string;
  /** `obraSocial.checklist` del paciente (RN-FA-08): el orden del array es significativo. */
  items: ChecklistItem[];
  repository: DocumentoRepository;
}

// Checklist documental por factura (tasks.md 10.1 a 10.4): reutiliza DocumentChecklist +
// useDocumentChecklist + DocumentoRepository de C-03/FE-1 con entidad='factura' (ya presente en
// EntidadDocumental), mismo patrón que PacienteDocumentosChecklist/ConductorDocumentos. Los
// ítems salen del checklist de la obra social del paciente, respetando su orden (RN-FA-08); el
// comprobante ARCA es un ítem más, sin cliente HTTP ni campo de modelo propio (design.md
// Decisión 9) — solo se informa el estado de completitud, no bloquea la emisión.
// gateo-facturacion (design.md D4, tasks.md 6.3): solo la carga/baja se gatea, vía la prop
// `readOnly` que `DocumentChecklist` ya expone — se reutiliza tal cual, sin tocar el componente
// compartido. La consulta de `items`/`documentos` no pasa por acá, así que sigue disponible con
// solo `read`: el gateo del cliente nunca debe ser más restrictivo que la RLS del servidor, que
// ya autoriza esa lectura.
//
// previsualización (documentos-previsualizacion tasks.md 6.2, gap cerrado): mismo cableado que
// VehiculoDocumentos/PacienteDocumentosChecklist — `resolverPrevisualizacion`/
// `revocarPrevisualizacion` de `useDocumentChecklist` pasan a `DocumentChecklist` para que "Ver"
// se renderice de verdad también acá.
export function FacturaDocumentos({ facturaId, items, repository }: FacturaDocumentosProps) {
  const { documentos, upload, remove, resolverPrevisualizacion, revocarPrevisualizacion } = useDocumentChecklist(
    'factura',
    facturaId,
    items,
    repository,
  );
  const puedeEscribir = usePuedeEscribir();

  return (
    <div className="flex flex-col gap-sm">
      <AvisoModeloDatos>
        La tabla <code>documento_factura</code> ya existe (C-03), pero la subida real de
        documentos de Factura sigue siendo simulada porque <code>Factura</code> todavía usa datos
        mock (swap parcial, 2026-08-05).
      </AvisoModeloDatos>
      <DocumentChecklist
        items={items}
        documentos={documentos}
        onUpload={upload}
        onRemove={remove}
        readOnly={!puedeEscribir}
        onResolverPrevisualizacion={resolverPrevisualizacion}
        onRevocarPrevisualizacion={revocarPrevisualizacion}
      />
    </div>
  );
}
