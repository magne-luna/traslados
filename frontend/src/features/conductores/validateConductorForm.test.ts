import { describe, expect, it } from 'vitest';
import { validateConductorForm } from './validateConductorForm';

// Validación de campos requeridos del formulario de Conductor (tasks.md 5.3, spec
// conductor-crud "Validación de campos obligatorios"): apellido, nombre y documento son
// obligatorios (design.md Open Questions — el resto queda opcional hasta confirmar con el
// cliente, ver cartel 9.3). Función pura: sin acceso a DOM ni al repository.

describe('validateConductorForm', () => {
  it('señala el apellido faltante cuando está vacío', () => {
    const errors = validateConductorForm({ apellido: '', nombre: 'Carlos', documento: '15789456' });

    expect(errors.apellido).toBeDefined();
  });

  it('señala el nombre faltante cuando está vacío (triangulación con otro campo)', () => {
    const errors = validateConductorForm({ apellido: 'Pérez', nombre: '', documento: '15789456' });

    expect(errors.nombre).toBeDefined();
  });

  it('señala el documento faltante cuando está vacío', () => {
    const errors = validateConductorForm({ apellido: 'Pérez', nombre: 'Carlos', documento: '' });

    expect(errors.documento).toBeDefined();
  });

  it('señala múltiples campos faltantes a la vez', () => {
    const errors = validateConductorForm({ apellido: '', nombre: '', documento: '' });

    expect(errors.apellido).toBeDefined();
    expect(errors.nombre).toBeDefined();
    expect(errors.documento).toBeDefined();
  });

  it('no devuelve errores cuando apellido, nombre y documento están completos', () => {
    const errors = validateConductorForm({ apellido: 'Pérez', nombre: 'Carlos', documento: '15789456' });

    expect(errors).toEqual({});
  });

  it('trata los espacios en blanco como campo vacío (borde)', () => {
    const errors = validateConductorForm({ apellido: '   ', nombre: 'Carlos', documento: '15789456' });

    expect(errors.apellido).toBeDefined();
  });
});
