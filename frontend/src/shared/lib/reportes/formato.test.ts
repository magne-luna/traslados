import { describe, expect, it } from 'vitest';
import { formatoMoneda } from './formato';

// tasks.md 6.5, design.md Decisión 8: helper único de formato de moneda — ningún componente
// formatea montos a mano.

describe('formatoMoneda', () => {
  it('formatea un monto positivo como moneda argentina', () => {
    expect(formatoMoneda(100_000)).toBe(
      new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(100_000),
    );
  });

  it('formatea cero sin lanzar error', () => {
    expect(formatoMoneda(0)).toBe(new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(0));
  });

  it('formatea un monto negativo (diferencia facturado-cobrado) con el signo', () => {
    const resultado = formatoMoneda(-30_000);
    expect(resultado).toContain('-');
  });
});
