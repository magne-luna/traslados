import type { SemanticStatus } from '../../design-system/tokens';
import type {
  SubtipoCorrectivo,
  SubtipoPreventivo,
  TipoIntervencion,
} from '../../shared/types/vehiculo';

// Único módulo que conoce el mapeo unión-literal → texto/color para la categoría de
// mantenimiento (design.md Decisión 7, reemplaza a `categoriaGastoOptions.ts` que este change
// borra — tasks.md 3.3). `subtiposDe` es la función pura que alimenta el selector en cascada
// nivel 1 → nivel 2 de `HistorialMantenimiento.tsx`.

export const TIPO_INTERVENCION_LABELS: Record<TipoIntervencion, string> = {
  gasto: 'Gasto',
  preventivo: 'Preventivo',
  correctivo: 'Correctivo',
};

export const TIPO_INTERVENCION_CHIP_KIND: Record<TipoIntervencion, SemanticStatus> = {
  gasto: 'secondary',
  preventivo: 'success',
  correctivo: 'warning',
};

export const SUBTIPO_PREVENTIVO_LABELS: Record<SubtipoPreventivo, string> = {
  'cambio-aceite-filtros': 'Cambio de aceite/filtros',
  vtv: 'VTV',
  rto: 'RTO',
};

export const SUBTIPO_CORRECTIVO_LABELS: Record<SubtipoCorrectivo, string> = {
  alternador: 'Alternador',
  bateria: 'Batería',
  frenos: 'Frenos',
  embrague: 'Embrague',
  cubiertas: 'Cubiertas',
  otro: 'Otro',
};

/**
 * Los dos tipos de intervención que el alta de `HistorialMantenimiento.tsx` ofrece (design.md
 * Decisión 2): `'gasto'` existe en `TipoIntervencion` para poder leer un registro con ese nivel 1
 * (el fixture siembra uno), pero no se da de alta desde esta pantalla porque duplicaría la
 * entidad Gastos de Vehículo del mismo docx.
 */
export const TIPOS_INTERVENCION_ALTA: readonly ['preventivo', 'correctivo'] = ['preventivo', 'correctivo'];

const SUBTIPOS_PREVENTIVO: readonly SubtipoPreventivo[] = ['cambio-aceite-filtros', 'vtv', 'rto'];

// 'otro' último en la lista (design.md Riesgos — "'otro' como fuga del catálogo": ofrecerlo al
// final desalienta elegirlo quando hay un sub-tipo conocido más específico).
const SUBTIPOS_CORRECTIVO: readonly SubtipoCorrectivo[] = ['alternador', 'bateria', 'frenos', 'embrague', 'cubiertas', 'otro'];

// Lookup combinado (nivel 2 preventivo + correctivo) para el selector en cascada y la fila de
// tabla: un `subtipo` string siempre pertenece a un solo nivel 1, así que no hay colisión de
// claves entre los dos catálogos.
export const SUBTIPO_LABELS: Record<string, string> = {
  ...SUBTIPO_PREVENTIVO_LABELS,
  ...SUBTIPO_CORRECTIVO_LABELS,
};

/**
 * Sub-tipos de nivel 2 disponibles para un tipo de intervención de nivel 1. `'gasto'` no tiene
 * nivel 2 (spec `vehiculo-mantenimiento-historial`, escenario "Registro de nivel 1 'gasto' sin
 * sub-tipo") — devuelve lista vacía.
 */
export function subtiposDe(tipo: TipoIntervencion): readonly SubtipoPreventivo[] | readonly SubtipoCorrectivo[] {
  switch (tipo) {
    case 'preventivo':
      return SUBTIPOS_PREVENTIVO;
    case 'correctivo':
      return SUBTIPOS_CORRECTIVO;
    case 'gasto':
      return [];
  }
}
