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
 * RF-406: días desde la fecha de factura a partir de los cuales, sin cobro, se alerta la factura
 * como vencida para hacer seguimiento ante la Superintendencia. A confirmar.
 */
export const PLAZO_ALERTA_VENCIDA_DIAS = 60;

/**
 * ⚠️ PROVISORIO — supuesto #5 del proposal de `prestadores-crud`, SIN resolver. RN-FA-07 dice que
 * el tipo de comprobante depende de la relación con la obra social; hasta que se decida qué
 * Prestador aplica al facturar, el formulario arranca en 'A' y el operador lo corrige a mano. NO
 * es la resolución de RN-FA-07: es el marcador de que falta resolverla. Ver design.md D4 de
 * `prestadores-crud`.
 */
export const TIPO_COMPROBANTE_DEFAULT: TipoComprobante = 'A';
