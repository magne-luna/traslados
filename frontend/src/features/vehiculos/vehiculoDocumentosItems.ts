import type { ChecklistItem } from '../../shared/types/documento';

// Lista fija de ítems documentales del vehículo (tasks.md 8.1, RF-506): cédula, VTV, RTO,
// seguro y fotos. Reutiliza `ChecklistItem` de `shared/types/documento.ts` (mismo tipo que usa
// el checklist configurable de Obras Sociales) — sin modelo documental paralelo.
export const VEHICULO_DOCUMENTOS_ITEMS: ChecklistItem[] = [
  { id: 'vehiculo-doc-cedula', nombre: 'Cédula', requerido: true },
  { id: 'vehiculo-doc-vtv', nombre: 'VTV', requerido: true },
  { id: 'vehiculo-doc-rto', nombre: 'RTO', requerido: false },
  { id: 'vehiculo-doc-seguro', nombre: 'Seguro', requerido: true },
  { id: 'vehiculo-doc-fotos', nombre: 'Fotos', requerido: false },
];
