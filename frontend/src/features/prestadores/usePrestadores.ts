import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionPrestador, NuevoPrestador, Prestador } from '../../shared/types/prestador';
import type { PrestadorRepository } from '../../shared/lib/prestadores/PrestadorRepository';

export interface UsePrestadoresResult {
  prestadores: Prestador[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevoPrestador) => Promise<Prestador>;
  actualizar: (id: string, data: ActualizacionPrestador) => Promise<Prestador>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Prestadores y un PrestadorRepository (design.md D1 de
// prestadores-crud, espejo 1:1 de useObrasSociales.ts): la carga inicial la dispara un efecto
// sobre un load imperativo (`cargar`), reutilizado tras cada mutación. Sin test dedicado
// (tasks.md 4.2) — se ejercita indirectamente por el smoke test de PrestadorDetail/PrestadorForm.
export function usePrestadores(repository: PrestadorRepository): UsePrestadoresResult {
  const [prestadores, setPrestadores] = useState<Prestador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.list();
      setPrestadores(data);
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
    async (data: NuevoPrestador) => {
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
    async (id: string, data: ActualizacionPrestador) => {
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

  return { prestadores, loading, error, recargar: cargar, crear, actualizar };
}
