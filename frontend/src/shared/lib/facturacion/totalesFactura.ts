import type { Cobro, Factura } from '../../types/factura';

// Funciones puras (tasks.md 3.8): total propuesto y saldo pendiente de la factura. El total se
// propone calculado pero queda editable en el formulario (design.md Decisión 12: el docx modela
// `Monto` como campo propio, puede no cerrar exacto con el producto).
export function calcularTotalFactura({ valorKm, cantidadKm }: { valorKm: number; cantidadKm: number }): number {
  return valorKm * cantidadKm;
}

export function saldoFactura(factura: Factura, cobros: Cobro[]): number {
  const totalCobrado = cobros
    .filter((cobro) => cobro.facturaId === factura.id)
    .reduce((acumulado, cobro) => acumulado + cobro.montoPagado, 0);

  return factura.monto - totalCobrado;
}
