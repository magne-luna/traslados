// La base del proyecto vive en us-east-1, pero Supabase corre cada Edge Function en la región más
// cercana a quien la llama (sa-east-1 desde Argentina, medido el 2026-10-22 con `x-sb-edge-region`).
// Cada función hace ~8 consultas en serie a la base, y cada una cruzaba el continente: forzar la
// región de la base las vuelve locales. Va como query param y no como header `x-region`, porque el
// header obligaría a sumarlo al CORS de todas las funciones y redeployarlas.
// ponytail: región fija; si el proyecto se muda de región, cambiar esta constante.
const REGION_BASE = 'us-east-1';

export function conRegionDeFunciones(url: string, supabaseUrl: string): string {
  if (!url.startsWith(`${supabaseUrl}/functions/v1/`)) return url;
  const destino = new URL(url);
  if (destino.searchParams.has('forceFunctionRegion')) return url;
  destino.searchParams.set('forceFunctionRegion', REGION_BASE);
  return destino.toString();
}
