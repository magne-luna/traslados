// Función pura (tasks.md 2.1, design.md Decisión 7): valida RN-VE-01 ("todo accesorio de
// movilidad del paciente debe estar entre los compatibles del vehículo"). Espejo en UI de la
// regla que el backend C-10 re-valida. Sin efectos de red ni localStorage — testeable con
// valores fijos.

import type { AccesorioMovilidad } from '../../types/vehiculo';

export interface ValidarCompatibilidadAccesorioInput {
  accesoriosPaciente: AccesorioMovilidad[];
  accesoriosCompatiblesVehiculo: AccesorioMovilidad[];
}

export type ValidarCompatibilidadAccesorioResultado = { ok: true } | { ok: false; error: string };

export function validarCompatibilidadAccesorio({
  accesoriosPaciente,
  accesoriosCompatiblesVehiculo,
}: ValidarCompatibilidadAccesorioInput): ValidarCompatibilidadAccesorioResultado {
  const incompatible = accesoriosPaciente.find(
    (accesorio) => !accesoriosCompatiblesVehiculo.includes(accesorio),
  );

  if (incompatible !== undefined) {
    return {
      ok: false,
      error: `El vehículo no soporta el accesorio de movilidad "${incompatible}" que requiere el paciente (RN-VE-01).`,
    };
  }

  return { ok: true };
}
