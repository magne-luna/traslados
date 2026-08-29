// Plazos de frescura por clase de dato (design.md §D3). Único lugar donde vive esta política:
// cambiar un plazo es cambiar una línea acá, sin tocar ningún consumidor.
//
// La regla que este módulo hace cumplir: **la cacheabilidad se opta explícitamente, nunca por
// omisión** (spec, "Un dominio sin clase declarada no se cachea"). El default global del
// QueryClient es 0 (ver app/queryClient.ts), así que un dominio que se olvide de declarar su clase
// se comporta como se comportaba el sistema antes de existir la caché — nunca peor.
//
// ⚠️ `referencia` es el ÚNICO valor distinto de cero, y solo aplica a los cuatro padrones casi
// estáticos leídos por `list()`. Ponerlo sobre facturas, cobros, presupuestos, autorizaciones u
// hojas de ruta es el riesgo R2 del change: mostrarle a la usuaria plata desactualizada.
export const FRESCURA = {
  /** Padrones casi estáticos: pacientes, vehículos, conductores, obras sociales (vía `list()`). */
  referencia: 5 * 60 * 1000,
  /** Dinero y agenda: facturas, cobros, presupuestos, autorizaciones, hojas de ruta. */
  transaccional: 0,
  /** Resultados de `listPage()`: dependen de la página y del filtro vigentes. */
  paginado: 0,
  /** Cuentas y permisos. */
  sensible: 0,
} as const;

export type ClaseFrescura = keyof typeof FRESCURA;
