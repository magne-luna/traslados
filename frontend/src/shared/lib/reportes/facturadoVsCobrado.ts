import type { Cobro, EstadoFactura, Factura } from '../../types/factura';
import type { PeriodoMeses, PuntoPeriodo, SerieFacturadoVsCobrado } from '../../types/reportes';
import { componentesFecha, periodosDelRango } from './periodos';

// Función pura (design.md Decisión 1, tasks.md 3.3-3.6): recibe las colecciones ya cargadas y
// la fecha de referencia por parámetro. No lee repositorios, no lee React, no lee el reloj.

/** Solo las facturas ya emitidas cuentan como "facturado" (design.md Decisión 2). Una factura
 * en `a-facturar` es un borrador: todavía no es plata facturada. */
const ESTADOS_EMITIDOS: readonly EstadoFactura[] = ['facturado', 'cobrado', 'pagado-parcialmente'];

function clavePeriodo(mes: number, anio: number): string {
  return `${anio}-${mes}`;
}

export interface FacturadoVsCobradoInput {
  facturas: Factura[];
  cobros: Cobro[];
  /** ISO date de referencia, inyectada. */
  hoy: string;
  meses: PeriodoMeses;
}

export function facturadoVsCobrado({ facturas, cobros, hoy, meses }: FacturadoVsCobradoInput): SerieFacturadoVsCobrado {
  const rango = periodosDelRango({ hoy, meses });

  // Atribución del facturado (design.md Decisión 2): por el período estructurado de la
  // factura (mesFacturado/anioFacturado), nunca por fechaFactura ni por fechaInicial/fechaTope.
  const facturadoPorClave = new Map<string, number>();
  for (const factura of facturas) {
    if (!ESTADOS_EMITIDOS.includes(factura.estado)) continue;
    const clave = clavePeriodo(factura.mesFacturado, factura.anioFacturado);
    facturadoPorClave.set(clave, (facturadoPorClave.get(clave) ?? 0) + factura.monto);
  }

  // Atribución del cobrado (design.md Decisión 3): por Cobro.fecha (cuándo entró la plata),
  // independiente del período de la factura que ese cobro salda.
  const cobradoPorClave = new Map<string, number>();
  for (const cobro of cobros) {
    const { anio, mes } = componentesFecha(cobro.fecha);
    const clave = clavePeriodo(mes, anio);
    cobradoPorClave.set(clave, (cobradoPorClave.get(clave) ?? 0) + cobro.montoPagado);
  }

  const puntos: PuntoPeriodo[] = rango.map(({ mes, anio }) => {
    const clave = clavePeriodo(mes, anio);
    const facturado = facturadoPorClave.get(clave) ?? 0;
    const cobrado = cobradoPorClave.get(clave) ?? 0;
    return { mes, anio, facturado, cobrado, diferencia: facturado - cobrado };
  });

  const totalFacturado = puntos.reduce((acumulado, punto) => acumulado + punto.facturado, 0);
  const totalCobrado = puntos.reduce((acumulado, punto) => acumulado + punto.cobrado, 0);

  return { puntos, totalFacturado, totalCobrado, totalDiferencia: totalFacturado - totalCobrado };
}
