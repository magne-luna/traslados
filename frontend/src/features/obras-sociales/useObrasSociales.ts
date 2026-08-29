import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseObrasSocialesResult {
  obrasSociales: ObraSocial[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaObraSocial) => Promise<ObraSocial>;
  actualizar: (id: string, data: ActualizacionObraSocial) => Promise<ObraSocial>;
}

// Wiring de estado entre las pantallas de Obras Sociales y un ObraSocialRepository.
//
// migracion-react-query, Fase 2 (piloto): el cuerpo pasó de `useState` + `useEffect` a React Query.
// **`UseObrasSocialesResult` NO cambió** (design.md §D6) — misma forma, mismos nombres, mismos
// tipos —, así que ninguna pantalla ni ningún test de componente se tocó.
//
// El repository sigue llegando por parámetro: React Query NO reemplaza la inyección de
// dependencias, solo el estado. El `queryFn` cierra sobre el repository inyectado.
//
// Las tres traducciones de §D6, que son donde esto se rompe si se hace de memoria:
//   1. `error: Error | null` → `string | null`, vía `aMensaje` (mismo texto castellano que antes).
//   2. `data: ObraSocial[] | undefined` → `ObraSocial[]`, normalizado a `[]`.
//   3. `loading` ← `isPending`, NUNCA `isFetching`: `isFetching` también es `true` durante una
//      revalidación en background, y eso devolvería el parpadeo que el change vino a eliminar.
//
// ⚠️ Por qué el error de MUTACIÓN vive en un `useState` y no se lee de `mutacion.error`:
// medido el 2026-08-29, el estado de error de `useMutation` commitea UN TICK DESPUÉS de que
// `mutateAsync` rechaza. La implementación anterior lo seteaba sincrónicamente en el `catch` antes
// de relanzar, así que una pantalla que renderiza el error justo después de `await crear()` lo veía
// en el mismo render. Leerlo de `mutacion.error` cambiaría ese timing y dejaría la pantalla en
// blanco por un render. `onError` corre ANTES de que la promesa rechace, así que setear ahí
// preserva el comportamiento exacto. Esto NO es "el hook guardando estado de servidor" (eso lo
// maneja React Query): es estado de presentación de un error de escritura.
export function useObrasSociales(repository: ObraSocialRepository): UseObrasSocialesResult {
  const queryClient = useQueryClient();

  const { data, isPending, error, refetch } = useQuery({
    queryKey: claves.obrasSociales.lista(),
    queryFn: () => repository.list(),
    // Padrón casi estático. Declararlo acá (no en el cliente) es lo que hace que la cacheabilidad
    // sea explícita por dominio: las opciones por query ganan sobre los defaults del QueryClient.
    staleTime: FRESCURA.referencia,
  });

  // Toda mutación invalida el PREFIJO del dominio, no solo la clave de la lista: así alcanza
  // también a las páginas de `listPage` (R1) sin tener que enumerarlas.
  const invalidarDominio = useCallback(
    () => queryClient.invalidateQueries({ queryKey: claves.obrasSociales.todos() }),
    [queryClient],
  );

  const [errorMutacion, setErrorMutacion] = useState<string | null>(null);

  const mutacionCrear = useMutation({
    mutationFn: (nueva: NuevaObraSocial) => repository.create(nueva),
    onMutate: () => setErrorMutacion(null),
    onError: (err: unknown) => setErrorMutacion(aMensaje(err)),
    onSuccess: invalidarDominio,
  });

  const mutacionActualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: ActualizacionObraSocial }) =>
      repository.update(id, cambios),
    onMutate: () => setErrorMutacion(null),
    onError: (err: unknown) => setErrorMutacion(aMensaje(err)),
    onSuccess: invalidarDominio,
  });

  // `mutateAsync` propaga el rechazo al formulario, que es el comportamiento que ya tenían
  // `crear`/`actualizar` y del que dependen los tests de pantalla.
  const crear = useCallback(
    (nueva: NuevaObraSocial) => mutacionCrear.mutateAsync(nueva),
    [mutacionCrear],
  );

  const actualizar = useCallback(
    (id: string, cambios: ActualizacionObraSocial) => mutacionActualizar.mutateAsync({ id, cambios }),
    [mutacionActualizar],
  );

  const recargar = useCallback(async () => {
    await refetch();
  }, [refetch]);

  return {
    obrasSociales: data ?? [],
    loading: isPending,
    // Un único `error` para lectura y escritura, como antes: las pantallas leen un solo campo.
    error: aMensaje(error) ?? errorMutacion,
    recargar,
    crear,
    actualizar,
  };
}
