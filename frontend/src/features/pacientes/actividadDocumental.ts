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
