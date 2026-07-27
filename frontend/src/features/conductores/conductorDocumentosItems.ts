import type { ChecklistItem } from '../../shared/types/documento';

// Lista fija de ítems documentales del conductor (tasks.md 7.1, US-600, 04_modelo_de_datos.md
// §Conductor: "documentación (licencia de conducir)"). Reutiliza `ChecklistItem` de
// `shared/types/documento.ts` (mismo tipo que usa el checklist de Vehículos) — sin modelo
// documental paralelo. DNI y apto médico son sembrados por default (design.md Open Question —
// ver cartel de "pendiente de confirmar" en ConductorDocumentos, tasks.md 9.4).
export const CONDUCTOR_DOCUMENTOS_ITEMS: ChecklistItem[] = [
  { id: 'conductor-doc-licencia', nombre: 'Licencia de conducir', requerido: true },
  { id: 'conductor-doc-dni', nombre: 'DNI', requerido: false },
  { id: 'conductor-doc-apto-medico', nombre: 'Apto médico', requerido: false },
];
