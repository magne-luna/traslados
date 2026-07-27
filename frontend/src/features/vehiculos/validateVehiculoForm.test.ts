import { describe, expect, it } from 'vitest';
import { validateVehiculoForm } from './validateVehiculoForm';

// Validación de campos requeridos del formulario de Vehículo (RF-500, tasks.md 5.3): patente
// obligatoria y capacidad en el rango 1-6 (RF-500). Función pura: sin acceso a DOM ni al
// repository, para poder testearla aislada del componente.

describe('validateVehiculoForm', () => {
  it('señala la patente faltante cuando está vacía', () => {
    const errors = validateVehiculoForm({ patente: '', capacidad: 4 });

    expect(errors.patente).toBeDefined();
  });

  it('señala la capacidad fuera de rango cuando es menor a 1', () => {
    const errors = validateVehiculoForm({ patente: 'AC123DE', capacidad: 0 });

    expect(errors.capacidad).toBeDefined();
  });

  it('señala la capacidad fuera de rango cuando es mayor a 6 (triangulación con el borde inferior)', () => {
    const errors = validateVehiculoForm({ patente: 'AC123DE', capacidad: 7 });

    expect(errors.capacidad).toBeDefined();
  });

  it('no devuelve errores cuando patente y capacidad son válidas', () => {
    const errors = validateVehiculoForm({ patente: 'AC123DE', capacidad: 4 });

    expect(errors).toEqual({});
  });

  it('acepta los bordes exactos del rango de capacidad (1 y 6)', () => {
    expect(validateVehiculoForm({ patente: 'AC123DE', capacidad: 1 })).toEqual({});
    expect(validateVehiculoForm({ patente: 'AC123DE', capacidad: 6 })).toEqual({});
  });

  it('señala el kilometraje cuando es menor al registrado (RF-505, edición)', () => {
    const errors = validateVehiculoForm({ patente: 'AC123DE', capacidad: 4, kilometraje: 100, kilometrajeMinimo: 200 });

    expect(errors.kilometraje).toBeDefined();
  });

  it('acepta el kilometraje igual al registrado (borde inclusivo, triangulación)', () => {
    const errors = validateVehiculoForm({ patente: 'AC123DE', capacidad: 4, kilometraje: 200, kilometrajeMinimo: 200 });

    expect(errors.kilometraje).toBeUndefined();
  });

  it('no valida kilometraje cuando no hay un mínimo de referencia (alta)', () => {
    const errors = validateVehiculoForm({ patente: 'AC123DE', capacidad: 4, kilometraje: 0 });

    expect(errors.kilometraje).toBeUndefined();
  });
});
