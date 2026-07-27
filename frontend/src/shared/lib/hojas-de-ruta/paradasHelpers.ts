// Funciones puras (tasks.md 7.1, RF-702): agregar/quitar una parada de un recorrido con
// reacomodo consistente del `orden` de las paradas restantes. Sin efectos de red ni
// localStorage — quien llama persiste el resultado vía `update()` del agregado `HojaDeRuta`.

import type { ParadaRecorrido } from '../../types/hojaDeRuta';

function renumerar(paradas: ParadaRecorrido[]): ParadaRecorrido[] {
  return paradas.map((parada, indice) => ({ ...parada, orden: indice }));
}

/** Quita la parada con `paradaId` y reacomoda el `orden` de las restantes (0..n-1). */
export function quitarParada(paradas: readonly ParadaRecorrido[], paradaId: string): ParadaRecorrido[] {
  return renumerar(paradas.filter((parada) => parada.id !== paradaId));
}

/** Agrega `nuevaParada` al final y reacomoda el `orden` de todas las paradas (0..n-1). */
export function agregarParada(
  paradas: readonly ParadaRecorrido[],
  nuevaParada: ParadaRecorrido,
): ParadaRecorrido[] {
  return renumerar([...paradas, nuevaParada]);
}
