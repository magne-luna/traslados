// Función pura (feedback de usuario, RN-HR-02): ida y vuelta son tramos independientes y pueden
// convivir en el mismo recorrido — la spec dashboard-recorridos-del-dia y
// resumenDelDia.test.ts ya dan por hecho ese caso ("un mismo paciente aparece en la parada de
// ida y en la de vuelta del mismo recorrido"). Un paciente sigue disponible para agregar
// mientras le falte al menos un tramo; solo queda afuera cuando ya tiene los dos.

import type { ParadaRecorrido } from '../../types/hojaDeRuta';

export function pacienteDisponibleEnRecorrido(paradas: readonly ParadaRecorrido[], pacienteId: string): boolean {
  const tramosUsados = new Set(paradas.filter((parada) => parada.pacienteId === pacienteId).map((parada) => parada.tramo));
  return tramosUsados.size < 2;
}
