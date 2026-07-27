// Función pura (tasks.md 2.4, design.md Decisión 5/6): propone un orden de recogida por
// cercanía usando el algoritmo de vecino más cercano sobre distancia haversine, calculada sobre
// `coordenadaOrigen` (fixture en este prototipo — ver Decisión 6). Devuelve una PROPUESTA de
// reordenamiento; el operador es libre de reordenar a mano después (RN-HR-01) — esta función
// nunca impone la ruta, solo la sugiere. Sin efectos de red ni localStorage.
//
// TODO/config no bloqueante (RF-701, 10_preguntas_abiertas.md prioridad Media): el criterio de
// cercanía hoy es distancia en línea recta (haversine) sobre coordenadas fixture. El criterio
// real (distancia de manejo vía Routes API, ventanas horarias, etc.) se confirma con el cliente
// y debe quedar configurable, nunca hardcodeado como definitivo.

import type { Coordenada, ParadaRecorrido } from '../../types/hojaDeRuta';

const RADIO_TIERRA_KM = 6371;

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

export function sugerirOrdenPorCercania(
  paradas: readonly ParadaRecorrido[],
  origenReferencia?: Coordenada,
): ParadaRecorrido[] {
  const conCoordenada = paradas.filter(
    (p): p is ParadaRecorrido & { coordenadaOrigen: Coordenada } => p.coordenadaOrigen !== undefined,
  );
  const sinCoordenada = paradas.filter((p) => p.coordenadaOrigen === undefined);

  const pendientes = [...conCoordenada];
  const ordenadas: ParadaRecorrido[] = [];

  let posicionActual: Coordenada | undefined = origenReferencia;

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

  return [...ordenadas, ...sinCoordenada].map((parada, indice) => ({ ...parada, orden: indice }));
}
