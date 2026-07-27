import type { EstadoFactura } from '../../types/factura';
import { PLAZO_ALERTA_VENCIDA_DIAS } from './constantes';

// Función pura (tasks.md 3.7, RF-406): marca una factura como vencida sin cobro para
// seguimiento ante la Superintendencia. Solo aplica a facturas que ya salieron de `a-facturar`
// y todavía no se saldaron del todo (`facturado`/`pagado-parcialmente`) — una factura `cobrado`
// nunca está vencida, sin importar cuánto tiempo pasó.
const ESTADOS_QUE_PUEDEN_VENCER: readonly EstadoFactura[] = ['facturado', 'pagado-parcialmente'];

export interface EstadoVencimientoFacturaInput {
  /** ISO date. */
  fechaFactura: string;
  /** ISO date de "hoy", inyectado (nunca `new Date()` implícito dentro de la función). */
  hoy: string;
  estado: EstadoFactura;
}

export function estadoVencimientoFactura({ fechaFactura, hoy, estado }: EstadoVencimientoFacturaInput): boolean {
  if (!ESTADOS_QUE_PUEDEN_VENCER.includes(estado)) return false;

  const diasTranscurridos =
    (new Date(`${hoy}T00:00:00.000Z`).getTime() - new Date(`${fechaFactura}T00:00:00.000Z`).getTime()) /
    (24 * 60 * 60 * 1000);

  return diasTranscurridos >= PLAZO_ALERTA_VENCIDA_DIAS;
}
