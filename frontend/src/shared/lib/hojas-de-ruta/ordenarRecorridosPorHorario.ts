// Función pura: ordena los recorridos del día por su horario más temprano (la `horaEstimada`
// más chica entre sus paradas), no por el orden en que se cargaron. Recorridos sin ninguna
// `horaEstimada` cargada quedan al final, en el orden relativo en que venían (RN-HR-03: un
// recorrido manual puede no tener horario fijo).

import type { Recorrido } from '../../types/hojaDeRuta';

function horarioMasTemprano(recorrido: Recorrido): string | undefined {
  return recorrido.paradas.reduce<string | undefined>((minimo, parada) => {
    if (!parada.horaEstimada) return minimo;
    if (minimo === undefined || parada.horaEstimada < minimo) return parada.horaEstimada;
    return minimo;
  }, undefined);
}

export function ordenarRecorridosPorHorario(recorridos: readonly Recorrido[]): Recorrido[] {
  return [...recorridos].sort((a, b) => {
    const horaA = horarioMasTemprano(a);
    const horaB = horarioMasTemprano(b);
    if (horaA === undefined && horaB === undefined) return 0;
    if (horaA === undefined) return 1;
    if (horaB === undefined) return -1;
    return horaA.localeCompare(horaB);
  });
}
