// Función pura (tasks.md 2.3, design.md Decisión 7): hay lugar si la cantidad de pasajeros del
// recorrido es menor que `vehiculo.capacidad`. Sin efectos de red ni localStorage.

import type { Vehiculo } from '../../types/vehiculo';
import type { Recorrido } from '../../types/hojaDeRuta';

export function capacidadDisponible(vehiculo: Vehiculo, recorrido: Recorrido): boolean {
  return recorrido.paradas.length < vehiculo.capacidad;
}
