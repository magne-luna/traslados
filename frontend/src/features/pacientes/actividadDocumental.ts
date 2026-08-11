import type { Direccion } from '../../shared/types/paciente';
import { TIPO_DIRECCION_LABELS } from './direccionOptions';

// Modelo del dominio "actividad" para el checklist documental por actividad
// (documentos-checklist-por-actividad, tasks.md §1, design.md Checkpoint (a)). Checkpoint (a) —
// VEREDICTO (2026-08-06, usuaria): reusar `Direccion` (shared/types/paciente.ts), sin crear una
// entidad `Actividad` nueva. Solo las direcciones no-domicilio son "actividades" con checklist
// propio — `tipo: 'domicilio'` (la casa del paciente) queda excluido y su documentación cae en el
// bloque "General" (Checkpoint (c), fuera de esta sección).
//
// Criterio único, nunca un `filter` inline repetido en cada componente que muestre actividades
// (PacienteDocumentos.tsx §3 y cualquier otro consumidor futuro).
export function obtenerActividadesConChecklist(direcciones: Direccion[]): Direccion[] {
  return direcciones.filter((direccion) => direccion.tipo !== 'domicilio');
}

// Etiqueta legible de una actividad: tipo + descripción, reusando TIPO_DIRECCION_LABELS de
// direccionOptions.ts (nunca reinventando el mapeo tipo→label). Es lo que identifica cada bloque
// del checklist y lo que distingue dos actividades del mismo tipo entre sí (spec: "Dos
// actividades del mismo tipo son distinguibles entre sí"), mismo formato "Tipo — Descripción" que
// ya usa DireccionesEditor.tsx para listar direcciones.
export function etiquetaActividad(direccion: Direccion): string {
  const label = TIPO_DIRECCION_LABELS[direccion.tipo];
  return direccion.descripcion ? `${label} — ${direccion.descripcion}` : label;
}

// documentos-checklist-items-por-actividad (design.md Checkpoint (c) — ⚠️ REVISIÓN 2026-08-11,
// durante §9 verificación manual en vivo): esta función solía vivir acá (`combinarItemsDeActividad`,
// merge + dedup entre los ítems de la obra social y los del tipo de actividad, veredicto 1.4
// original). Se ELIMINÓ: probando la pantalla real, el veredicto quedó revertido — cada bloque de
// actividad muestra ÚNICAMENTE sus ítems propios del tipo (`RequisitosActividadRepository`), nunca
// sumados a los de la obra social. Ya no hay ninguna operación de "combinar" que sea responsabilidad
// de este archivo: `PacienteDocumentos.tsx` pasa `itemsPorTipo[direccion.tipo] ?? []` directamente a
// cada bloque de actividad, y el bloque "General" sigue usando solo los ítems de la obra social
// (sin cambios, nunca llamó a esta función). Si en el futuro hace falta una función de combinación
// de listas de ítems para otro propósito, no reintroducir `combinarItemsDeActividad` con esta forma
// sin releer `design.md` Checkpoint (c) primero.
