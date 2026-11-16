import type { Vehiculo } from '../../types/vehiculo';

// Orden del listado de Vehículos (pedido del usuario): habilitados primero, fuera de servicio
// debajo, y cada grupo por patente en orden alfabético. Pura y sin mutar la entrada.
export function ordenarVehiculos<T extends Pick<Vehiculo, 'patente' | 'estado'>>(vehiculos: readonly T[]): T[] {
  return [...vehiculos].sort((a, b) => {
    const grupoA = a.estado === 'fuera-de-servicio' ? 1 : 0;
    const grupoB = b.estado === 'fuera-de-servicio' ? 1 : 0;
    if (grupoA !== grupoB) return grupoA - grupoB;
    return a.patente.localeCompare(b.patente, 'es', { sensitivity: 'base', numeric: true });
  });
}
