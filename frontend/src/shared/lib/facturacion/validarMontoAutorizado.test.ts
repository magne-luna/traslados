import { describe, expect, it } from 'vitest';
import { validarMontoAutorizado } from './validarMontoAutorizado';

describe('validarMontoAutorizado', () => {
  it('sin montoAutorizado cargado: ok, sin dato de autorización disponible', () => {
    const resultado = validarMontoAutorizado({ montoConsumidoAnual: 1000, montoNuevo: 500, montoAutorizado: undefined });

    expect(resultado).toEqual({
      montoAutorizadoDisponible: false,
      excede: false,
      mensaje: 'No hay monto autorizado cargado para validar esta factura.',
    });
  });

  it('acumulado + nuevo dentro del monto anual: ok, informa el acumulado', () => {
    const resultado = validarMontoAutorizado({ montoConsumidoAnual: 1000, montoNuevo: 500, montoAutorizado: 5000 });

    expect(resultado.montoAutorizadoDisponible).toBe(true);
    expect(resultado.excede).toBe(false);
    expect(resultado.mensaje).toMatch(/facturado en el año/i);
    expect(resultado.mensaje).toMatch(/\$\s?1[.,]500/);
    expect(resultado.mensaje).toMatch(/\$\s?5[.,]000/);
  });

  it('acumulado + nuevo supera el monto anual: excede, mensaje aclara que es el total ANUAL', () => {
    const resultado = validarMontoAutorizado({ montoConsumidoAnual: 4800, montoNuevo: 500, montoAutorizado: 5000 });

    expect(resultado.montoAutorizadoDisponible).toBe(true);
    expect(resultado.excede).toBe(true);
    expect(resultado.mensaje).toMatch(/anual/i);
    expect(resultado.mensaje).toMatch(/supera el monto autorizado/i);
    expect(resultado.mensaje).toMatch(/\$\s?5[.,]300/);
    expect(resultado.mensaje).toMatch(/\$\s?5[.,]000/);
  });

  it('justo en el límite (acumulado + nuevo === montoAutorizado): no excede', () => {
    const resultado = validarMontoAutorizado({ montoConsumidoAnual: 4500, montoNuevo: 500, montoAutorizado: 5000 });

    expect(resultado.excede).toBe(false);
  });
});
