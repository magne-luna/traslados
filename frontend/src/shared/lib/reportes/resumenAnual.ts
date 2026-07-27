import type { Cobro, EstadoFactura, Factura } from '../../types/factura';
import type { PuntoPeriodo, ResumenAnual } from '../../types/reportes';
import { componentesFecha } from './periodos';

// Función pura (design.md Decisión 1, tasks.md 3.7-3.9): mismas reglas de atribución que
// facturadoVsCobrado (facturado por mesFacturado/anioFacturado y solo facturas emitidas;
// cobrado por Cobro.fecha), aplicadas a un único año calendario.

const ESTADOS_EMITIDOS: readonly EstadoFactura[] = ['facturado', 'cobrado', 'pagado-parcialmente'];

export interface ResumenAnualInput {
  facturas: Factura[];
  cobros: Cobro[];
  anio: number;
}

export function resumenAnual({ facturas, cobros, anio }: ResumenAnualInput): ResumenAnual {
  const facturadoPorMes = new Map<number, number>();
  let facturasEmitidas = 0;
  let facturasSaldadas = 0;

  for (const factura of facturas) {
    if (factura.anioFacturado !== anio) continue;
    if (!ESTADOS_EMITIDOS.includes(factura.estado)) continue;
    facturasEmitidas += 1;
    if (factura.estado === 'cobrado') facturasSaldadas += 1;
    facturadoPorMes.set(factura.mesFacturado, (facturadoPorMes.get(factura.mesFacturado) ?? 0) + factura.monto);
  }

  const cobradoPorMes = new Map<number, number>();
  for (const cobro of cobros) {
    const { anio: anioCobro, mes } = componentesFecha(cobro.fecha);
    if (anioCobro !== anio) continue;
    cobradoPorMes.set(mes, (cobradoPorMes.get(mes) ?? 0) + cobro.montoPagado);
  }

  const meses: PuntoPeriodo[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    const facturado = facturadoPorMes.get(mes) ?? 0;
    const cobrado = cobradoPorMes.get(mes) ?? 0;
    meses.push({ mes, anio, facturado, cobrado, diferencia: facturado - cobrado });
  }

  const totalFacturado = meses.reduce((acumulado, punto) => acumulado + punto.facturado, 0);
  const totalCobrado = meses.reduce((acumulado, punto) => acumulado + punto.cobrado, 0);

  return {
    anio,
    totalFacturado,
    totalCobrado,
    totalDiferencia: totalFacturado - totalCobrado,
    facturasEmitidas,
    facturasSaldadas,
    meses,
  };
}

export interface AniosConDatosInput {
  facturas: Factura[];
  cobros: Cobro[];
  /** ISO date de referencia — siempre incluido en el resultado, incluso sin datos. */
  hoy: string;
}

/** Años disponibles para el selector (tasks.md 3.9): derivados del período de las facturas y
 * de la fecha de los cobros, siempre incluyendo el año de `hoy`, ordenados y sin duplicados. */
export function aniosConDatos({ facturas, cobros, hoy }: AniosConDatosInput): number[] {
  const anios = new Set<number>();
  anios.add(componentesFecha(hoy).anio);
  for (const factura of facturas) anios.add(factura.anioFacturado);
  for (const cobro of cobros) anios.add(componentesFecha(cobro.fecha).anio);
  return Array.from(anios).sort((a, b) => a - b);
}
