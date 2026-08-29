// Función pura (feedback de usuario, RN-HR-01/RN-VE-01/RN-VE-02): al crear un recorrido nuevo,
// sugiere recorridos de HOY compatibles (vehículo habilitado con lugar y accesorios OK, alguna
// parada con horario dentro de una ventana configurable) a los que el paciente podría sumarse en
// vez de armar uno desde cero. Devuelve una PROPUESTA — el operador decide si la usa o sigue
// creando un recorrido nuevo (mismo espíritu que sugerirOrdenPorCercania.ts, que ya implementa el
// mismo concepto de ventana horaria). Sin efectos de red ni localStorage.

import { capacidadDisponible } from './capacidadDisponible';
import { aMinutosDesdeMedianoche, VENTANA_BLOQUE_HORARIO_MINUTOS_DEFAULT } from './sugerirOrdenPorCercania';
import { validarCompatibilidadAccesorio } from './validarCompatibilidadAccesorio';
import type { PacienteResumen } from '../../types/paciente';
import type { Recorrido, Tramo } from '../../types/hojaDeRuta';
import type { Vehiculo } from '../../types/vehiculo';

export interface CandidatoRecorridoExistente {
  recorrido: Recorrido;
  vehiculo: Vehiculo;
}

/** Menor diferencia en minutos entre `minutos` y el horario de cualquier parada del recorrido
 *  (paradas sin horario o con formato inválido no participan). `undefined` si ninguna parada
 *  tiene horario válido. */
function menorDiferenciaMinutos(recorrido: Recorrido, minutos: number): number | undefined {
  return recorrido.paradas.reduce<number | undefined>((minima, parada) => {
    if (parada.horaEstimada === undefined) return minima;
    const minutosParada = aMinutosDesdeMedianoche(parada.horaEstimada);
    if (minutosParada === undefined) return minima;

    const diferencia = Math.abs(minutosParada - minutos);
    if (minima === undefined || diferencia < minima) return diferencia;
    return minima;
  }, undefined);
}

export function sugerirRecorridoExistente(
  recorridos: readonly Recorrido[],
  vehiculos: readonly Vehiculo[],
  paciente: PacienteResumen,
  tramo: Tramo,
  horaEstimada: string,
  ventanaMinutos: number = VENTANA_BLOQUE_HORARIO_MINUTOS_DEFAULT,
): CandidatoRecorridoExistente[] {
  if (horaEstimada === '') return [];

  const minutosNuevo = aMinutosDesdeMedianoche(horaEstimada);
  if (minutosNuevo === undefined) return [];

  const candidatos: Array<CandidatoRecorridoExistente & { diferencia: number }> = [];

  for (const recorrido of recorridos) {
    const vehiculo = vehiculos.find((v) => v.id === recorrido.vehiculoId);
    if (vehiculo === undefined || vehiculo.estado !== 'habilitado') continue;
    if (!capacidadDisponible(vehiculo, recorrido)) continue;
    if (recorrido.paradas.some((p) => p.pacienteId === paciente.id && p.tramo === tramo)) continue;

    const compatibilidad = validarCompatibilidadAccesorio({
      accesoriosPaciente: paciente.accesorioMovilidad,
      accesoriosCompatiblesVehiculo: vehiculo.accesoriosCompatibles,
    });
    if (!compatibilidad.ok) continue;

    const diferencia = menorDiferenciaMinutos(recorrido, minutosNuevo);
    if (diferencia === undefined || diferencia > ventanaMinutos) continue;

    candidatos.push({ recorrido, vehiculo, diferencia });
  }

  return candidatos.sort((a, b) => a.diferencia - b.diferencia).map(({ recorrido, vehiculo }) => ({ recorrido, vehiculo }));
}
