import { useCallback, useEffect, useState } from 'react';
import type { ActualizacionPresupuesto, NuevoPresupuesto, Presupuesto } from '../../shared/types/presupuesto';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';

export interface UsePresupuestosResult {
  presupuestos: Presupuesto[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevoPresupuesto) => Promise<Presupuesto>;
  /**
   * Alta atómica de N presupuestos (presupuesto-prestaciones, tasks.md Fase 6/8, design.md D2/D4):
   * usada por la rama `por-prestacion` de `PresupuestoForm` vía `PresupuestoDetail`. Recarga la
   * lista igual que `crear`, una sola vez, con los N presupuestos ya confirmados.
   */
  crearLote: (datas: NuevoPresupuesto[]) => Promise<Presupuesto[]>;
  actualizar: (id: string, data: ActualizacionPresupuesto) => Promise<Presupuesto>;
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}

// Wiring de estado entre las pantallas de Presupuestos y un PresupuestoRepository (mock hoy,
// Supabase el día de mañana — ver PresupuestoRepository.ts). Mismo patrón que useVehiculos (FE-2):
// la carga inicial la dispara un efecto sobre un load imperativo (`cargar`), reutilizado tras
// cada mutación (tasks.md 4.1: "y recargue tras cada mutación").
export function usePresupuestos(repository: PresupuestoRepository): UsePresupuestosResult {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await repository.list();
      setPresupuestos(data);
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
    async (data: NuevoPresupuesto) => {
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

  const crearLote = useCallback(
    async (datas: NuevoPresupuesto[]) => {
      try {
        const creados = await repository.createLote(datas);
        await cargar();
        return creados;
      } catch (err) {
        setError(toErrorMessage(err));
        throw err;
      }
    },
    [repository, cargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionPresupuesto) => {
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

  return { presupuestos, loading, error, recargar: cargar, crear, crearLote, actualizar };
}
