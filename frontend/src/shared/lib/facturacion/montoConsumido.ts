import type { Factura } from '../../types/factura';
import { ESTADOS_QUE_CONSUMEN_CUPO } from './cupoConsumido';

// Función pura (mismo patrón que `cupoConsumido.ts`): suma el monto ya facturado, filtrado por
// `autorizacionId` + `anio`, para poder validar `Autorizacion.montoAutorizado`. Mismo criterio de
// "qué factura consume": solo `facturado`/`cobrado`/`pagado-parcialmente`, nunca `a-facturar`.
//
// `autorizacion-mensual` (design.md D8, tasks.md 6b.4, firma G4 en tasks.md 0.2): esta función NO
// cambia una línea de código en este change — y es precisamente ESO lo que hace que su semántica
// de negocio cambie sin que ningún diff lo muestre. Conviven dos lecturas del mismo filtro, según
// si la autorización tiene o no `periodoMes` cargado:
//
// - **Fila LEGACY** (`periodoMes === undefined`, modelo 1:1 anterior a este change): N facturas
//   del año apuntan a la MISMA `autorizacionId` ⇒ la suma sigue siendo el consumo **ANUAL** contra
//   un `montoAutorizado` anual — el comportamiento original, sin cambios.
// - **Fila MENSUAL** (`periodoMes` presente, modelo 1:N de este change): cada factura de un mes
//   dado apunta a la autorización DE ESE MES (una fila distinta por mes) ⇒ la suma para una
//   `autorizacionId` dada incluye solo las facturas de ese mes ⇒ el mismo código, sin tocar una
//   línea, valida un tope **MENSUAL**. El parámetro `anio` queda redundante-pero-inocuo (todas las
//   facturas de un mismo `periodoMes` comparten año).
//
// Firma humana explícita (G4, tasks.md 0.2): "tope anual → tope del mes" para las filas con
// `periodoMes` es la lectura correcta — decisión provisoria de la usuaria (OQ-1 en
// `knowledge-base/10_preguntas_abiertas.md`), no confirmación de Andrea. Alternativa descartada:
// agregar `periodoMes` como parámetro y bifurcar adentro — pondría una regla de negocio no resuelta
// (OQ-1) dentro de una función que hoy no la tiene. Ver tests nominados abajo, uno por semántica.
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
