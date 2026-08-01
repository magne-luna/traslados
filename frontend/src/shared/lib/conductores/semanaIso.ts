// Módulo aritmético puro (tasks.md §6.1, design.md D7): conversión bidireccional entre la
// etiqueta ISO-8601 de semana (`'2026-W30'`) y el par de fechas `(fecha_init, fecha_fin_semana)`
// que persiste `conductores.conductores_vehiculos`. Sin nada de Postgres, sin red, sin lectura de
// reloj global (nunca `new Date()` sin argumento) y sin depender de la zona horaria del entorno
// donde corre: todo el trabajo se hace en UTC internamente para evitar el corrimiento de
// `new Date('2026-07-27')` (que Node interpreta como UTC medianoche y en Argentina, UTC-3, se ve
// como el día anterior).

const MS_POR_DIA = 86_400_000;

export interface RangoSemana {
  /** Lunes de la semana, `YYYY-MM-DD`. */
  desde: string;
  /** Domingo de la semana, `YYYY-MM-DD`. */
  hasta: string;
}

/** Parsea un `DATE` de Postgres (`'YYYY-MM-DD'`) a un objeto `Date` en UTC medianoche,
 * componiendo año/mes/día explícitamente. Nunca `new Date(stringISO)`: esa forma interpreta el
 * string como UTC y, al leer los componentes locales en una zona con offset negativo (Argentina,
 * UTC-3), devuelve el día anterior. Componer los números a mano evita el parser de fechas del
 * motor de JS por completo. */
function parseFechaLocal(fecha: string): Date {
  const partes = fecha.split('-');
  const anio = Number(partes[0] ?? NaN);
  const mes = Number(partes[1] ?? NaN);
  const dia = Number(partes[2] ?? NaN);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

function formatFecha(fecha: Date): string {
  return fecha.toISOString().slice(0, 10);
}

/** Lunes (día ISO 1) de la semana UTC que contiene `fecha`. */
function lunesDeLaSemana(fecha: Date): Date {
  const diaIso = fecha.getUTCDay() || 7; // domingo (0) -> 7
  const lunes = new Date(fecha);
  lunes.setUTCDate(fecha.getUTCDate() - diaIso + 1);
  return lunes;
}

/** Jueves de la semana que contiene `fecha` — determina a qué año ISO pertenece la semana. */
function juevesDeLaSemana(fecha: Date): Date {
  const lunes = lunesDeLaSemana(fecha);
  const jueves = new Date(lunes);
  jueves.setUTCDate(lunes.getUTCDate() + 3);
  return jueves;
}

function parseEtiquetaSemana(semana: string): { anio: number; numero: number } {
  const match = /^(\d{4})-W(\d{2})$/.exec(semana);
  if (match === null) {
    throw new Error(`Etiqueta de semana ISO inválida: «${semana}».`);
  }
  return { anio: Number(match[1]), numero: Number(match[2]) };
}

/** `semanaIsoADesdeHasta('2026-W30')` -> `{ desde: '2026-07-20', hasta: '2026-07-26' }`.
 *
 * La semana 1 ISO de un año es la que contiene el primer jueves de enero (no necesariamente el 1
 * de enero): se ancla en el 4 de enero, que siempre cae dentro de la semana 1 por definición de
 * la norma, y se deriva su lunes. Las semanas siguientes son múltiplos de 7 días desde ese lunes
 * — así los años de 53 semanas y los cruces de fin de año salen gratis, sin lógica especial. */
export function semanaIsoADesdeHasta(semana: string): RangoSemana {
  const { anio, numero } = parseEtiquetaSemana(semana);

  const cuatroDeEnero = new Date(Date.UTC(anio, 0, 4));
  const lunesSemana1 = lunesDeLaSemana(cuatroDeEnero);

  const desde = new Date(lunesSemana1);
  desde.setUTCDate(lunesSemana1.getUTCDate() + (numero - 1) * 7);

  const hasta = new Date(desde);
  hasta.setUTCDate(desde.getUTCDate() + 6);

  return { desde: formatFecha(desde), hasta: formatFecha(hasta) };
}

/** `desdeHastaASemanaIso(init, fin)` -> la etiqueta ISO de la semana que **contiene** `init`.
 * `fin` no se usa para derivar el resultado (ver design.md D7 §Degradación): una fila incoherente
 * cuyo `fecha_init` no cae en lunes no se descarta ni se "corrige" contra `fecha_fin_semana` — se
 * deriva directamente la semana que contiene `fecha_init`, que es la única fuente de verdad de
 * esta función. Recibe `fin` en la firma porque así lo pide el contrato (`conductor-asignacion-
 * semanal` §Requirement), aunque no participe del cálculo. */
export function desdeHastaASemanaIso(init: string, _fin: string): string {
  const fecha = parseFechaLocal(init);
  const jueves = juevesDeLaSemana(fecha);
  const anioIso = jueves.getUTCFullYear();

  const cuatroDeEnero = new Date(Date.UTC(anioIso, 0, 4));
  const lunesSemana1 = lunesDeLaSemana(cuatroDeEnero);

  const lunesDeFecha = lunesDeLaSemana(fecha);
  const numero = Math.round((lunesDeFecha.getTime() - lunesSemana1.getTime()) / (7 * MS_POR_DIA)) + 1;

  return `${anioIso}-W${String(numero).padStart(2, '0')}`;
}
