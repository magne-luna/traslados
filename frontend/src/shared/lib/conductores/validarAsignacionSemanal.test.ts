import { describe, expect, it } from 'vitest';
import type { AsignacionSemanal } from '../../types/conductor';
import { validarAsignacionSemanal } from './validarAsignacionSemanal';

// Función pura (tasks.md 2.2, design.md Decisión 6): un conductor no puede quedar asignado a
// dos vehículos distintos en la misma semana, salvo que se permita explícitamente
// (`permitirMultiple`) — test de C-09, portado al frontend.

function asignacion(overrides: Partial<AsignacionSemanal> = {}): AsignacionSemanal {
  return { id: 'asig-1', vehiculoId: 'vehiculo-etios', semana: '2026-W30', ...overrides };
}

describe('validarAsignacionSemanal', () => {
  it('permite la asignación cuando el conductor no tiene ninguna asignación esa semana', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-etios',
      permitirMultiple: false,
    });

    expect(resultado.ok).toBe(true);
  });

  it('bloquea por colisión cuando ya hay una asignación a OTRO vehículo la misma semana (triangulación)', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [asignacion({ vehiculoId: 'vehiculo-etios', semana: '2026-W30' })],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-kangoo',
      permitirMultiple: false,
    });

    expect(resultado.ok).toBe(false);
  });

  it('reasignar el MISMO vehículo en la misma semana no es colisión (idempotente/edición)', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [asignacion({ vehiculoId: 'vehiculo-etios', semana: '2026-W30' })],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-etios',
      permitirMultiple: false,
    });

    expect(resultado.ok).toBe(true);
  });

  it('una asignación a otro vehículo en una semana DISTINTA no es colisión', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [asignacion({ vehiculoId: 'vehiculo-etios', semana: '2026-W29' })],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-kangoo',
      permitirMultiple: false,
    });

    expect(resultado.ok).toBe(true);
  });

  it('permitirMultiple habilita la excepción explícita de doble asignación la misma semana', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [asignacion({ vehiculoId: 'vehiculo-etios', semana: '2026-W30' })],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-kangoo',
      permitirMultiple: true,
    });

    expect(resultado.ok).toBe(true);
  });
});
