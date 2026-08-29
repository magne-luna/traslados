import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aMensaje } from './aMensaje';

// Patrón compartido de los dominios que exponen "el universo completo + crear + actualizar"
// (pacientes, vehículos, conductores, obras sociales). Los cuatro hooks eran, línea por línea, el
// mismo `useState` + `useEffect` + `repository.list()`; ahora son el mismo `useQuery` + dos
// `useMutation`. Extraerlo NO es cosmética: concentra en un solo lugar los dos detalles que se
// copian mal, y que ya costaron un bug real en la Fase 2.
//
// ⚠️ Detalle 1 — el error de mutación va a `useState`, seteado en `onError`, NO se lee de
// `mutacion.error`. Medido el 2026-08-29: el estado de error de `useMutation` commitea UN TICK
// DESPUÉS de que `mutateAsync` rechaza. La implementación anterior lo seteaba sincrónicamente en el
// `catch` antes de relanzar, así que una pantalla que renderiza el error justo después de
// `await crear()` lo veía en el mismo render. `onError` corre ANTES de que la promesa rechace, y es
// lo único que preserva ese timing.
//
// ⚠️ Detalle 2 — `loading` sale de `isPending`, NUNCA de `isFetching`. `isFetching` también es
// `true` durante una revalidación en background, y eso devolvería el parpadeo que el change vino a
// eliminar (spec, "Revalidación en segundo plano sin estado de carga").
//
// La invalidación apunta al PREFIJO del dominio, no a la clave de la lista: así alcanza también a
// las páginas de `listPage` sin tener que enumerarlas (R1).

export interface ParametrosListaDeDominio<T, Nuevo, Actualizacion> {
  /** Prefijo del dominio, p. ej. `claves.vehiculos.todos()`. Es el objetivo de la invalidación. */
  claveDominio: readonly unknown[];
  /** Clave de la lista completa, p. ej. `claves.vehiculos.lista()`. */
  claveLista: readonly unknown[];
  /** Lectura del universo completo (`repository.list()`). */
  cargar: () => Promise<T[]>;
  crear: (data: Nuevo) => Promise<T>;
  actualizar: (id: string, data: Actualizacion) => Promise<T>;
  /** Plazo de frescura del dominio. Se declara acá, por query: gana sobre el default del cliente. */
  frescuraMs: number;
}

export interface ResultadoListaDeDominio<T, Nuevo, Actualizacion> {
  datos: T[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: Nuevo) => Promise<T>;
  actualizar: (id: string, data: Actualizacion) => Promise<T>;
}

export function useListaDeDominio<T, Nuevo, Actualizacion>({
  claveDominio,
  claveLista,
  cargar,
  crear,
  actualizar,
  frescuraMs,
}: ParametrosListaDeDominio<T, Nuevo, Actualizacion>): ResultadoListaDeDominio<T, Nuevo, Actualizacion> {
  const queryClient = useQueryClient();
  const [errorMutacion, setErrorMutacion] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: claveLista,
    queryFn: cargar,
    staleTime: frescuraMs,
  });

  const invalidarDominio = useCallback(
    () => queryClient.invalidateQueries({ queryKey: claveDominio }),
    // `claveDominio` es un literal nuevo en cada render; se compara por contenido, no por identidad.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, JSON.stringify(claveDominio)],
  );

  const mutacionCrear = useMutation({
    mutationFn: crear,
    onMutate: () => setErrorMutacion(null),
    onError: (err: unknown) => setErrorMutacion(aMensaje(err)),
    onSuccess: invalidarDominio,
  });

  const mutacionActualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Actualizacion }) => actualizar(id, cambios),
    onMutate: () => setErrorMutacion(null),
    onError: (err: unknown) => setErrorMutacion(aMensaje(err)),
    onSuccess: invalidarDominio,
  });

  return {
    datos: data ?? [],
    loading: isPending,
    error: aMensaje(error) ?? errorMutacion,
    recargar: useCallback(async () => {
      await refetch();
    }, [refetch]),
    // `mutateAsync` (no `mutate`) para que el rechazo llegue al formulario, como antes.
    crear: useCallback((nuevo: Nuevo) => mutacionCrear.mutateAsync(nuevo), [mutacionCrear]),
    actualizar: useCallback(
      (id: string, cambios: Actualizacion) => mutacionActualizar.mutateAsync({ id, cambios }),
      [mutacionActualizar],
    ),
  };
}
