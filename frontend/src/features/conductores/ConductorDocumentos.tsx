import { AvisoModeloDatos, Chip } from '../../design-system/components';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';
import { CONDUCTOR_DOCUMENTOS_ITEMS } from './conductorDocumentosItems';

interface ConductorDocumentosProps {
  conductorId: string;
  repository: DocumentoRepository;
}

// Documentos del conductor (tasks.md 7.2, 9.4): reutiliza el renderer DocumentChecklist y el
// hook useDocumentChecklist de FE-1 con entidad = 'conductor', sin modelo documental paralelo
// (design.md Decisión 8).
//
// gateo-conductores (design.md D5, tasks.md 2.6): solo la carga/baja se gatea, vía la prop
// `readOnly` que DocumentChecklist ya expone — se reutiliza tal cual, sin tocar el componente
// compartido. La consulta de `items`/`documentos` no pasa por acá, así que sigue disponible con
// solo `read`: el gateo del cliente nunca debe ser más restrictivo que la RLS del servidor.
//
// previsualización (documentos-previsualizacion tasks.md 6.2, gap cerrado): mismo cableado que
// VehiculoDocumentos/PacienteDocumentosChecklist — `resolverPrevisualizacion`/
// `revocarPrevisualizacion` de `useDocumentChecklist` pasan a `DocumentChecklist` para que "Ver"
// se renderice de verdad también acá.
export function ConductorDocumentos({ conductorId, repository }: ConductorDocumentosProps) {
  const { items, documentos, upload, remove, resolverPrevisualizacion, revocarPrevisualizacion } = useDocumentChecklist(
    'conductor',
    conductorId,
    CONDUCTOR_DOCUMENTOS_ITEMS,
    repository,
  );
  const puedeEscribir = usePuedeEscribir();

  return (
    <div className="flex flex-col gap-sm">
      <AvisoModeloDatos>
        La subida de documentos del conductor sigue siendo simulada (el archivo no se guarda) hasta
        que <code>integracion-conductores-vehiculos</code> aterrice.
      </AvisoModeloDatos>
      <Chip kind="warning">
        ⚠️ Pendiente de confirmar con el cliente: documentos a precargar (licencia/DNI/apto médico)
      </Chip>
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
