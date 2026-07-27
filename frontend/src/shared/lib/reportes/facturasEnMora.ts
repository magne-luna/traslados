import type { Cobro, Factura } from '../../types/factura';
import { estadoVencimientoFactura } from '../facturacion/estadoVencimientoFactura';
import { saldoFactura } from '../facturacion/totalesFactura';
import type { FacturaEnMora } from '../../types/reportes';

// Función pura (design.md Decisión 5, tasks.md 4.3/4.4): la regla de mora y su umbral tienen un
// solo dueño, `shared/lib/facturacion/` — esta función solo invoca `estadoVencimientoFactura` y
// `saldoFactura`, nunca reimplementa el cálculo ni redeclara `PLAZO_ALERTA_VENCIDA_DIAS`. Una
// factura sin `fechaFactura` (nunca emitida) no puede estar en mora.

export interface FacturasEnMoraInput {
  facturas: Factura[];
  cobros: Cobro[];
  /** ISO date de referencia, inyectada. */
  hoy: string;
}

export function facturasEnMora({ facturas, cobros, hoy }: FacturasEnMoraInput): FacturaEnMora[] {
  const resultado: FacturaEnMora[] = [];

  for (const factura of facturas) {
    if (!factura.fechaFactura) continue;

    const vencida = estadoVencimientoFactura({ fechaFactura: factura.fechaFactura, hoy, estado: factura.estado });
    if (!vencida) continue;

    const saldoPendiente = saldoFactura(factura, cobros);
    if (saldoPendiente <= 0) continue;

    const diasDeAtraso = Math.floor(
      (new Date(`${hoy}T00:00:00.000Z`).getTime() - new Date(`${factura.fechaFactura}T00:00:00.000Z`).getTime()) /
        (24 * 60 * 60 * 1000),
    );

    resultado.push({ facturaId: factura.id, pacienteId: factura.pacienteId, saldoPendiente, diasDeAtraso });
  }

  return resultado;
}
