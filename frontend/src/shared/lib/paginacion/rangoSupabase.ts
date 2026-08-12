// Función pura: traduce un RangoPagina (1-based, "página N de tamaño M") al rango de índices
// 0-based que espera `.range(desde, hasta)` de PostgREST/supabase-js (design.md §D2/D6).

import type { RangoPagina } from '../../types/paginacion';

export interface RangoSupabase {
  desde: number;
  hasta: number;
}

export function rangoSupabase({ pagina, tamanio }: RangoPagina): RangoSupabase {
  const desde = (pagina - 1) * tamanio;
  // `.range()` de PostgREST es INCLUSIVO en ambos extremos (a diferencia de `Array.prototype
  // .slice`, que excluye el índice final) — por eso `hasta` resta 1 y no simplemente suma
  // `tamanio`: página 1 tamaño 20 debe pedir los índices [0, 19] (20 filas), no [0, 20] (21).
  return { desde, hasta: desde + tamanio - 1 };
}
