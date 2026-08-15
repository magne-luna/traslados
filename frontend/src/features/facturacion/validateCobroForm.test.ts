import { describe, expect, it } from 'vitest';
import { validateCobroForm, type CobroFormInput } from './validateCobroForm';

function input(overrides: Partial<CobroFormInput> = {}): CobroFormInput {
  return {
    montoPagado: 1000,
    fecha: '2026-08-15',
    montoFactura: 5000,
    totalCobradoActual: 0,
    admitePagosParciales: true,
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

// RF-306: cuando la obra social NO admite pagos parciales, un cobro por menos del saldo
// pendiente de la factura se bloquea (error duro) — no es el criterio informativo de
// `alertaExceso` (avisa, no impide).
describe('validateCobroForm — RF-306 (admitePagosParciales)', () => {
  it('la obra social admite pagos parciales: un cobro parcial pasa igual que siempre', () => {
    const resultado = validateCobroForm(
      input({ admitePagosParciales: true, montoPagado: 1000, totalCobradoActual: 0, montoFactura: 5000 }),
    );
    expect(resultado.pagoParcialNoAdmitido).toBeUndefined();
  });

  it('la obra social NO admite pagos parciales y el cobro completa exactamente el saldo pendiente: pasa', () => {
    const resultado = validateCobroForm(
      input({ admitePagosParciales: false, montoPagado: 4000, totalCobradoActual: 1000, montoFactura: 5000 }),
    );
    expect(resultado.pagoParcialNoAdmitido).toBeUndefined();
  });

  it('la obra social NO admite pagos parciales y el cobro es parcial: bloquea con mensaje claro', () => {
    const resultado = validateCobroForm(
      input({ admitePagosParciales: false, montoPagado: 1000, totalCobradoActual: 0, montoFactura: 5000 }),
    );
    expect(resultado.pagoParcialNoAdmitido).toBeTruthy();
    expect(resultado.pagoParcialNoAdmitido).toMatch(/no admite pagos parciales/i);
    expect(resultado.pagoParcialNoAdmitido).toMatch(/\$5000/);
  });

  it('la obra social NO admite pagos parciales y el cobro se pasa del saldo: no choca con alertaExceso (ambas conviven, ninguna bloquea/pisa a la otra indebidamente)', () => {
    const resultado = validateCobroForm(
      input({ admitePagosParciales: false, montoPagado: 4500, totalCobradoActual: 1000, montoFactura: 5000 }),
    );
    // Un cobro que se pasa del saldo YA completa (y supera) el saldo pendiente: no es un pago
    // parcial respecto del saldo, así que la regla dura de RF-306 no debe dispararse acá.
    expect(resultado.pagoParcialNoAdmitido).toBeUndefined();
    expect(resultado.alertaExceso).toBeTruthy();
  });
});
