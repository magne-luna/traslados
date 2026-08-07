import { FieldGroupHeading } from '../../design-system/components';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import type { ChecklistItem } from '../../shared/types/documento';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';

interface PacienteDocumentosChecklistProps {
  pacienteId: string;
  items: ChecklistItem[];
  repository: DocumentoRepository;
  /** documentos-checklist-por-actividad (tasks.md 3.6, design.md Checkpoint (b) VEREDICTO opción
   * B): agrupa este checklist dentro de una actividad puntual del paciente (`Direccion.id`).
   * `undefined` = bloque "General" — documentos sin actividad (Checkpoint (c)). Se reenvía tal
   * cual al hook, que a su vez lo reenvía al repository (§2, ya implementado). */
  agrupacionId?: string;
  /** Encabezado visible de este bloque — qué actividad es (o la etiqueta del bloque "General").
   * Sin `label`, no se renderiza ningún encabezado propio (compatibilidad hacia atrás), aunque
   * hoy todo caller de este componente (PacienteDocumentos.tsx §3) pasa uno. */
  label?: string;
}

export function PacienteDocumentosChecklist({
  pacienteId,
  items,
  repository,
  agrupacionId,
  label,
}: PacienteDocumentosChecklistProps) {
  const { documentos, upload, remove, resolverPrevisualizacion, revocarPrevisualizacion } = useDocumentChecklist(
    'paciente', pacienteId, items, repository, agrupacionId,
  );
  // documentos-checklist-por-actividad (tasks.md 3.6, design.md D2): `readOnly={!puedeEscribir}`
  // se mantiene idéntico en las N instancias — ningún permiso por actividad, mismo criterio que
  // ya usaban gateo-pacientes/pacientes-documentos-multiples.
  const puedeEscribir = usePuedeEscribir();

  // role="group" + aria-label (en vez de un <div> plano): agrupa el encabezado y el checklist
  // como una unidad accesible con nombre — útil para lectores de pantalla con N bloques en la
  // misma pantalla, y da a los tests un ancla semántica estable para escopar cada bloque
  // (`getByRole('group', { name: label })`) sin depender de estructura de DOM incidental.
  return (
    <div role="group" aria-label={label}>
      {label && <FieldGroupHeading>{label}</FieldGroupHeading>}
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
