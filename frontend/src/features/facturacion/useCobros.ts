import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Cobro, NuevoCobro } from '../../shared/types/factura';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseCobrosResult {
  cobros: Cobro[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  registrar: (data: NuevoCobro) => Promise<Cobro>;
  eliminar: (id: string) => Promise<void>;
}

// migracion-react-query, Fase 4 (dominio TRANSACCIONAL). **`UseCobrosResult` NO cambió.**
//
// No usa `useListaDeDominio` porque sus mutaciones no son `crear`/`actualizar`: son `registrar` y
// `eliminar`, y `eliminar` no devuelve entidad. Se aplica igual el patrón de la Fase 2 (error de
// mutación en `useState` desde `onError`, para que llegue en el mismo render en que la promesa
// rechaza) y el de la Fase 3 (invalidar el PREFIJO del dominio).
//
// ⚠️ `FRESCURA.transaccional` es CERO. Un cobro es dinero cobrado: servirlo desde memoria le
// mostraría a la usuaria un saldo que ya no es. Es el riesgo R2 del change.
export function useCobros(repository: CobroRepository, facturaId: string): UseCobrosResult {
  const queryClient = useQueryClient();
  const [errorMutacion, setErrorMutacion] = useState<string | null>(null);

  // `facturaId` vacío = alta de una factura nueva (todavía sin id): no hay cobros que traer y
  // `listByFactura('')` pega contra PostgREST como `facturas_id=eq.` → 400. `enabled` corta esa
  // consulta; `isPending` sigue siendo `true` con la query deshabilitada, así que abajo se
  // normaliza a `loading: false` cuando no hay `facturaId`.
  const habilitada = facturaId !== '';
  const { data, isPending, error, refetch } = useQuery({
    queryKey: claves.cobros.deFactura(facturaId),
    queryFn: () => repository.listByFactura(facturaId),
    enabled: habilitada,
    staleTime: FRESCURA.transaccional,
  });

  // Registrar o eliminar un cobro cambia el saldo de una factura: se invalida también facturas.
  const invalidar = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: claves.cobros.todos() });
    await queryClient.invalidateQueries({ queryKey: claves.facturas.todos() });
  }, [queryClient]);

  const mutacionRegistrar = useMutation({
    mutationFn: (nuevo: NuevoCobro) => repository.create(nuevo),
    onMutate: () => setErrorMutacion(null),
    onError: (err: unknown) => setErrorMutacion(aMensaje(err)),
    onSuccess: invalidar,
  });

  const mutacionEliminar = useMutation({
    mutationFn: (id: string) => repository.remove(id),
    onMutate: () => setErrorMutacion(null),
    onError: (err: unknown) => setErrorMutacion(aMensaje(err)),
    onSuccess: invalidar,
  });

  return {
    cobros: data ?? [],
    loading: habilitada && isPending,
    error: aMensaje(error) ?? errorMutacion,
    recargar: useCallback(async () => {
      await refetch();
    }, [refetch]),
    registrar: useCallback((nuevo: NuevoCobro) => mutacionRegistrar.mutateAsync(nuevo), [mutacionRegistrar]),
    eliminar: useCallback(async (id: string) => {
      await mutacionEliminar.mutateAsync(id);
    }, [mutacionEliminar]),
  };
}
