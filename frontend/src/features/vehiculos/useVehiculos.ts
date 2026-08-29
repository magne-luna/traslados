import type { ActualizacionVehiculo, NuevoVehiculo, Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';
import { useListaDeDominio } from '../../shared/lib/query/useListaDeDominio';

export interface UseVehiculosResult {
  vehiculos: Vehiculo[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevoVehiculo) => Promise<Vehiculo>;
  actualizar: (id: string, data: ActualizacionVehiculo) => Promise<Vehiculo>;
}

// Wiring de estado entre las pantallas de Vehículos y un VehiculoRepository.
//
// migracion-react-query, Fase 3: el cuerpo delega en `useListaDeDominio` (el patrón compartido de
// los cuatro dominios de referencia). **`UseVehiculosResult` NO cambió** — solo se renombra `datos`
// a `vehiculos`, que es el nombre que las pantallas ya usan.
export function useVehiculos(repository: VehiculoRepository): UseVehiculosResult {
  const { datos, ...resto } = useListaDeDominio<Vehiculo, NuevoVehiculo, ActualizacionVehiculo>({
    claveDominio: claves.vehiculos.todos(),
    claveLista: claves.vehiculos.lista(),
    cargar: () => repository.list(),
    crear: (data) => repository.create(data),
    actualizar: (id, data) => repository.update(id, data),
    frescuraMs: FRESCURA.referencia,
  });

  return { vehiculos: datos, ...resto };
}
