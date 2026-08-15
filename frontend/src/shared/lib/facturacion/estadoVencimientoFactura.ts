import type { EstadoFactura } from '../../types/factura';

// Función pura (tasks.md 3.7, RF-406): marca una factura como vencida sin cobro para
// seguimiento ante la Superintendencia. Solo aplica a facturas que ya salieron de `a-facturar`
// y todavía no se saldaron del todo (`facturado`/`pagado-parcialmente`) — una factura `cobrado`
// nunca está vencida, sin importar cuánto tiempo pasó.
//
// Cambio confirmado con la usuaria (2026-08-12): "vencida" se compara contra la
// `fechaEstimadaCobro` puntual de esa factura (ya calculada con precedencia amparo > obra social >
// default en `calcularFechaEstimadaCobro.ts`, no reimplementada acá), nunca contra un plazo fijo
// de días desde `fechaFactura` — dos facturas con la misma fecha de factura pero plazos distintos
// (amparo judicial vs. sin amparo) ahora pueden vencer en momentos muy distintos.
const ESTADOS_QUE_PUEDEN_VENCER: readonly EstadoFactura[] = ['facturado', 'pagado-parcialmente'];

export interface EstadoVencimientoFacturaInput {
  /** ISO date, ya calculada por `calcularFechaEstimadaCobro.ts`. Sin ella, nunca vencida. */
  fechaEstimadaCobro?: string;
  /** ISO date de "hoy", inyectado (nunca `new Date()` implícito dentro de la función). */
  hoy: string;
  estado: EstadoFactura;
}

export function estadoVencimientoFactura({ fechaEstimadaCobro, hoy, estado }: EstadoVencimientoFacturaInput): boolean {
  if (!ESTADOS_QUE_PUEDEN_VENCER.includes(estado)) return false;
  if (fechaEstimadaCobro === undefined) return false;

  return hoy > fechaEstimadaCobro;
}
