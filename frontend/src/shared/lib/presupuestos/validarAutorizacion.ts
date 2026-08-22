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

// -------------------------------------------------------------------------------------------
// validarVigenciaAutorizacion (presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 8.6,
// design.md D1, spec presupuesto-vigencia "La autorización puede recortar el período pedido"):
// regla candidata distinta de RN-PA-01 (monto) — el período AUTORIZADO debe estar CONTENIDO en
// el período PEDIDO, no solo no superar un único número. Se valida en la capa de aplicación
// (design.md D1: "MUST resolverse en la capa de aplicación y MUST NOT agregarse como trigger
// nuevo en la base"), la base solo repite el CHECK de fila (`hasta >= desde`) de cada tabla por
// separado. Función pura y aparte de `validarAutorizacion` (no se le agregan parámetros): son dos
// reglas con desenlaces y mensajes distintos, y unificarlas en una sola firma mezclaría RN-PA-01
// (monto) con esta regla de vigencia — el spec pide explícitamente que el mensaje distinga los
// dos casos.
// -------------------------------------------------------------------------------------------

export interface ValidarVigenciaAutorizacionInput {
  /** Ausente mientras la autorización no tiene vigencia cargada (ISO date). */
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  /** Vigencia pedida en el presupuesto asociado (ISO date). Ausente si el presupuesto tampoco la
   * cargó — en ese caso no hay contra qué comparar y esta regla no aplica (D1: "cuando ambos
   * lados estén cargados"). */
  presupuestoVigenciaDesde?: string;
  presupuestoVigenciaHasta?: string;
}

/** El período autorizado ⊆ el período pedido: `vigenciaDesde >= presupuestoVigenciaDesde` y
 * `vigenciaHasta <= presupuestoVigenciaHasta`, cada comparación solo cuando ambos lados de ESE
 * borde están cargados — no exige que los cuatro valores estén presentes a la vez, porque la
 * obra social puede recortar un solo extremo del período (ej. solo `vigenciaHasta`, RN-PA-02
 * sigue permitiendo un `vigenciaDesde` retroactivo independiente de esto). */
export function validarVigenciaAutorizacion({
  vigenciaDesde,
  vigenciaHasta,
  presupuestoVigenciaDesde,
  presupuestoVigenciaHasta,
}: ValidarVigenciaAutorizacionInput): ValidarAutorizacionResultado {
  if (vigenciaDesde !== undefined && presupuestoVigenciaDesde !== undefined && vigenciaDesde < presupuestoVigenciaDesde) {
    return {
      ok: false,
      error: `El período autorizado no puede empezar antes del período pedido (pedido desde ${presupuestoVigenciaDesde}, autorizado desde ${vigenciaDesde}).`,
    };
  }

  if (vigenciaHasta !== undefined && presupuestoVigenciaHasta !== undefined && vigenciaHasta > presupuestoVigenciaHasta) {
    return {
      ok: false,
      error: `El período autorizado no puede exceder el período pedido (pedido hasta ${presupuestoVigenciaHasta}, autorizado hasta ${vigenciaHasta}).`,
    };
  }

  return { ok: true };
}
