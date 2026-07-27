import { describe, expect, it } from 'vitest';
import { validateCobroForm, type CobroFormInput } from './validateCobroForm';

function input(overrides: Partial<CobroFormInput> = {}): CobroFormInput {
  return {
    montoPagado: 1000,
    fecha: '2026-08-15',
    montoFactura: 5000,
    totalCobradoActual: 0,
    ...overrides,
  };
}

describe('validateCobroForm', () => {
  it('el monto pagado es obligatorio y debe ser positivo', () => {
    expect(validateCobroForm(input({ montoPagado: 0 })).montoPagado).toBeTruthy();
    expect(validateCobroForm(input({ montoPagado: -100 })).montoPagado).toBeTruthy();
  });

  it('la fecha es obligatoria', () => {
    expect(validateCobroForm(input({ fecha: '' })).fecha).toBeTruthy();
  });

  it('alerta (sin bloquear) cuando la suma cobrada superaría el monto de la factura', () => {
    const resultado = validateCobroForm(input({ montoPagado: 4500, totalCobradoActual: 1000, montoFactura: 5000 }));
    expect(resultado.alertaExceso).toBeTruthy();
    // No es un error de campo — no debería impedir el submit por sí solo.
    expect(resultado.montoPagado).toBeUndefined();
  });

  it('sin exceso, no hay alerta ni errores', () => {
    const resultado = validateCobroForm(input({ montoPagado: 2000, totalCobradoActual: 1000, montoFactura: 5000 }));
    expect(resultado).toEqual({});
  });

  it('un cobro que salda exactamente el monto no dispara alerta (borde inclusive)', () => {
    const resultado = validateCobroForm(input({ montoPagado: 4000, totalCobradoActual: 1000, montoFactura: 5000 }));
    expect(resultado.alertaExceso).toBeUndefined();
  });
});
