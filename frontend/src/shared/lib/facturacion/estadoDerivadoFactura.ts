import type { Cobro, EstadoFactura, Factura } from '../../types/factura';
import { saldoFactura } from './totalesFactura';

// Función pura (tasks.md 3.9, design.md Decisión 10): deriva el estado de la factura a partir de
// los cobros registrados, para que estado y cobros no puedan desincronizarse (el bug clásico de
// "cobrada pero con saldo"). Se invoca tras cada alta/baja de cobro (tasks.md 9.4); no decide
// nada sobre la transición `a-facturar → facturado`, que es una acción explícita separada
// (tasks.md 9.1).
export function estadoDerivadoFactura(factura: Factura, cobros: Cobro[]): EstadoFactura {
  const saldo = saldoFactura(factura, cobros);
  const tieneCobros = cobros.some((cobro) => cobro.facturaId === factura.id);

  if (!tieneCobros) return 'facturado';
  return saldo > 0 ? 'pagado-parcialmente' : 'cobrado';
}
