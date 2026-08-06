import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import type { ChecklistItem } from '../../shared/types/documento';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';

interface PacienteDocumentosChecklistProps {
  pacienteId: string;
  items: ChecklistItem[];
  repository: DocumentoRepository;
}

// Wrapper delgado que llama a useDocumentChecklist con entidad 'paciente' (tasks.md 9.1),
// mismo patrón que VehiculoDocumentos (FE-2). Separado de PacienteDocumentos.tsx para que el
// hook (que dispara su propio fetch por entidad) solo se monte una vez resuelto el checklist de
// la obra social — nunca con `items` vacío por estar aún cargando.
//
// gateo-pacientes (design.md D3, tasks.md 5.1/5.2): solo la carga/baja se gatea, vía la prop
// `readOnly` que `DocumentChecklist` ya expone (ChecklistEditor de obras-sociales-ui la usa para
// su vista previa) — se reutiliza tal cual, sin tocar el componente compartido. La consulta de
// `items`/`documentos` no pasa por acá, así que sigue disponible con solo `read`: el gateo del
// cliente nunca debe ser más restrictivo que la RLS del servidor, que ya autoriza esa lectura.
export function PacienteDocumentosChecklist({ pacienteId, items, repository }: PacienteDocumentosChecklistProps) {
  const { documentos, upload, remove, resolverPrevisualizacion, revocarPrevisualizacion } = useDocumentChecklist(
    'paciente',
    pacienteId,
    items,
    repository,
  );
  const puedeEscribir = usePuedeEscribir();

  return (
    <DocumentChecklist
      items={items}
      documentos={documentos}
      onUpload={upload}
      onRemove={remove}
      readOnly={!puedeEscribir}
      onResolverPrevisualizacion={resolverPrevisualizacion}
      onRevocarPrevisualizacion={revocarPrevisualizacion}
    />
  );
}
