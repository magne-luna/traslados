import { describe, expect, it } from 'vitest';
import type { AsignacionSemanal } from '../../types/conductor';
import { validarAsignacionSemanal } from './validarAsignacionSemanal';

// Función pura (tasks.md 2D.1, design.md D7 §Colisión — resuelto 2026-07-31): un conductor no
// puede quedar asignado a dos vehículos distintos en la misma semana. Se bloquea SIEMPRE, sin
// excepción y sin override — la barrera real es un constraint de la base (`uq_conductor_semana`),
// esta función es solo feedback inmediato client-side.

function asignacion(overrides: Partial<AsignacionSemanal> = {}): AsignacionSemanal {
  return { id: 'asig-1', vehiculoId: 'vehiculo-etios', semana: '2026-W30', ...overrides };
}

describe('validarAsignacionSemanal', () => {
  it('permite la asignación cuando el conductor no tiene ninguna asignación esa semana', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-etios',
    });

    expect(resultado.ok).toBe(true);
  });

  it('bloquea por colisión cuando ya hay una asignación a OTRO vehículo la misma semana (triangulación)', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [asignacion({ vehiculoId: 'vehiculo-etios', semana: '2026-W30' })],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-kangoo',
    });

    expect(resultado.ok).toBe(false);
  });

  it('reasignar el MISMO vehículo en la misma semana no es colisión (idempotente/edición)', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [asignacion({ vehiculoId: 'vehiculo-etios', semana: '2026-W30' })],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-etios',
    });

    expect(resultado.ok).toBe(true);
  });

  it('una asignación a otro vehículo en una semana DISTINTA no es colisión', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [asignacion({ vehiculoId: 'vehiculo-etios', semana: '2026-W29' })],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-kangoo',
    });

    expect(resultado.ok).toBe(true);
  });

  // D7 §Colisión (2026-07-31): la excepción explícita `permitirMultiple` se elimina — la colisión
  // se bloquea SIEMPRE, sin override. Este test reemplaza al que antes afirmaba lo contrario (no
  // se borra: se invierte la aserción, que es lo que documenta la decisión).
  it('la colisión se rechaza igual aunque antes existiera un override — ya no hay ninguna forma de habilitarla', () => {
    const resultado = validarAsignacionSemanal({
      asignaciones: [asignacion({ vehiculoId: 'vehiculo-etios', semana: '2026-W30' })],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-kangoo',
    });

    expect(resultado.ok).toBe(false);
  });

  it('la firma no declara ningún parámetro de override', () => {
    const conFlagInexistente: Parameters<typeof validarAsignacionSemanal>[0] = {
      asignaciones: [],
      semana: '2026-W30',
      vehiculoId: 'vehiculo-etios',
      // @ts-expect-error — `permitirMultiple` ya no existe en `ValidarAsignacionSemanalInput`.
      permitirMultiple: true,
    };
    expect(conFlagInexistente.vehiculoId).toBe('vehiculo-etios');
  });
});
