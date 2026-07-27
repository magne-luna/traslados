import { describe, expect, it } from 'vitest';
import { validarCompatibilidadAccesorio } from './validarCompatibilidadAccesorio';

// Función pura (tasks.md 2.1, design.md Decisión 7): valida RN-VE-01 ("bloqueo de asignación de
// paciente a vehículo con accesorio de movilidad incompatible"), espejo en UI de la regla que el
// backend C-10 re-valida. Sin efectos de red ni localStorage — testeable con valores fijos.

describe('validarCompatibilidadAccesorio', () => {
  it('rechaza cuando el paciente requiere un accesorio que el vehículo no soporta (RN-VE-01)', () => {
    const resultado = validarCompatibilidadAccesorio({
      accesoriosPaciente: ['silla-rigida'],
      accesoriosCompatiblesVehiculo: ['silla-plegable'],
    });

    expect(resultado.ok).toBe(false);
  });

  it('acepta cuando todos los accesorios del paciente están entre los compatibles del vehículo (triangulación)', () => {
    const resultado = validarCompatibilidadAccesorio({
      accesoriosPaciente: ['silla-plegable', 'andador'],
      accesoriosCompatiblesVehiculo: ['silla-plegable', 'andador', 'tripode'],
    });

    expect(resultado.ok).toBe(true);
  });

  it('acepta cuando el paciente no tiene accesorios de movilidad cargados (borde)', () => {
    const resultado = validarCompatibilidadAccesorio({
      accesoriosPaciente: [],
      accesoriosCompatiblesVehiculo: ['silla-plegable'],
    });

    expect(resultado.ok).toBe(true);
  });

  it('el resultado depende solo de los argumentos (función pura, sin efectos)', () => {
    const primero = validarCompatibilidadAccesorio({
      accesoriosPaciente: ['tripode'],
      accesoriosCompatiblesVehiculo: ['silla-plegable'],
    });
    const segundo = validarCompatibilidadAccesorio({
      accesoriosPaciente: ['tripode'],
      accesoriosCompatiblesVehiculo: ['silla-plegable'],
    });

    expect(primero).toEqual(segundo);
  });
});
