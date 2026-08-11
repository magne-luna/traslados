import type { DocumentoAdjunto } from '../../types/documento';

// pacientes-documentos-multiples (design.md Checkpoint (b) / D2): "vigente" se deriva como el
// documento con `vigenciaDesde` más reciente que no sea futuro (fallback a `subidoEn` si no se
// cargó `vigenciaDesde`) — lógica de presentación, no se persiste como flag aparte para no tener
// dos fuentes de verdad.
//
// documentos-transferencia-actividad (tasks.md §14): extraída de
// `shared/components/DocumentChecklist.tsx` a este archivo — antes vivía ahí como función privada,
// exportarla directamente desde un archivo de componente disparaba la advertencia de oxlint
// `react(only-export-components)` (Fast Refresh solo funciona si el archivo exporta únicamente
// componentes). Movida tal cual, sin cambiar una línea de la lógica: `DocumentChecklist.tsx` la
// sigue usando, ahora importada. (En su momento también la reusaba
// `DocumentacionActividadImprimible.tsx`, el resumen imprimible de §14 — ese componente se
// REVIRTIÓ por completo el 2026-08-11; este archivo se quedó porque `DocumentChecklist.tsx` sigue
// dependiendo de él, sin relación con lo revertido.)

export function fechaEfectiva(doc: DocumentoAdjunto): string {
  return doc.vigenciaDesde ?? doc.subidoEn;
}

function esFechaFutura(fecha: string, ahora: Date): boolean {
  const parsed = new Date(fecha);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > ahora.getTime();
}

export function elegirVigente(docs: DocumentoAdjunto[]): DocumentoAdjunto | undefined {
  if (docs.length === 0) return undefined;
  const ahora = new Date();
  const noFuturos = docs.filter((doc) => !esFechaFutura(fechaEfectiva(doc), ahora));
  const candidatos = noFuturos.length > 0 ? noFuturos : docs;
  return [...candidatos].sort((a, b) => fechaEfectiva(b).localeCompare(fechaEfectiva(a)))[0];
}
