// Función pura (tasks.md 2.4, design.md Decisión 5/6): propone un orden de recogida agrupando
// primero por bloque horario y ordenando por cercanía DENTRO de cada bloque (feedback de
// usuario, confirmado contra la hoja de ruta real de Andrea en papel: agrupa por horario y
// dentro de cada franja ordena por destino/cercanía — nunca al revés). Dos paradas caen en el
// mismo bloque si la diferencia entre sus `horaEstimada` no supera `ventanaBloqueHorarioMinutos`
// (encadenado: A-B y B-C dentro de ventana arma un solo bloque A-B-C aunque A-C la supere).
// Paradas sin `horaEstimada` (o con formato inválido — degrada, nunca lanza) quedan en su propio
// bloque al final. Devuelve una PROPUESTA de reordenamiento; el operador es libre de reordenar a
// mano después (RN-HR-01) — esta función nunca impone la ruta, solo la sugiere. Sin efectos de
// red ni localStorage.
//
// TODO/config no bloqueante (RF-701, 10_preguntas_abiertas.md prioridad Media): el criterio de
// cercanía hoy es distancia en línea recta (haversine) sobre coordenadas fixture, no distancia de
// manejo real (Routes API). Se confirma con el cliente y debe quedar configurable, nunca
// hardcodeado como definitivo — mismo criterio ya aplicado acá a `ventanaBloqueHorarioMinutos`.

import type { Coordenada, ParadaRecorrido } from '../../types/hojaDeRuta';

const RADIO_TIERRA_KM = 6371;

/** Default de la ventana de agrupamiento horario (RN-HR-01) — configurable vía parámetro,
 *  nunca hardcodeado como definitivo (mismo criterio que el resto de este módulo). Sin
 *  confirmación del cliente sobre el valor "correcto", 60 min sigue siendo una sugerencia
 *  editable por el operador, nunca una restricción dura. */
export const VENTANA_BLOQUE_HORARIO_MINUTOS_DEFAULT = 60;

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

/** Distancia haversine en km entre dos coordenadas. Pura y determinista. */
function distanciaHaversine(a: Coordenada, b: Coordenada): number {
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);
  const lat1 = aRadianes(a.lat);
  const lat2 = aRadianes(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return RADIO_TIERRA_KM * c;
}

/** Parsea "HH:mm" a minutos desde medianoche. Cualquier formato inesperado degrada a
 *  `undefined` (nunca lanza) — mismo contrato de degradación que `googleMapsClient.ts`. Exportada
 *  para reusarse en `sugerirRecorridoExistente.ts` (mismo concepto de ventana horaria, sin
 *  duplicar el parseo). */
export function aMinutosDesdeMedianoche(horaEstimada: string): number | undefined {
  const coincidencia = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(horaEstimada);
  if (coincidencia === null) return undefined;
  const [, horas, minutos] = coincidencia;
  return Number(horas) * 60 + Number(minutos);
}

/** Vecino más cercano (algoritmo original de esta función) acotado a un subconjunto de paradas
 *  — se reutiliza una vez por bloque horario. Devuelve también la posición final para encadenar
 *  el punto de partida del bloque siguiente. */
function ordenarSubconjuntoPorCercania(
  paradas: readonly ParadaRecorrido[],
  origen: Coordenada | undefined,
): { ordenadas: ParadaRecorrido[]; posicionFinal: Coordenada | undefined } {
  const conCoordenada = paradas.filter(
    (p): p is ParadaRecorrido & { coordenadaOrigen: Coordenada } => p.coordenadaOrigen !== undefined,
  );
  const sinCoordenada = paradas.filter((p) => p.coordenadaOrigen === undefined);

  const pendientes = [...conCoordenada];
  const ordenadas: ParadaRecorrido[] = [];

  let posicionActual: Coordenada | undefined = origen;

  while (pendientes.length > 0) {
    let indiceMasCercano = 0;

    if (posicionActual !== undefined) {
      let distanciaMinima = Number.POSITIVE_INFINITY;
      pendientes.forEach((candidata, indice) => {
        const distancia = distanciaHaversine(posicionActual as Coordenada, candidata.coordenadaOrigen);
        if (distancia < distanciaMinima) {
          distanciaMinima = distancia;
          indiceMasCercano = indice;
        }
      });
    }

    const [siguiente] = pendientes.splice(indiceMasCercano, 1);
    if (siguiente === undefined) break;

    ordenadas.push(siguiente);
    posicionActual = siguiente.coordenadaOrigen;
  }

  return { ordenadas: [...ordenadas, ...sinCoordenada], posicionFinal: posicionActual };
}

/** Agrupa las paradas con `horaEstimada` válida en bloques cronológicos: dos paradas
 *  consecutivas (ordenadas por horario) caen en el mismo bloque si su diferencia no supera
 *  `ventanaMinutos` — encadenado, así que A-B-C puede quedar en un solo bloque aunque A-C por sí
 *  sola supere la ventana. Paradas sin horario (o con formato inválido) van aparte. */
function agruparPorBloqueHorario(
  paradas: readonly ParadaRecorrido[],
  ventanaMinutos: number,
): { bloques: ParadaRecorrido[][]; sinHorario: ParadaRecorrido[] } {
  const conHorario: Array<{ parada: ParadaRecorrido; minutos: number }> = [];
  const sinHorario: ParadaRecorrido[] = [];

  paradas.forEach((p) => {
    const minutos = p.horaEstimada === undefined ? undefined : aMinutosDesdeMedianoche(p.horaEstimada);
    if (minutos === undefined) {
      sinHorario.push(p);
    } else {
      conHorario.push({ parada: p, minutos });
    }
  });

  const ordenadoPorHorario = [...conHorario].sort((x, y) => x.minutos - y.minutos);

  const bloques: ParadaRecorrido[][] = [];
  let bloqueActual: Array<{ parada: ParadaRecorrido; minutos: number }> = [];

  ordenadoPorHorario.forEach((actual) => {
    const anterior = bloqueActual.at(-1);
    if (anterior !== undefined && actual.minutos - anterior.minutos > ventanaMinutos) {
      bloques.push(bloqueActual.map((x) => x.parada));
      bloqueActual = [];
    }
    bloqueActual.push(actual);
  });
  if (bloqueActual.length > 0) bloques.push(bloqueActual.map((x) => x.parada));

  return { bloques, sinHorario };
}

export function sugerirOrdenPorCercania(
  paradas: readonly ParadaRecorrido[],
  origenReferencia?: Coordenada,
  ventanaBloqueHorarioMinutos: number = VENTANA_BLOQUE_HORARIO_MINUTOS_DEFAULT,
): ParadaRecorrido[] {
  const { bloques, sinHorario } = agruparPorBloqueHorario(paradas, ventanaBloqueHorarioMinutos);

  const resultado: ParadaRecorrido[] = [];
  let posicionActual = origenReferencia;

  for (const bloque of bloques) {
    const { ordenadas, posicionFinal } = ordenarSubconjuntoPorCercania(bloque, posicionActual);
    resultado.push(...ordenadas);
    posicionActual = posicionFinal;
  }

  if (sinHorario.length > 0) {
    const { ordenadas } = ordenarSubconjuntoPorCercania(sinHorario, posicionActual);
    resultado.push(...ordenadas);
  }

  return resultado.map((parada, indice) => ({ ...parada, orden: indice }));
}
