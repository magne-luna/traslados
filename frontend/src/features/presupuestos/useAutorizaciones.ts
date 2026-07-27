import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionAutorizacion, Autorizacion, NuevaAutorizacion } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';

export interface UseAutorizacionesResult {
  autorizaciones: Autorizacion[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaAutorizacion) => Promise<Autorizacion>;
  actualizar: (id: string, data: ActualizacionAutorizacion) => Promise<Autorizacion>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Autorizaciones y un AutorizacionRepository (mock hoy,
// Supabase el día de mañana — ver AutorizacionRepository.ts). Mismo patrón que usePresupuestos.
export function useAutorizaciones(repository: AutorizacionRepository): UseAutorizacionesResult {
  const [autorizaciones, setAutorizaciones] = useState<Autorizacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.list();
      setAutorizaciones(data);
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
    async (data: NuevaAutorizacion) => {
      try {
        const creada = await repository.create(data);
        await cargar();
        return creada;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionAutorizacion) => {
      try {
        const actualizada = await repository.update(id, data);
        await cargar();
        return actualizada;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  return { autorizaciones, loading, error, recargar: cargar, crear, actualizar };
}
