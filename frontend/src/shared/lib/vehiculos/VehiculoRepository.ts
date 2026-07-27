import type { ActualizacionVehiculo, NuevoVehiculo, Vehiculo } from '../../types/vehiculo';

// Contrato de datos (ver design.md de vehiculos-ui, Decisión 7). Las pantallas de la feature
// consumen esta interfaz, nunca Supabase directamente. Cuando C-08 (vehiculos-mantenimiento) se
// archive en el backend, se escribe un SupabaseVehiculoRepository que cumpla este mismo
// contrato y se inyecta en el punto de composición — los componentes no cambian.
export interface VehiculoRepository {
  list(): Promise<Vehiculo[]>;
  /** Resuelve `null` si no existe un vehículo con ese id (no lanza excepción). */
  getById(id: string): Promise<Vehiculo | null>;
  create(data: NuevoVehiculo): Promise<Vehiculo>;
  update(id: string, data: ActualizacionVehiculo): Promise<Vehiculo>;
}
