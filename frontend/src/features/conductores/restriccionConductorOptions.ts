import type { RestriccionConductor } from '../../shared/types/conductor';

// Etiquetas legibles del conjunto cerrado de restricciones de perfil (US-600, conductor.ts).
// Único lugar de la UI que conoce el mapeo unión-literal → texto, para no repetirlo en cada
// selector. Catálogo incompleto a propósito (design.md Decisión 3, Open Question) — ver cartel
// de "pendiente de confirmar" en ConductorForm (tasks.md 9.1).
export const RESTRICCION_CONDUCTOR_LABELS: Record<RestriccionConductor, string> = {
  'no-carga-fisica': 'No traslada pacientes con carga física',
};

export const RESTRICCION_CONDUCTOR_OPTIONS = Object.keys(RESTRICCION_CONDUCTOR_LABELS) as RestriccionConductor[];
