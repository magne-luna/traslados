import { useEffect, useState } from 'react';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { ChecklistItem } from '../../shared/types/documento';
import type { Direccion } from '../../shared/types/paciente';
import { etiquetaActividad, obtenerActividadesConChecklist } from './actividadDocumental';
import { PacienteDocumentosChecklist } from './PacienteDocumentosChecklist';

interface PacienteDocumentosProps {
  pacienteId: string;
  obraSocialId: string | null;
  obraSocialRepository: ObraSocialRepository;
  documentoRepository: DocumentoRepository;
  /** documentos-checklist-por-actividad (tasks.md 3.3, design.md D1): direcciones del paciente —
   * de acá sale la lista de actividades con checklist propio, vía
   * `obtenerActividadesConChecklist` (§1, ya implementado: excluye `tipo: 'domicilio'`). */
  direcciones: Direccion[];
}

type Resolucion =
  | { status: 'sin-obra-social' }
  | { status: 'cargando' }
  | { status: 'sin-checklist' }
  | { status: 'listo'; items: ChecklistItem[] };

const emptyStateClasses = 'rounded-sm border border-border bg-surface-soft px-md py-lg font-body text-sm text-muted';

// documentos-checklist-por-actividad (tasks.md 3.3, design.md Checkpoint (c) VEREDICTO): etiqueta
// del bloque que agrupa la documentación del paciente que no pertenece a ninguna actividad
// puntual (CUD, DNI, RHC del paciente en general) — convive con los bloques por actividad, y se
// renderiza primero (tasks.md 3.5).
const ETIQUETA_GENERAL = 'Documentación general';

export function PacienteDocumentos({ pacienteId, obraSocialId, obraSocialRepository, documentoRepository, direcciones }: PacienteDocumentosProps) {
  const [resolucion, setResolucion] = useState<Resolucion>(
    obraSocialId === null ? { status: 'sin-obra-social' } : { status: 'cargando' },
  );

  useEffect(() => {
    if (obraSocialId === null) {
      setResolucion({ status: 'sin-obra-social' });
      return;
    }
    let active = true;
    setResolucion({ status: 'cargando' });
    obraSocialRepository
      .getById(obraSocialId)
      .then((obraSocial) => {
        if (!active) return;
        if (obraSocial === null || obraSocial.checklist.length === 0) {
          setResolucion({ status: 'sin-checklist' });
        } else {
          setResolucion({ status: 'listo', items: obraSocial.checklist });
        }
      })
      .catch(() => {
        if (active) setResolucion({ status: 'sin-checklist' });
      });
    return () => { active = false; };
  }, [obraSocialId, obraSocialRepository]);

  if (resolucion.status === 'sin-obra-social') {
    return <p className={emptyStateClasses}>Este paciente no tiene una obra social asignada todavía.</p>;
  }
  if (resolucion.status === 'cargando') {
    return <p className="font-body text-sm text-muted">Cargando documentación…</p>;
  }
  if (resolucion.status === 'sin-checklist') {
    return <p className={emptyStateClasses}>La obra social asignada no tiene un checklist de documentos configurado.</p>;
  }

  // documentos-checklist-por-actividad (tasks.md 3.3): N checklists por composición, uno por
  // actividad del paciente (design.md D1) — este componente ya no monta un único
  // PacienteDocumentosChecklist, arma la lista completa (general + N actividades).
  const actividades = obtenerActividadesConChecklist(direcciones);

  return (
    <div className="flex flex-col gap-xl">
      {/* tasks.md 3.5: el bloque "General" se renderiza primero, siempre — cubre documentos
          cargados antes de este change y los que genuinamente no son de ninguna actividad. */}
      <PacienteDocumentosChecklist
        pacienteId={pacienteId}
        items={resolucion.items}
        repository={documentoRepository}
        label={ETIQUETA_GENERAL}
      />
      {actividades.length === 0 ? (
        // tasks.md 3.4: sin actividades registradas, nunca N=0 bloques sin explicación — invita
        // a cargar una dirección en la sección de arriba ("Traslados" › "Direcciones").
        <p className={emptyStateClasses}>
          Este paciente todavía no tiene actividades registradas (escuela, terapia, etc.). Cargá
          una dirección en la sección de Direcciones para que aparezca su propio checklist acá.
        </p>
      ) : (
        actividades.map((direccion) => (
          <PacienteDocumentosChecklist
            key={direccion.id}
            pacienteId={pacienteId}
            items={resolucion.items}
            repository={documentoRepository}
            agrupacionId={direccion.id}
            label={etiquetaActividad(direccion)}
          />
        ))
      )}
    </div>
  );
}
