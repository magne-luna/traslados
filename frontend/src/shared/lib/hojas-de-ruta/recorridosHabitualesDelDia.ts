// Funciones puras del selector "Destino habitual" de Hojas de Ruta (feedback de usuario): al
// armar un recorrido, cruzan la FECHA de la hoja del día con el `diaSemana` de los
// `RecorridoHabitual` del paciente (RF-110, `pacientes.recorridos`) para ofrecer PRIMERO los que
// corresponden a ese día — sin esconder los demás, porque un traslado excepcional un jueves con
// el destino habitual de los martes es un caso real del negocio. Nunca automático: el operador
// elige (mismo espíritu que sugerirRecorridoExistente.ts). Sin efectos de red ni localStorage.
//
// Ojo: esto NO convierte un `RecorridoHabitual` en una `ParadaRecorrido` — solo los ordena. La
// copia de campos vive en `paradaDesdeRecorridoHabitual.ts`, y sigue siendo copy-on-create: la
// parada queda desligada del habitual de origen (mismo criterio que "Traer de los destinos
// habituales" de PresupuestoForm).

import type { DiaSemana, RecorridoHabitual } from '../../types/recorridoHabitual';

// Índice de `Date.getDay()` (0 = domingo) -> DiaSemana. No se reusa `DIA_SEMANA_OPTIONS`
// (features/pacientes/diaSemanaOptions.ts) a propósito: shared/lib no importa de features, y ese
// mapeo es de etiquetas de UI, no de posición en la semana.
const DIA_POR_INDICE_JS: readonly DiaSemana[] = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
];

// Orden de presentación de la semana (lunes primero, como el calendario del negocio) — distinto
// del índice de `Date.getDay()`, que arranca en domingo.
const ORDEN_SEMANA: readonly DiaSemana[] = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

const FECHA_ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Día de la semana de una fecha ISO `YYYY-MM-DD`, o `undefined` si la cadena no lo es.
 *
 * Se parsea a mano en vez de `new Date(iso)`: ese constructor interpreta la cadena como
 * medianoche UTC y `.getDay()` la lee en hora LOCAL — en Argentina (UTC-3) eso devuelve el día
 * anterior. La fecha de una hoja de ruta es un día calendario, no un instante, así que se
 * construye con el constructor local (`new Date(año, mes, día)`), que no tiene esa deriva.
 */
export function diaSemanaDeFechaIso(fechaIso: string): DiaSemana | undefined {
  const match = FECHA_ISO.exec(fechaIso);
  if (match === null) return undefined;

  // `match[1..3]` existen por construcción del regex, pero `noUncheckedIndexedAccess` no lo sabe:
  // se leen por índice y se normalizan acá en vez de silenciarlo con un `!`.
  const anio = Number(match[1]);
  const mes = Number(match[2]);
  const dia = Number(match[3]);
  const fecha = new Date(anio, mes - 1, dia);
  // Rechaza fechas imposibles ('2026-13-40'), que el constructor "desborda" al mes siguiente en
  // vez de fallar.
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) {
    return undefined;
  }

  return DIA_POR_INDICE_JS[fecha.getDay()];
}

export interface RecorridosHabitualesAgrupados {
  /** Día de la semana de la fecha de la hoja; `undefined` si la fecha no es válida. */
  diaDeLaFecha: DiaSemana | undefined;
  /** Habituales que caen en `diaDeLaFecha`, por hora ascendente. */
  delDia: RecorridoHabitual[];
  /** El resto, por orden de semana (lunes primero) y después por hora. */
  otrosDias: RecorridoHabitual[];
}

function porHora(a: RecorridoHabitual, b: RecorridoHabitual): number {
  return a.hora.localeCompare(b.hora);
}

function porDiaYHora(a: RecorridoHabitual, b: RecorridoHabitual): number {
  const diferenciaDia = ORDEN_SEMANA.indexOf(a.diaSemana) - ORDEN_SEMANA.indexOf(b.diaSemana);
  return diferenciaDia !== 0 ? diferenciaDia : porHora(a, b);
}

/**
 * Agrupa los destinos habituales de un paciente contra la fecha de la hoja de ruta. Sin fecha
 * válida no hay día contra el cual comparar: todo cae en `otrosDias`, en el orden recibido, en
 * vez de inventar un agrupamiento arbitrario.
 */
export function agruparRecorridosHabitualesPorDia(
  recorridos: readonly RecorridoHabitual[],
  fechaIso: string,
): RecorridosHabitualesAgrupados {
  const diaDeLaFecha = diaSemanaDeFechaIso(fechaIso);
  if (diaDeLaFecha === undefined) {
    return { diaDeLaFecha: undefined, delDia: [], otrosDias: [...recorridos] };
  }

  const delDia = recorridos.filter((r) => r.diaSemana === diaDeLaFecha).sort(porHora);
  const otrosDias = recorridos.filter((r) => r.diaSemana !== diaDeLaFecha).sort(porDiaYHora);

  return { diaDeLaFecha, delDia, otrosDias };
}
