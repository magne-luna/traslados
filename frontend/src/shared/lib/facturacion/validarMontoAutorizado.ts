import { formatoMoneda } from '../reportes/formato';

// Función pura (mismo espíritu que `validarCupoFacturacion.ts`, RN-PA-03): compara el total
// facturado en el AÑO (acumulado de todas las facturas de la autorización, `montoConsumidoAnual`
// — ya calculado con `montoConsumido`, ya excluye la factura en edición — más la que se está
// cargando/editando ahora) contra `Autorizacion.montoAutorizado`. NO decide bloquear — solo
// informa, igual que `validarCupoFacturacion`.
//
// Siempre informativo (fix directo, pedido del coordinador): mientras haya `montoAutorizado`
// cargado, el resultado siempre lleva el mensaje de "cuánto se lleva facturado en el año", se
// exceda o no — el caso de exceso no reemplaza esa información, la completa con la advertencia.
export interface ValidarMontoAutorizadoInput {
  /** Acumulado del año para la autorización, sin contar la factura que se está por guardar (ya excluye la que está en edición). */
  montoConsumidoAnual: number;
  /** Total de la factura que se está cargando/editando ahora. */
  montoNuevo: number;
  /** `undefined` = la autorización no tiene monto autorizado cargado (ej. estado pendiente). */
  montoAutorizado?: number;
}

export interface ValidarMontoAutorizadoResultado {
  /** `false` cuando la autorización no tiene monto autorizado cargado contra el cual validar. */
  montoAutorizadoDisponible: boolean;
  excede: boolean;
  mensaje: string;
}

export function validarMontoAutorizado({
  montoConsumidoAnual,
  montoNuevo,
  montoAutorizado,
}: ValidarMontoAutorizadoInput): ValidarMontoAutorizadoResultado {
  if (montoAutorizado === undefined) {
    return {
      montoAutorizadoDisponible: false,
      excede: false,
      mensaje: 'No hay monto autorizado cargado para validar esta factura.',
    };
  }

  const totalAnual = montoConsumidoAnual + montoNuevo;
  const excede = totalAnual > montoAutorizado;

  const mensaje = excede
    ? `El total facturado en el año (${formatoMoneda(totalAnual)}, incluyendo esta factura) supera el monto autorizado anual (${formatoMoneda(montoAutorizado)}).`
    : `Facturado en el año: ${formatoMoneda(totalAnual)} de ${formatoMoneda(montoAutorizado)} autorizados.`;

  return { montoAutorizadoDisponible: true, excede, mensaje };
}
