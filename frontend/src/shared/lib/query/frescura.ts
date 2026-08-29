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
  /** Padrones casi estáticos: pacientes, vehículos, conductores, obras sociales (vía `list()`).
   *
   * 1 minuto, no 5 (decisión de la usuaria, 2026-08-29). Bajar este plazo NO devuelve la espera:
   * mientras el dato siga en memoria (ver `gcTime` en app/queryClient.ts, 10 min) React Query lo
   * entrega igual, instantáneo y sin spinner, y revalida en segundo plano. Lo único que cambia es
   * cuántos requests se hacen. A cambio, la ventana en que se ve un alta hecha por OTRA persona
   * desactualizada baja de 5 minutos a 1 (riesgo R4) — que importa porque hay varias personas
   * cargando datos a la vez. */
  referencia: 60 * 1000,
  /** Dinero y agenda: facturas, cobros, presupuestos, autorizaciones, hojas de ruta. */
  transaccional: 0,
  /** Resultados de `listPage()`: dependen de la página y del filtro vigentes. */
  paginado: 0,
  /** Cuentas y permisos. */
  sensible: 0,
} as const;

export type ClaseFrescura = keyof typeof FRESCURA;
