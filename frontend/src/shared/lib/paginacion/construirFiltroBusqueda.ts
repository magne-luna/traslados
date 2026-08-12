// Única definición de "qué matchea" un término de búsqueda en un listado paginado (design.md
// §D5/§D9). La consumen dos caminos que NO pueden desincronizarse:
//   1. La implementación Supabase — traduce el resultado a `.or(...)` de PostgREST.
//   2. El mock en memoria — usa `matcheaFiltroBusqueda` como predicado equivalente.
// Si el mock ordenara/matcheara distinto que Supabase, los tests de UI pasarían en verde contra
// un comportamiento que producción no tiene (design.md §D9).
//
// Semántica (§D5, CHECKPOINT 1 aprobado 2026-08-12): tokenizar por espacios y exigir que CADA
// token matchee ALGUNA columna (AND de ORs). "juan perez" sobre pacientes encuentra a "Juan
// Pérez" tanto en ese orden como al revés ("perez juan") — más flexible que la concatenación en
// memoria de hoy en el orden de palabras, menos flexible en subcadenas que cruzan el límite entre
// nombre y apellido.

export interface FiltroBusqueda {
  /** Tokens normalizados (minúsculas, sin espacios extra), en el orden en que se escribieron. */
  tokens: string[];
  /**
   * Una expresión por token, lista para encadenar con `.or()` de supabase-js (formato PostgREST:
   * `columna.ilike."%valor%",columna2.ilike."%valor%"`). Encadenar una llamada `.or()` por
   * elemento produce el AND-de-ORs: cada llamada de filtro adicional de supabase-js se combina
   * con AND respecto de las anteriores, así que N tokens ⇒ N llamadas `.or()` ⇒ AND de N ORs.
   */
  expresionesOr: string[];
}

// `%` y `_` son los comodines de LIKE/ILIKE en Postgres: si el término del usuario los trae
// literalmente, hay que escaparlos para que no se interpreten como wildcard (nosotros ya
// agregamos los `%` de los extremos a propósito). `\$&` reinserta el carácter matcheado con un
// backslash de escape delante.
function escaparValorIlike(valor: string): string {
  return valor.replace(/[%_]/g, '\\$&');
}

// Una condición `columna.ilike."%valor%"` por columna buscable, para un único token ya escapado.
// Las comillas dobles alrededor del valor son las que neutralizan la coma como separador de
// `.or()` de PostgREST (ver comentario de `FiltroBusqueda.expresionesOr` y su test dedicado).
function expresionIlikePorColumna(token: string, columnas: readonly string[]): string {
  const valorEscapado = escaparValorIlike(token);
  return columnas.map((columna) => `${columna}.ilike."%${valorEscapado}%"`).join(',');
}

/**
 * Construye el filtro a partir de un término libre y las columnas donde buscarlo. Término vacío
 * (o solo espacios) ⇒ sin filtro (`null`) — nunca una expresión vacía que "no matchea nada".
 */
export function construirFiltroBusqueda(termino: string, columnas: readonly string[]): FiltroBusqueda | null {
  const tokens = termino
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) return null;

  const expresionesOr = tokens.map((token) => expresionIlikePorColumna(token, columnas));

  return { tokens, expresionesOr };
}

/**
 * Predicado en memoria equivalente a `construirFiltroBusqueda`, para el mock (§D9): dado un
 * filtro ya construido y los valores de las columnas buscables de una fila, decide si matchea con
 * la MISMA semántica (AND de tokens, cada token matchea alguna columna). `filtro` en `null`
 * (sin búsqueda) siempre matchea — mismo criterio que "sin filtro" del lado Supabase.
 */
export function matcheaFiltroBusqueda(valoresColumnas: readonly (string | null | undefined)[], filtro: FiltroBusqueda | null): boolean {
  if (!filtro) return true;

  const valoresNormalizados = valoresColumnas.map((valor) => (valor ?? '').toLowerCase());

  return filtro.tokens.every((token) => valoresNormalizados.some((valor) => valor.includes(token)));
}
