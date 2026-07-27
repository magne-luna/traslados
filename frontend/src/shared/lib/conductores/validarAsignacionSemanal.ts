import type { AsignacionSemanal } from '../../types/conductor';

// Función pura (tasks.md 2.2, design.md Decisión 6): valida que un conductor no quede asignado
// a dos vehículos distintos en la misma semana, salvo que se permita explícitamente
// (`permitirMultiple`) — mismo test que define C-09 backend, portado al frontend.

export interface ValidarAsignacionSemanalInput {
  /** Asignaciones ya existentes del conductor (antes de agregar la nueva). */
  asignaciones: AsignacionSemanal[];
  semana: string;
  vehiculoId: string;
  /** Excepción explícita (design.md Decisión 6): apagada por defecto. */
  permitirMultiple: boolean;
}

export type ValidarAsignacionSemanalResultado = { ok: true } | { ok: false; error: string };

export function validarAsignacionSemanal({
  asignaciones,
  semana,
  vehiculoId,
  permitirMultiple,
}: ValidarAsignacionSemanalInput): ValidarAsignacionSemanalResultado {
  const colision = asignaciones.find((a) => a.semana === semana && a.vehiculoId !== vehiculoId);

  if (colision && !permitirMultiple) {
    return {
      ok: false,
      error: `El conductor ya tiene una asignación a otro vehículo en la semana ${semana}.`,
    };
  }

  return { ok: true };
}
