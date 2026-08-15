import type { PeriodoMeses } from '../../types/reportes';

// Umbrales y opciones propios del dashboard (design.md Decisión 10, tasks.md 4.1): este archivo
// NO redeclara ningún umbral que ya tenga dueño en otro módulo. La mora (`estadoVencimientoFactura`)
// ya no usa un plazo fijo en días — desde 2026-08-12 compara contra `fechaEstimadaCobro`, ver
// `shared/lib/facturacion/estadoVencimientoFactura.ts`; `KM_SERVICE` / `KM_ALERTA_INTERMEDIA` /
// `MESES_SERVICE` / `DIAS_AVISO_HABILITACION` (mantenimiento) viven en
// `shared/lib/mantenimiento/constantes.ts`; el umbral de `estadoCud` resuelve su propio default
// (60 días) en `shared/lib/pacientes/estadoCud.ts`. Solo se declara acá lo que no tiene dueño en
// ningún otro lado.

/** Opciones del selector de período del reporte facturado vs. cobrado (design.md Decisión 4), en un solo lugar. */
export const PERIODOS_DISPONIBLES: readonly PeriodoMeses[] = [3, 6, 12];

/** Cuántos ítems se listan dentro de cada tarjeta de alerta antes del enlace "ver todos" hacia
 * el módulo fuente — evita que una tarjeta con decenas de ítems coma la pantalla. */
export const MAX_ITEMS_TARJETA = 5;

/**
 * Umbral de días para `cudPorVencer` (design.md Decisión 10): se pasa explícito a `estadoCud`
 * con el mismo valor que su propio default (60), como punto único de ajuste si el cliente pide
 * que el dashboard avise antes que la ficha del paciente. No reemplaza el default de
 * `estadoCud` — coexiste con él.
 */
export const UMBRAL_CUD_DASHBOARD_DIAS = 60;
