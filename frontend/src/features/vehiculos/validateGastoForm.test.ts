import { describe, expect, it } from 'vitest';
import { validateGastoForm } from './validateGastoForm';

// RF-508: alta de gastos validando monto positivo y fecha (tasks.md 7.2). Función pura.

describe('validateGastoForm', () => {
  it('señala el monto cuando está vacío (NaN)', () => {
    const errors = validateGastoForm({ fecha: '2026-07-01', monto: Number.NaN });

    expect(errors.monto).toBeDefined();
  });

  it('señala el monto cuando no es positivo', () => {
    const errors = validateGastoForm({ fecha: '2026-07-01', monto: 0 });

    expect(errors.monto).toBeDefined();
  });

  it('señala la fecha cuando está vacía', () => {
    const errors = validateGastoForm({ fecha: '', monto: 100 });

    expect(errors.fecha).toBeDefined();
  });

  it('no devuelve errores con fecha y monto positivo válidos', () => {
    const errors = validateGastoForm({ fecha: '2026-07-01', monto: 100 });

    expect(errors).toEqual({});
  });
});
