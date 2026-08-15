import type { Cobro, Factura } from '../../types/factura';

// Funciones puras (tasks.md 3.8): total propuesto y saldo pendiente de la factura. El total se
// propone calculado pero queda editable en el formulario (design.md Decisión 12: el docx modela
// `Monto` como campo propio, puede no cerrar exacto con el producto).
//
// Fix directo (sin change SDD): el total propuesto era `cantidadKm * valorKm`, sin contemplar
// `dias` — un traslado de varios días facturaba lo mismo que uno de un solo día con la misma
// cantidad de km. La fórmula correcta es `dias * cantidadKm * valorKm`.
export function calcularTotalFactura({ valorKm, cantidadKm, dias }: { valorKm: number; cantidadKm: number; dias: number }): number {
  return dias * cantidadKm * valorKm;
}

export function saldoFactura(factura: Factura, cobros: Cobro[]): number {
  const totalCobrado = cobros
    .filter((cobro) => cobro.facturaId === factura.id)
    .reduce((acumulado, cobro) => acumulado + cobro.montoPagado, 0);

  return factura.monto - totalCobrado;
}
