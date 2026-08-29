import { QueryClient } from '@tanstack/react-query';

// Configuración única del cliente de React Query (design.md §D2). Ningún default se deja implícito.
//
// ⚠️ `staleTime: 0` como default global es DELIBERADO y es la principal defensa contra R2 (mostrar
// plata desactualizada). El default seguro es el que no miente: un dominio que se olvide de
// declarar su frescura se comporta como hoy —consulta siempre— en vez de servir datos viejos en
// silencio. La cacheabilidad se opta explícitamente, query por query, con `FRESCURA.referencia`
// (ver shared/lib/query/frescura.ts). NUNCA subir este default a un valor distinto de cero.
//
// `refetchOnWindowFocus: false` se hereda de la versión original de este change: la app se usa en
// jornadas largas con muchas ventanas abiertas, y refrescar al volver el foco produciría ráfagas de
// consultas que nadie pidió.
export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

/** Instancia de producción. Los tests NUNCA la importan: usan `crearQueryClientDeTest()`, que da
 * una instancia nueva por test (design.md §D7). Compartir esta filtraría caché entre tests. */
export const queryClient: QueryClient = crearQueryClient();
