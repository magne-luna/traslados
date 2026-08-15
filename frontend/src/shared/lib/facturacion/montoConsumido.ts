import type { Factura } from '../../types/factura';
import { ESTADOS_QUE_CONSUMEN_CUPO } from './cupoConsumido';

// Función pura (mismo patrón que `cupoConsumido.ts`): suma el monto ya facturado en el AÑO para
// una autorización dada, para poder validar `Autorizacion.montoAutorizado` — que es un tope
// ANUAL, no mensual (fix directo, corrección del usuario a mitad de la tarea original: comparar
// una sola factura contra el monto autorizado subestimaba lo ya consumido por otras facturas del
// mismo año). Mismo criterio de "qué factura consume": solo `facturado`/`cobrado`/
// `pagado-parcialmente`, nunca `a-facturar`.
export interface MontoConsumidoOpciones {
  /** Excluye del cálculo la factura que se está editando (evita que se cuente a sí misma). */
  excluirFacturaId?: string;
}

export function montoConsumido(
  facturas: Factura[],
  autorizacionId: string,
  anio: number,
  opciones: MontoConsumidoOpciones = {},
): number {
  return facturas
    .filter(
      (factura) =>
        factura.autorizacionId === autorizacionId &&
        factura.anioFacturado === anio &&
        ESTADOS_QUE_CONSUMEN_CUPO.includes(factura.estado) &&
        factura.id !== opciones.excluirFacturaId,
    )
    .reduce((acumulado, factura) => acumulado + factura.monto, 0);
}
