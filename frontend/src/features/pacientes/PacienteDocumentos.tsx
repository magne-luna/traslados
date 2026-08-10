import { useEffect, useMemo, useState } from 'react';
import { Chip, RingProgress } from '../../design-system/components';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { ChecklistItem } from '../../shared/types/documento';
import type { Direccion } from '../../shared/types/paciente';
import { etiquetaActividad, obtenerActividadesConChecklist } from './actividadDocumental';
import { PacienteDocumentosChecklist } from './PacienteDocumentosChecklist';
import { agregarProgreso, type ProgresoInstancia } from './progresoDocumental';

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
  // documentos-checklist-por-actividad (tasks.md 5.1, design.md Checkpoint (f) VEREDICTO opción
  // A): progreso por instancia (General + cada actividad), reportado desde cada
  // `PacienteDocumentosChecklist` vía `onProgreso` — este componente solo agrega, no vuelve a
  // calcular "cargado". Clave: `'general'` o el `Direccion.id` de la actividad.
  const [progresos, setProgresos] = useState<Record<string, ProgresoInstancia>>({});
  const agregado = useMemo(() => agregarProgreso(Object.values(progresos)), [progresos]);
  const pendientesTotal = agregado.total - agregado.cargados;

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

  // tasks.md 5.1: guarda solo si el progreso reportado por esa instancia realmente cambió, para
  // no disparar un `setState` (y su re-render) en cada montaje idéntico.
  function reportarProgreso(clave: string, progreso: ProgresoInstancia) {
    setProgresos((prev) => {
      const actual = prev[clave];
      if (actual && actual.cargados === progreso.cargados && actual.total === progreso.total) return prev;
      return { ...prev, [clave]: progreso };
    });
  }

  return (
    <div className="flex flex-col gap-xl">
      {/* tasks.md 5.1, design.md Checkpoint (f) VEREDICTO opción A: total agregado (General + N
          actividades) en el encabezado de la sección — cada bloque sigue mostrando además su
          propia barra (DocumentChecklist.tsx, sin cambios). Oculto hasta que al menos una
          instancia reportó su progreso, para no mostrar "0 de 0" mientras carga. */}
      {agregado.total > 0 && (
        <div
          role="group"
          aria-label="Progreso total de documentación"
          className="flex items-center gap-lg rounded-md border border-border bg-surface p-lg"
        >
          {/* checklist-documental-progreso-visual (skill `prototype`, variante "Progreso visual"
              elegida 2026-08-10): anillo en vez de barra lineal para el total agregado — el
              único cambio visual acá, mismo texto/aria-label/Chip que antes. */}
          <RingProgress pct={agregado.pct} kind="success" size="lg">
            <span className="font-heading text-[17px] font-bold text-ink">{Math.round(agregado.pct)}%</span>
          </RingProgress>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-sm font-body text-[13px] text-text">
            <span>
              {agregado.cargados} de {agregado.total} documentos cargados en total
            </span>
            {pendientesTotal > 0 && (
              <Chip kind="warning">
                {pendientesTotal} pendiente{pendientesTotal === 1 ? '' : 's'}
              </Chip>
            )}
          </div>
        </div>
      )}

      {/* tasks.md 3.5: el bloque "General" se renderiza primero, siempre — cubre documentos
          cargados antes de este change y los que genuinamente no son de ninguna actividad. */}
      <PacienteDocumentosChecklist
        pacienteId={pacienteId}
        items={resolucion.items}
        repository={documentoRepository}
        label={ETIQUETA_GENERAL}
        onProgreso={(progreso) => reportarProgreso('general', progreso)}
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
            onProgreso={(progreso) => reportarProgreso(direccion.id, progreso)}
          />
        ))
      )}
    </div>
  );
}
