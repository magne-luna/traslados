import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ActualizacionHojaDeRuta, HojaDeRuta, NuevaHojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseHojasDeRutaResult {
  hojaDeRuta: HojaDeRuta | null;
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevaHojaDeRuta) => Promise<HojaDeRuta>;
  actualizar: (id: string, data: ActualizacionHojaDeRuta) => Promise<HojaDeRuta>;
}

// migracion-react-query, Fase 4 (dominio TRANSACCIONAL). **`UseHojasDeRutaResult` NO cambió.**
// A diferencia del resto, expone UN objeto (la hoja del día), no una lista.
//
// ⚠️ REGRESIÓN 8.6 — el refetch posterior a una mutación debe ser SILENCIOSO. Historia: el fix
// "Sugerir orden no hace nada, se recarga la página" (2026-08-11). `HojaDeRutaPage` reemplaza toda
// la vista de armado por "Cargando…" mientras `loading` es true, así que si una mutación tildara
// `loading`, cada acción (Sugerir orden, subir/bajar, quitar parada) desmontaría todos los
// RecorridoCard —incluido el que estuviera en modo "Editar"— y los volvería a montar en modo
// lectura. El cambio se guardaba; solo que la pantalla te sacaba de edición antes de que lo vieras.
//
// Con React Query eso sale GRATIS y sin código especial: `loading` sale de `isPending`, que es
// `false` mientras haya dato en caché. La revalidación posterior a la invalidación ocurre con
// `isFetching: true` e `isPending: false` — exactamente el "silencioso" que antes había que pasar a
// mano. Usar `isFetching` acá reintroduciría el bug. Cubierto por los dos tests de regresión 8.6.
//
// ⚠️ `FRESCURA.transaccional` es CERO: la hoja del día es la agenda operativa y cambia mientras se
// la está armando.
export function useHojasDeRuta(repository: HojaDeRutaRepository, fecha: string): UseHojasDeRutaResult {
  const queryClient = useQueryClient();
  const [errorMutacion, setErrorMutacion] = useState<string | null>(null);

  const { data, isPending, error, refetch } = useQuery({
    queryKey: claves.hojasDeRuta.deFecha(fecha),
    queryFn: () => repository.getByFecha(fecha),
    staleTime: FRESCURA.transaccional,
  });

  const invalidar = useCallback(
    () => queryClient.invalidateQueries({ queryKey: claves.hojasDeRuta.todos() }),
    [queryClient],
  );

  const comunes = {
    onMutate: () => setErrorMutacion(null),
    onError: (err: unknown) => setErrorMutacion(aMensaje(err)),
    onSuccess: invalidar,
  };

  const mutacionCrear = useMutation({ mutationFn: (d: NuevaHojaDeRuta) => repository.create(d), ...comunes });
  const mutacionActualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: ActualizacionHojaDeRuta }) => repository.update(id, cambios),
    ...comunes,
  });

  return {
    hojaDeRuta: data ?? null,
    loading: isPending,
    error: aMensaje(error) ?? errorMutacion,
    recargar: useCallback(async () => {
      await refetch();
    }, [refetch]),
    crear: useCallback((d: NuevaHojaDeRuta) => mutacionCrear.mutateAsync(d), [mutacionCrear]),
    actualizar: useCallback(
      (id: string, cambios: ActualizacionHojaDeRuta) => mutacionActualizar.mutateAsync({ id, cambios }),
      [mutacionActualizar],
    ),
  };
}
