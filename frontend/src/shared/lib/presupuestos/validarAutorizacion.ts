// Función pura (tasks.md 2.1, design.md Decisión 4): valida RN-PA-01 ("la autorización puede
// coincidir con el presupuesto o ser menor, nunca mayor"). Es un espejo en UI de la regla; el
// backend C-06 la re-valida. Sin efectos de red ni localStorage — testeable con valores fijos.

export interface ValidarAutorizacionInput {
  /** Ausente mientras la autorización no tiene monto asignado (ej. estado pendiente). */
  montoAutorizado?: number;
  montoPresupuesto: number;
}

export type ValidarAutorizacionResultado = { ok: true } | { ok: false; error: string };

export function validarAutorizacion({
  montoAutorizado,
  montoPresupuesto,
}: ValidarAutorizacionInput): ValidarAutorizacionResultado {
  if (montoAutorizado !== undefined && montoAutorizado > montoPresupuesto) {
    return {
      ok: false,
      error: `El monto autorizado (${montoAutorizado}) no puede ser mayor al monto del presupuesto (${montoPresupuesto}) (RN-PA-01).`,
    };
  }

  return { ok: true };
}
