import type { SemanticStatus } from '../../design-system/tokens';
import type { CategoriaGasto } from '../../shared/types/vehiculo';

// Etiquetas y color por categoría de gasto (RF-508). Único lugar de la UI que conoce el mapeo
// unión-literal → texto/color, para no repetirlo en cada selector o chip.
export const CATEGORIA_GASTO_LABELS: Record<CategoriaGasto, string> = {
  mantenimiento: 'Mantenimiento',
  reparacion: 'Reparación',
  service: 'Service',
};

export const CATEGORIA_GASTO_CHIP_KIND: Record<CategoriaGasto, SemanticStatus> = {
  mantenimiento: 'success',
  reparacion: 'warning',
  service: 'info',
};

export const CATEGORIA_GASTO_OPTIONS = Object.keys(CATEGORIA_GASTO_LABELS) as CategoriaGasto[];
