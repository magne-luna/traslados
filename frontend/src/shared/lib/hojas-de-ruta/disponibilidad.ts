// Funciones puras (tasks.md 2.2, design.md Decisión 7): RN-VE-02 — un vehículo/conductor fuera
// de servicio queda excluido de la hoja de ruta. Sin efectos de red ni localStorage.

import type { Vehiculo } from '../../types/vehiculo';
import type { Conductor } from '../../types/conductor';

export function vehiculosDisponibles(vehiculos: Vehiculo[]): Vehiculo[] {
  return vehiculos.filter((vehiculo) => vehiculo.estado === 'habilitado');
}

export function conductoresDisponibles(conductores: Conductor[]): Conductor[] {
  return conductores.filter((conductor) => conductor.estado === 'operando');
}
