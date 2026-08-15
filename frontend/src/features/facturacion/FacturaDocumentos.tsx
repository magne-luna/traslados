import { AvisoModeloDatos } from '../../design-system/components';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import type { ChecklistItem } from '../../shared/types/documento';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';

interface FacturaDocumentosProps {
  facturaId: string;
  /** `CHECKLIST_DOCUMENTOS_FACTURA` (fix directo RF-410, 2026-08-15): lista FIJA propia de
   * Facturación, independiente del checklist configurable de la obra social del paciente — el
   * orden del array es significativo. */
  items: ChecklistItem[];
  repository: DocumentoRepository;
}

// Checklist documental por factura (tasks.md 10.1 a 10.4): reutiliza DocumentChecklist +
// useDocumentChecklist + DocumentoRepository de C-03/FE-1 con entidad='factura' (ya presente en
// EntidadDocumental), mismo patrón que PacienteDocumentosChecklist/ConductorDocumentos. Los
// ítems salen de `CHECKLIST_DOCUMENTOS_FACTURA` (fix directo 2026-08-15) — antes salían del
// checklist de la obra social del paciente (RN-FA-08), dependencia incorrecta ya corregida: la
// documentación de respaldo de una factura no depende de la obra social. El comprobante ARCA es
// un ítem más, sin cliente HTTP ni campo de modelo propio (design.md Decisión 9) — solo se
// informa el estado de completitud, no bloquea la emisión.
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
        La tabla <code>documento_factura</code> ya existe en la base real (con FK a la factura,
        RLS y auditoría), pero los adjuntos de la factura todavía no se persisten junto con ella:
        la carga sigue siendo simulada. Se resuelve en el futuro change transversal de
        documentos/storage (mismo que Pacientes, Conductores y Vehículos), no en este.
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
