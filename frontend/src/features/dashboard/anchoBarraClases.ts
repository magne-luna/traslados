// Lookup de clases Tailwind estáticas por paso de ancho (0/5/10/…/100%), mismo criterio que
// `chipColors`/`bgClassName` en design-system/components.tsx: Tailwind no puede generar clases
// a partir de un string armado en runtime (`w-[${pct}%]`), así que el ancho se resuelve por
// lookup contra un mapa cerrado de clases YA escritas en el código fuente — Tailwind las
// detecta en build time porque están presentes literalmente acá, no interpoladas.
const ANCHO_POR_PASO: Record<number, string> = {
  0: 'w-0',
  5: 'w-[5%]',
  10: 'w-[10%]',
  15: 'w-[15%]',
  20: 'w-1/5',
  25: 'w-1/4',
  30: 'w-[30%]',
  35: 'w-[35%]',
  40: 'w-2/5',
  45: 'w-[45%]',
  50: 'w-1/2',
  55: 'w-[55%]',
  60: 'w-3/5',
  65: 'w-[65%]',
  70: 'w-[70%]',
  75: 'w-3/4',
  80: 'w-4/5',
  85: 'w-[85%]',
  90: 'w-[90%]',
  95: 'w-[95%]',
  100: 'w-full',
};

/**
 * Clase Tailwind de ancho más cercana al porcentaje pedido, redondeada al paso de 5% más
 * próximo (design.md Decisión 8: barras proporcionales al máximo del rango, sin `style={{}}`).
 */
export function claseAnchoProporcional(porcentaje: number): string {
  const acotado = Math.max(0, Math.min(100, porcentaje));
  const paso = Math.round(acotado / 5) * 5;
  // ANCHO_POR_PASO cubre los 21 pasos posibles (0, 5, 10, ..., 100) — acotado ya garantiza el
  // rango [0, 100], así que el lookup siempre resuelve; el `?? 'w-0'` es solo para que `tsc`
  // (noUncheckedIndexedAccess) tipe el resultado como `string`, nunca `string | undefined`.
  return ANCHO_POR_PASO[paso] ?? 'w-0';
}
