import { describe, expect, it } from 'vitest';
import { truncarACentavos } from './montos';

// Andrea (2026-10-07): "coma 24, mejor menos que más" — se corta, nunca se redondea para arriba.
describe('truncarACentavos', () => {
  it('corta en el segundo decimal sin redondear', () => {
    expect(truncarACentavos(237643.875)).toBe(237643.87);
    expect(truncarACentavos(12.249)).toBe(12.24);
  });

  it('no le resta un centavo a un número que ya tiene 2 decimales (coma flotante)', () => {
    expect(truncarACentavos(0.1 * 3)).toBe(0.3);
    expect(truncarACentavos(0.29)).toBe(0.29);
    expect(truncarACentavos(1.005)).toBe(1);
  });

  it('enteros quedan iguales', () => {
    expect(truncarACentavos(90000)).toBe(90000);
  });
});
