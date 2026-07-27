import { describe, expect, it } from 'vitest';
import { validateObraSocialForm } from './validateObraSocialForm';

describe('validateObraSocialForm', () => {
  it('no devuelve errores cuando nombre y CUIT están completos', () => {
    const errors = validateObraSocialForm({ nombre: 'OSECAC', cuit: '30-12345678-9' });

    expect(errors).toEqual({});
  });

  it('marca el nombre como faltante cuando está vacío', () => {
    const errors = validateObraSocialForm({ nombre: '', cuit: '30-12345678-9' });

    expect(errors.nombre).toBeDefined();
    expect(errors.cuit).toBeUndefined();
  });

  it('marca el CUIT como faltante cuando está vacío', () => {
    const errors = validateObraSocialForm({ nombre: 'OSECAC', cuit: '' });

    expect(errors.cuit).toBeDefined();
    expect(errors.nombre).toBeUndefined();
  });

  it('trata un nombre compuesto solo de espacios como faltante (borde)', () => {
    const errors = validateObraSocialForm({ nombre: '   ', cuit: '30-12345678-9' });

    expect(errors.nombre).toBeDefined();
  });
});
