import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionVehiculo, NuevoVehiculo, Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';

export interface UseVehiculosResult {
  vehiculos: Vehiculo[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevoVehiculo) => Promise<Vehiculo>;
  actualizar: (id: string, data: ActualizacionVehiculo) => Promise<Vehiculo>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Vehículos y un VehiculoRepository (mock hoy, Supabase
// el día de mañana — ver VehiculoRepository.ts). Mismo patrón que useObrasSociales (FE-2): la
// carga inicial la dispara un efecto sobre un load imperativo (`cargar`), y ese mismo load
// imperativo se reutiliza tras cada mutación (tasks.md 4.1: "y recargue tras cada mutación").
export function useVehiculos(repository: VehiculoRepository): UseVehiculosResult {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.list();
      setVehiculos(data);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const crear = useCallback(
    async (data: NuevoVehiculo) => {
      try {
        const creado = await repository.create(data);
        await cargar();
        return creado;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionVehiculo) => {
      try {
        const actualizado = await repository.update(id, data);
        await cargar();
        return actualizado;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  return { vehiculos, loading, error, recargar: cargar, crear, actualizar };
}
