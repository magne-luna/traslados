import { describe, expect, it } from 'vitest';
import { validarAutorizacion, validarVigenciaAutorizacion } from './validarAutorizacion';

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

// validarVigenciaAutorizacion (tasks.md 8.6, design.md D1, spec presupuesto-vigencia "La
// autorización puede recortar el período pedido"): regla candidata distinta de RN-PA-01 — el
// período autorizado debe estar CONTENIDO en el pedido, no solo "no exceder" un único número.
describe('validarVigenciaAutorizacion', () => {
  it('acepta cuando el período autorizado coincide exactamente con el pedido', () => {
    const resultado = validarVigenciaAutorizacion({
      vigenciaDesde: '2026-02-01',
      vigenciaHasta: '2027-01-31',
      presupuestoVigenciaDesde: '2026-02-01',
      presupuestoVigenciaHasta: '2027-01-31',
    });

    expect(resultado.ok).toBe(true);
  });

  it('acepta cuando la obra social autoriza menos período del pedido (recorte por dentro)', () => {
    const resultado = validarVigenciaAutorizacion({
      vigenciaDesde: '2026-02-01',
      vigenciaHasta: '2026-08-31',
      presupuestoVigenciaDesde: '2026-02-01',
      presupuestoVigenciaHasta: '2027-01-31',
    });

    expect(resultado.ok).toBe(true);
  });

  it('rechaza cuando vigenciaHasta autorizada excede la del presupuesto', () => {
    const resultado = validarVigenciaAutorizacion({
      vigenciaHasta: '2027-06-30',
      presupuestoVigenciaHasta: '2027-01-31',
    });

    expect(resultado.ok).toBe(false);
    if (!resultado.ok) {
      expect(resultado.error).toMatch(/período/i);
      // Distingue el mensaje del de RN-PA-01 (monto) — spec "el mensaje distingue este caso del
      // de RN-PA-01, que es una regla distinta".
      expect(resultado.error).not.toMatch(/RN-PA-01/);
    }
  });

  it('rechaza cuando vigenciaDesde autorizada es anterior a la del presupuesto', () => {
    const resultado = validarVigenciaAutorizacion({
      vigenciaDesde: '2026-01-01',
      presupuestoVigenciaDesde: '2026-02-01',
    });

    expect(resultado.ok).toBe(false);
  });

  it('acepta cuando falta cualquiera de los dos lados (nada que validar todavía)', () => {
    expect(validarVigenciaAutorizacion({ vigenciaHasta: '2027-06-30' }).ok).toBe(true);
    expect(validarVigenciaAutorizacion({ presupuestoVigenciaHasta: '2027-01-31' }).ok).toBe(true);
    expect(validarVigenciaAutorizacion({}).ok).toBe(true);
  });

  it('la carga retroactiva (RN-PA-02) sigue funcionando: vigenciaDesde anterior a hoy no es rechazada por esta regla', () => {
    // Esta función solo compara contra el presupuesto, nunca contra "hoy" — RN-PA-02 (carga
    // retroactiva) vive en otro lugar y no debe verse afectada por este agregado.
    const resultado = validarVigenciaAutorizacion({
      vigenciaDesde: '2020-01-01',
      presupuestoVigenciaDesde: '2020-01-01',
    });

    expect(resultado.ok).toBe(true);
  });
});
