import { describe, expect, it } from 'vitest';
import { validateCuentaForm } from './validateCuentaForm';

const VALIDO = { email: 'x@x.com', nombre: 'X', apellido: 'Y', password: 'password-12' };

describe('validateCuentaForm', () => {
  it('sin errores cuando todos los campos son válidos', () => {
    expect(validateCuentaForm(VALIDO)).toEqual({});
  });

  it('email obligatorio', () => {
    expect(validateCuentaForm({ ...VALIDO, email: '  ' }).email).toBe('El email es obligatorio.');
  });

  it('nombre obligatorio (triangulación)', () => {
    expect(validateCuentaForm({ ...VALIDO, nombre: '' }).nombre).toBe('El nombre es obligatorio.');
  });

  it('apellido obligatorio (triangulación)', () => {
    expect(validateCuentaForm({ ...VALIDO, apellido: '' }).apellido).toBe('El apellido es obligatorio.');
  });

  it('contraseña de menos de 8 caracteres es rechazada', () => {
    expect(validateCuentaForm({ ...VALIDO, password: '1234567' }).password).toBe(
      'La contraseña debe tener 8 caracteres o más.',
    );
  });

  it('contraseña de exactamente 8 caracteres es válida (triangulación del límite)', () => {
    expect(validateCuentaForm({ ...VALIDO, password: '12345678' }).password).toBeUndefined();
  });
});
