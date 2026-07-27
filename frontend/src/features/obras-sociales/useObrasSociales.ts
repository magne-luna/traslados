import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';

export interface UseObrasSocialesResult {
  obrasSociales: ObraSocial[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaObraSocial) => Promise<ObraSocial>;
  actualizar: (id: string, data: ActualizacionObraSocial) => Promise<ObraSocial>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Obras Sociales y un ObraSocialRepository (mock hoy,
// Supabase el día de mañana — ver ObraSocialRepository.ts). Mismo patrón que
// useDocumentChecklist (FE-1): la carga inicial la dispara un efecto sobre un load imperativo
// (`cargar`), y ese mismo load imperativo se reutiliza tras cada mutación (tasks.md 3.1: "y
// recargue tras cada mutación").
export function useObrasSociales(repository: ObraSocialRepository): UseObrasSocialesResult {
  const [obrasSociales, setObrasSociales] = useState<ObraSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.list();
      setObrasSociales(data);
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
    async (data: NuevaObraSocial) => {
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
    async (id: string, data: ActualizacionObraSocial) => {
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

  return { obrasSociales, loading, error, recargar: cargar, crear, actualizar };
}
