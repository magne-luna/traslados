import type { ChecklistItem } from '../../shared/types/documento';
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

// documentos-checklist-items-por-actividad (tasks.md §2, design.md D1/D2, Checkpoint (c) VEREDICTO
// 1.4): combina los ítems del checklist de la obra social con los ítems propios del tipo de una
// actividad, en una sola lista aditiva. Función pura — sin `Date.now()`, sin acceso a repository,
// sin estado — es lo que la hace testeable sin React y lo que protege al bloque "General" por
// construcción: ese bloque simplemente no la llama (PacienteDocumentos.tsx §6).
//
// Reglas (todas con veredicto explícito de la usuaria, 2026-08-10, sin adivinar ninguna):
// - La obra social es siempre la BASE: su orden se preserva tal cual la exige (RN-FA-08), y ante un
//   ítem con el mismo id en las dos listas, gana su `nombre` (nunca el del tipo de actividad).
// - `itemsPorTipo = []` ⇒ el resultado es idéntico a `itemsObraSocial` (mismos ids, mismo orden) —
//   es el comportamiento actual y el default documentado (design.md D2): nunca hay regresión visible
//   mientras nadie configure ítems por tipo de actividad.
// - Dedup por identidad real (`ChecklistItem.id`, que es el id del `tipos_documento` compartido —
//   veredicto 1.2 opción A), nunca por nombre: dos ítems con el mismo id son el mismo ítem, se
//   muestran una sola vez.
// - Conflicto de `requerido` entre las dos listas: gana el más estricto (`true`) — nunca se relaja
//   una exigencia documental como efecto colateral de combinar listas.
export function combinarItemsDeActividad(itemsObraSocial: ChecklistItem[], itemsPorTipo: ChecklistItem[]): ChecklistItem[] {
  const requeridoPorId = new Map<string, boolean>();
  for (const item of [...itemsObraSocial, ...itemsPorTipo]) {
    requeridoPorId.set(item.id, (requeridoPorId.get(item.id) ?? false) || item.requerido);
  }

  const combinado = [...itemsObraSocial];
  const idsExistentes = new Set(itemsObraSocial.map((item) => item.id));
  for (const item of itemsPorTipo) {
    if (idsExistentes.has(item.id)) continue;
    idsExistentes.add(item.id);
    combinado.push(item);
  }

  return combinado.map((item) => ({ ...item, requerido: requeridoPorId.get(item.id) ?? item.requerido }));
}
