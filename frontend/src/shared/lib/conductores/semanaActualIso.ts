// Función pura (tasks.md 2.1, design.md Decisión 4 y Risks/Trade-offs): deriva la etiqueta
// ISO-8601 de semana a partir de una fecha de referencia recibida como parámetro (nunca un
// `new Date()` incrustado), para que sea trivialmente testeable con valores fijos.

const MS_POR_DIA = 86_400_000;

/** Deriva la etiqueta ISO-8601 de semana ('YYYY-Www', lunes como inicio de semana) de `ahora`. */
export function semanaActualIso(ahora: Date): string {
  const fecha = new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
  // ISO-8601: la semana empieza el lunes; el jueves de esa semana determina a qué año pertenece.
  const diaIso = fecha.getUTCDay() || 7;
  fecha.setUTCDate(fecha.getUTCDate() + 4 - diaIso);

  const inicioDeAnio = new Date(Date.UTC(fecha.getUTCFullYear(), 0, 1));
  const numeroDeSemana = Math.ceil(((fecha.getTime() - inicioDeAnio.getTime()) / MS_POR_DIA + 1) / 7);

  return `${fecha.getUTCFullYear()}-W${String(numeroDeSemana).padStart(2, '0')}`;
}
