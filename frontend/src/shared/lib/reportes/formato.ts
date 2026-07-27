// Helper único de formato de moneda (design.md Decisión 8, tasks.md 6.5): ningún componente del
// dashboard formatea montos a mano — todos pasan por acá, para que un cambio de formato (por
// ejemplo, decimales) se resuelva en un solo lugar.

const FORMATO_ARS = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

export function formatoMoneda(monto: number): string {
  return FORMATO_ARS.format(monto);
}
