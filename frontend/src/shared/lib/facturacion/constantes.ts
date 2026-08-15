// Plazos de cobro como constantes configurables documentadas (design.md Decisión 7): un único
// punto de edición y de re-test si el cliente confirma otros valores, en vez de números mágicos
// dispersos en componentes o funciones. Mismo patrón que shared/lib/mantenimiento/constantes.ts.
//
// Los tres valores están PENDIENTES DE CONFIRMAR CON EL CLIENTE (knowledge-base/
// 10_preguntas_abiertas.md, prioridad Alta) — ver design.md §Open Questions.

import type { TipoComprobante } from '../../types/obraSocial';

/**
 * RN-FA-04: plazo de cobro esperado en días desde la fecha de factura, cuando no aplica amparo
 * judicial y la obra social no tiene un `plazoCobroDias` propio configurado. A confirmar.
 */
export const PLAZO_COBRO_DEFAULT_DIAS = 90;

/**
 * RN-FA-04: plazo de cobro en días cuando el paciente tiene `amparoJudicial: true`. Gana sobre
 * el plazo propio de la obra social (design.md Decisión 7, precedencia — la KB no lo dice
 * explícitamente, es la parte de esta decisión más pendiente de confirmar).
 */
export const PLAZO_COBRO_AMPARO_DIAS = 45;

/**
 * @deprecated Huérfana desde el cambio confirmado con la usuaria (2026-08-12): RF-406 ya no
 * compara contra un plazo fijo de días desde `fechaFactura`, sino contra la `fechaEstimadaCobro`
 * puntual de cada factura (`estadoVencimientoFactura.ts`). No se borra el archivo por si algo
 * la importa que no se vio en la revisión — confirmar con quien la use antes de eliminarla.
 */
export const PLAZO_ALERTA_VENCIDA_DIAS = 60;

/**
 * RN-FA-07: tipo de comprobante fiscal. Sin ninguna fuente que lo auto-complete (change
 * `sacar-prestadores` removió el módulo Prestador, que era la única candidata) — el formulario
 * siempre arranca en 'A' y el operador lo corrige a mano.
 */
export const TIPO_COMPROBANTE_DEFAULT: TipoComprobante = 'A';
