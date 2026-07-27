import { describe, expect, it } from 'vitest';
import { validatePacienteForm } from './validatePacienteForm';

describe('validatePacienteForm', () => {
  it('señala apellido, nombre y DNI como requeridos cuando están vacíos', () => {
    const errors = validatePacienteForm({ apellido: '', nombre: '', dni: '' });

    expect(errors.apellido).toBeTruthy();
    expect(errors.nombre).toBeTruthy();
    expect(errors.dni).toBeTruthy();
  });

  it('no reporta errores cuando los tres campos requeridos están completos (triangulación)', () => {
    const errors = validatePacienteForm({ apellido: 'Gómez', nombre: 'Martina', dni: '45123456' });

    expect(errors).toEqual({});
  });

  it('trata espacios en blanco como campo vacío', () => {
    const errors = validatePacienteForm({ apellido: '   ', nombre: 'Martina', dni: '45123456' });

    expect(errors.apellido).toBeTruthy();
  });
});
