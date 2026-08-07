import { useEffect, useRef, useState } from 'react';
import { FieldGroupHeading } from '../../design-system/components';
import { DocumentChecklist } from '../../shared/components/DocumentChecklist';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { useDocumentChecklist } from '../../shared/lib/documentos/useDocumentChecklist';
import type { ChecklistItem } from '../../shared/types/documento';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';
import { SeccionPlegable } from '../facturacion/SeccionPlegable';
import type { ProgresoInstancia } from './progresoDocumental';

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
  /** documentos-checklist-por-actividad (tasks.md 5.1, design.md Checkpoint (f) VEREDICTO opción
   * A): reporta el progreso propio de esta instancia (cargados/total, misma fórmula que
   * `DocumentChecklist.tsx` usa para su barra) al montar/cada vez que cambia — quien decide "hay
   * un total agregado" es `PacienteDocumentos.tsx` (D1), esta instancia solo informa su parte. */
  onProgreso?: (progreso: ProgresoInstancia) => void;
}

export function PacienteDocumentosChecklist({
  pacienteId,
  items,
  repository,
  agrupacionId,
  label,
  onProgreso,
}: PacienteDocumentosChecklistProps) {
  const { documentos, loading, upload, remove, resolverPrevisualizacion, revocarPrevisualizacion } = useDocumentChecklist(
    'paciente', pacienteId, items, repository, agrupacionId,
  );
  // documentos-checklist-por-actividad (tasks.md 3.6, design.md D2): `readOnly={!puedeEscribir}`
  // se mantiene idéntico en las N instancias — ningún permiso por actividad, mismo criterio que
  // ya usaban gateo-pacientes/pacientes-documentos-multiples.
  const puedeEscribir = usePuedeEscribir();

  // tasks.md 5.1: misma fórmula "cargado a nivel ítem" que DocumentChecklist.tsx (líneas 233-235)
  // — no se importa de ahí (ese componente no exporta el cálculo, y su contrato quedó fijado en
  // §4), se deriva acá con los mismos `items`/`documentos` que ya tiene esta instancia.
  const cargados = items.filter((item) => documentos.some((doc) => doc.itemId === item.id)).length;
  const total = items.length;

  useEffect(() => {
    onProgreso?.({ cargados, total });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onProgreso es un callback inline del
    // caller (identidad nueva en cada render de PacienteDocumentos); solo interesa re-reportar
    // cuando el progreso de ESTA instancia cambia, no cuando cambia la identidad del callback.
  }, [cargados, total]);

  // tasks.md 5.2, design.md Checkpoint (f): solo los bloques de actividad son colapsables (el
  // volumen que se multiplica por N es "actividades", no "General", que sigue siendo un único
  // bloque fijo) — arrancan colapsados si ya están completos, para no alargar la pantalla con
  // bloques que no necesitan atención. La decisión de colapsar se toma UNA sola vez, apenas
  // termina de resolver la carga inicial (`decidioColapsoInicial`): si el usuario reabre un bloque
  // completo a mano, no se vuelve a cerrar solo por un cambio posterior de `cargados`/`total`.
  const esActividad = agrupacionId !== undefined;
  const [abierta, setAbierta] = useState(true);
  const decidioColapsoInicial = useRef(false);

  useEffect(() => {
    if (!esActividad || loading || decidioColapsoInicial.current) return;
    decidioColapsoInicial.current = true;
    if (total > 0 && cargados === total) {
      setAbierta(false);
    }
  }, [esActividad, loading, cargados, total]);

  // role="group" + aria-label (en vez de un <div> plano): agrupa el encabezado y el checklist
  // como una unidad accesible con nombre — útil para lectores de pantalla con N bloques en la
  // misma pantalla, y da a los tests un ancla semántica estable para escopar cada bloque
  // (`getByRole('group', { name: label })`) sin depender de estructura de DOM incidental.
  const checklist = (
    <DocumentChecklist
      items={items}
      documentos={documentos}
      onUpload={upload}
      onRemove={remove}
      readOnly={!puedeEscribir}
      onResolverPrevisualizacion={resolverPrevisualizacion}
      onRevocarPrevisualizacion={revocarPrevisualizacion}
      // documentos-checklist-por-actividad (feedback directo de la usuaria, 2026-08-07): con N
      // instancias montadas (General + una por actividad), ya existe el total agregado de
      // PacienteDocumentos.tsx (tasks.md 5.1) — la barra individual de cada instancia queda
      // suprimida en las N, no solo en las actividades, para no repetir la misma información N+1
      // veces en una sola pantalla.
      mostrarProgreso={false}
    />
  );

  if (esActividad && label) {
    return (
      <div role="group" aria-label={label}>
        <SeccionPlegable
          titulo={label}
          resumen={total > 0 ? `${cargados} de ${total} cargados` : undefined}
          abierta={abierta}
          onToggle={() => setAbierta((prev) => !prev)}
        >
          {checklist}
        </SeccionPlegable>
      </div>
    );
  }

  return (
    <div role="group" aria-label={label}>
      {label && <FieldGroupHeading>{label}</FieldGroupHeading>}
      {checklist}
    </div>
  );
}
