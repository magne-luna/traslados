import { describe, expect, it } from 'vitest';
import { validateFacturaForm, type FacturaFormInput } from './validateFacturaForm';

function input(overrides: Partial<FacturaFormInput> = {}): FacturaFormInput {
  return {
    pacienteId: 'paciente-martina',
    mesFacturado: 8,
    anioFacturado: 2026,
    valorKm: 300,
    dias: 10,
    ...overrides,
  };
}

describe('validateFacturaForm', () => {
  it('sin paciente seleccionado, devuelve error en pacienteId', () => {
    const errors = validateFacturaForm(input({ pacienteId: null }));
    expect(errors.pacienteId).toBeTruthy();
  });

  it('sin mes o año cargados, devuelve error de período', () => {
    expect(validateFacturaForm(input({ mesFacturado: null })).periodo).toBeTruthy();
    expect(validateFacturaForm(input({ anioFacturado: null })).periodo).toBeTruthy();
  });

  it('con un mes fuera de 1-12, devuelve error de período', () => {
    expect(validateFacturaForm(input({ mesFacturado: 13 })).periodo).toBeTruthy();
    expect(validateFacturaForm(input({ mesFacturado: 0 })).periodo).toBeTruthy();
  });

  it('con valor del km faltante (0 o negativo), devuelve error en valorKm', () => {
    expect(validateFacturaForm(input({ valorKm: 0 })).valorKm).toBeTruthy();
    expect(validateFacturaForm(input({ valorKm: -5 })).valorKm).toBeTruthy();
  });

  it('con cantidad de días faltante (0 o negativa), devuelve error en dias', () => {
    expect(validateFacturaForm(input({ dias: 0 })).dias).toBeTruthy();
  });

  it('con todos los campos requeridos completos, no devuelve errores', () => {
    expect(validateFacturaForm(input())).toEqual({});
  });
});
