// documentos-checklist-por-actividad (tasks.md 5.1, design.md Checkpoint (f) VEREDICTO opción A):
// agrega el progreso ("X de Y documentos cargados") de las N instancias de checklist que
// PacienteDocumentos.tsx monta (el bloque "General" + una por actividad) en un único total para el
// encabezado de la sección. Función pura, sin conocimiento de React ni de actividades — cada
// instancia solo aporta su propio par {cargados, total}, con la misma semántica de "cargado" que ya
// usa DocumentChecklist.tsx a nivel de una instancia (líneas 233-235: al menos un documento por
// ítem), sin duplicar esa fórmula acá — el cálculo por instancia sigue viviendo donde ya vivía.
export interface ProgresoInstancia {
  cargados: number;
  total: number;
}

export interface ProgresoAgregado {
  cargados: number;
  total: number;
  /** Porcentaje 0-100, sin redondear (el redondeo para mostrar ya lo resuelve `ProgressBar`/el
   * caller, igual que hace `DocumentChecklist.tsx` con su propio `pctCargado`). */
  pct: number;
}

export function agregarProgreso(instancias: ProgresoInstancia[]): ProgresoAgregado {
  const cargados = instancias.reduce((acc, instancia) => acc + instancia.cargados, 0);
  const total = instancias.reduce((acc, instancia) => acc + instancia.total, 0);
  const pct = total === 0 ? 0 : (cargados / total) * 100;
  return { cargados, total, pct };
}
