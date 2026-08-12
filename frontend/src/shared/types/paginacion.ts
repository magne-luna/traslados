// Contrato transversal de paginación (paginacion-listados, design.md D3/D6). `listPage()` es
// ADITIVO a cada repository: `list()` no cambia de firma en ningún lado (ver design.md §D3 sobre
// por qué mezclar ambos comportamientos en un solo método miente en silencio a sus consumidores
// de "todo el universo" — combos, selectores, dashboard).
//
// Fase 0: estos tipos no tienen todavía ningún consumidor real (ningún repository los usa aún) —
// es intencional (design.md, tabla de Fases). Se agregan en las fases 1-3.

/**
 * Rango de página pedido a un `listPage()`. 1-based: la primera página es `1`, nunca `0` — así lo
 * ve la usuaria en el `<Paginador>` ("Página 1 de N"), sin traducir offsets internamente en cada
 * pantalla.
 */
export interface RangoPagina {
  /** Página pedida, 1-based. */
  pagina: number;
  /** Cantidad de filas por página. */
  tamanio: number;
}

/**
 * Resultado de un `listPage()`. `total` es el universo que matchea el filtro aplicado (no
 * `items.length`, que es como mucho `tamanio`) — es lo que permite al `<Paginador>` mostrar
 * "Página N de M" y el total de resultados sin una segunda consulta.
 */
export interface Pagina<T> {
  items: T[];
  /** Total de filas que matchean el filtro, no las de esta página. */
  total: number;
  /** Página devuelta (eco del `RangoPagina` pedido), 1-based. */
  pagina: number;
  /** Tamaño de página devuelto (eco del `RangoPagina` pedido). */
  tamanio: number;
}
