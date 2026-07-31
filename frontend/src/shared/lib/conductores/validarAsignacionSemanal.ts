import type { AsignacionSemanal } from '../../types/conductor';

// Función pura (tasks.md 2D.1, design.md D7 §Colisión — resuelto 2026-07-31): valida que un
// conductor no quede asignado a dos vehículos distintos en la misma semana. La colisión se
// bloquea SIEMPRE, sin excepción: no hay ningún parámetro que la relaje. Ninguna fuente (KB ni
// docx) confirmó que la excepción fuera un caso real de negocio, y el override `permitirMultiple`
// que existía acá estuvo apagado por defecto desde `conductores-ui` (2026-07-24) sin que nadie lo
// usara. La barrera real pasa a ser el constraint `uq_conductor_semana` en la base (1B.6); esta
// función sigue existiendo como feedback inmediato client-side, no como la única defensa.

export interface ValidarAsignacionSemanalInput {
  /** Asignaciones ya existentes del conductor (antes de agregar la nueva). */
  asignaciones: AsignacionSemanal[];
  semana: string;
  vehiculoId: string;
}

export type ValidarAsignacionSemanalResultado = { ok: true } | { ok: false; error: string };

export function validarAsignacionSemanal({
  asignaciones,
  semana,
  vehiculoId,
}: ValidarAsignacionSemanalInput): ValidarAsignacionSemanalResultado {
  const colision = asignaciones.find((a) => a.semana === semana && a.vehiculoId !== vehiculoId);

  if (colision) {
    return {
      ok: false,
      error: `El conductor ya tiene una asignación a otro vehículo en la semana ${semana}.`,
    };
  }

  return { ok: true };
}
