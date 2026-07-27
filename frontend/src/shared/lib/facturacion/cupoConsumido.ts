import type { EstadoFactura, Factura } from '../../types/factura';

// Función pura (tasks.md 3.4, design.md Decisión 6, RN-FA-02, RN-PA-03): suma los días y
// kilómetros ya facturados del paciente en el período, para poder validar el cupo mensual
// autorizado. Solo cuenta facturas que ya salieron de `a-facturar` — una factura todavía en
// borrador no "consume" cupo.
const ESTADOS_QUE_CONSUMEN_CUPO: readonly EstadoFactura[] = ['facturado', 'cobrado', 'pagado-parcialmente'];

export interface CupoConsumidoOpciones {
  /** Excluye del cálculo la factura que se está editando (evita que se cuente a sí misma). */
  excluirFacturaId?: string;
}

export interface CupoConsumidoResultado {
  dias: number;
  km: number;
}

export function cupoConsumido(
  facturas: Factura[],
  pacienteId: string,
  mes: number,
  anio: number,
  opciones: CupoConsumidoOpciones = {},
): CupoConsumidoResultado {
  const relevantes = facturas.filter(
    (factura) =>
      factura.pacienteId === pacienteId &&
      factura.mesFacturado === mes &&
      factura.anioFacturado === anio &&
      ESTADOS_QUE_CONSUMEN_CUPO.includes(factura.estado) &&
      factura.id !== opciones.excluirFacturaId,
  );

  return relevantes.reduce(
    (acumulado, factura) => ({
      dias: acumulado.dias + factura.dias,
      km: acumulado.km + factura.cantidadKm,
    }),
    { dias: 0, km: 0 },
  );
}
