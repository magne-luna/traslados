import { AvisoModeloDatos } from '../../design-system/components';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import type { ChecklistItem } from '../../shared/types/documento';

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
export function FacturaDocumentos({ facturaId, items, repository }: FacturaDocumentosProps) {
  const { documentos, upload, remove } = useDocumentChecklist('factura', facturaId, items, repository);

  return (
    <div className="flex flex-col gap-sm">
      <AvisoModeloDatos>
        El docx no modela ninguna tabla de documentos por Factura (Discrepancia 2). El backend
        `C-07` debe crear <code>documento_factura</code>.
      </AvisoModeloDatos>
      <DocumentChecklist items={items} documentos={documentos} onUpload={upload} onRemove={remove} />
    </div>
  );
}
