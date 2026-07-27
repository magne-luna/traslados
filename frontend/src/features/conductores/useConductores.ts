import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionConductor, Conductor, NuevoConductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';

export interface UseConductoresResult {
  conductores: Conductor[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevoConductor) => Promise<Conductor>;
  actualizar: (id: string, data: ActualizacionConductor) => Promise<Conductor>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Conductores y un ConductorRepository (mock hoy,
// Supabase el día de mañana — ver ConductorRepository.ts). Mismo patrón que useVehiculos
// (tasks.md 4.1): la carga inicial la dispara un efecto sobre un load imperativo (`cargar`), y
// ese mismo load imperativo se reutiliza tras cada mutación.
export function useConductores(repository: ConductorRepository): UseConductoresResult {
  const [conductores, setConductores] = useState<Conductor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.list();
      setConductores(data);
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
    async (data: NuevoConductor) => {
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
    async (id: string, data: ActualizacionConductor) => {
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

  return { conductores, loading, error, recargar: cargar, crear, actualizar };
}
