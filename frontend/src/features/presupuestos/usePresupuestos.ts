import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizacionPresupuesto, NuevoPresupuesto, Presupuesto } from '../../shared/types/presupuesto';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

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

// migracion-react-query, Fase 4 (dominio TRANSACCIONAL). **`UsePresupuestosResult` NO cambió.**
//
// No usa `useListaDeDominio` por `crearLote`, que es una tercera mutación. Se aplica igual el
// patrón de la Fase 2 (error de mutación en `useState` desde `onError`, para que llegue en el mismo
// render en que la promesa rechaza) y el de la Fase 3 (invalidar el PREFIJO del dominio).
//
// ⚠️ `FRESCURA.transaccional` es CERO: un presupuesto tiene vigencia y monto, y ambos cambian
// dentro de la sesión. Es el riesgo R2 del change.
export function usePresupuestos(repository: PresupuestoRepository): UsePresupuestosResult {
  const queryClient = useQueryClient();
  const [errorMutacion, setErrorMutacion] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: claves.presupuestos.lista(),
    queryFn: () => repository.list(),
    staleTime: FRESCURA.transaccional,
  });

  // Un presupuesto nuevo o editado cambia lo que puede autorizarse: se invalida también
  // autorizaciones (spec, "Una mutación que toca dos dominios invalida los dos").
  const invalidar = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: claves.presupuestos.todos() });
    await queryClient.invalidateQueries({ queryKey: claves.autorizaciones.todos() });
  }, [queryClient]);

  const comunes = {
    onMutate: () => setErrorMutacion(null),
    onError: (err: unknown) => setErrorMutacion(aMensaje(err)),
    onSuccess: invalidar,
  };

  const mutacionCrear = useMutation({ mutationFn: (d: NuevoPresupuesto) => repository.create(d), ...comunes });
  const mutacionCrearLote = useMutation({ mutationFn: (ds: NuevoPresupuesto[]) => repository.createLote(ds), ...comunes });
  const mutacionActualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: ActualizacionPresupuesto }) => repository.update(id, cambios),
    ...comunes,
  });

  return {
    presupuestos: data ?? [],
    loading: isPending,
    error: aMensaje(error) ?? errorMutacion,
    recargar: useCallback(async () => {
      await refetch();
    }, [refetch]),
    crear: useCallback((d: NuevoPresupuesto) => mutacionCrear.mutateAsync(d), [mutacionCrear]),
    crearLote: useCallback((ds: NuevoPresupuesto[]) => mutacionCrearLote.mutateAsync(ds), [mutacionCrearLote]),
    actualizar: useCallback(
      (id: string, cambios: ActualizacionPresupuesto) => mutacionActualizar.mutateAsync({ id, cambios }),
      [mutacionActualizar],
    ),
  };
}
