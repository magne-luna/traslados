import { describe, expect, it } from 'vitest';
import { validarAutorizacion } from './validarAutorizacion';

// Función pura (tasks.md 2.1, design.md Decisión 4): valida RN-PA-01 ("la autorización puede
// coincidir con el presupuesto o ser menor, nunca mayor"), espejo en UI de la regla que el
// backend C-06 re-valida. Sin efectos de red ni localStorage — testeable con valores fijos.

describe('validarAutorizacion', () => {
  it('rechaza cuando montoAutorizado es mayor que montoPresupuesto (RN-PA-01)', () => {
    const resultado = validarAutorizacion({ montoAutorizado: 1500, montoPresupuesto: 1000 });

    expect(resultado.ok).toBe(false);
  });

  it('acepta cuando montoAutorizado es igual a montoPresupuesto (borde inclusivo)', () => {
    const resultado = validarAutorizacion({ montoAutorizado: 1000, montoPresupuesto: 1000 });

    expect(resultado.ok).toBe(true);
  });

  it('acepta cuando montoAutorizado es menor que montoPresupuesto (triangulación)', () => {
    const resultado = validarAutorizacion({ montoAutorizado: 500, montoPresupuesto: 1000 });

    expect(resultado.ok).toBe(true);
  });

  it('no reporta error de monto cuando montoAutorizado está ausente (ej. estado pendiente)', () => {
    const resultado = validarAutorizacion({ montoPresupuesto: 1000 });

    expect(resultado.ok).toBe(true);
  });

  it('el resultado depende solo de los argumentos (función pura, sin efectos)', () => {
    const primero = validarAutorizacion({ montoAutorizado: 2000, montoPresupuesto: 1000 });
    const segundo = validarAutorizacion({ montoAutorizado: 2000, montoPresupuesto: 1000 });

    expect(primero).toEqual(segundo);
  });
});
