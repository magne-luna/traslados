import { QueryClient } from '@tanstack/react-query';

// Configuración única del cliente de React Query (design.md §D2). Ningún default se deja implícito.
//
// ⚠️ `staleTime: 0` como default global es DELIBERADO y es la principal defensa contra R2 (mostrar
// plata desactualizada). El default seguro es el que no miente: un dominio que se olvide de
// declarar su frescura se comporta como hoy —consulta siempre— en vez de servir datos viejos en
// silencio. La cacheabilidad se opta explícitamente, query por query, con `FRESCURA.referencia`
// (ver shared/lib/query/frescura.ts). NUNCA subir este default a un valor distinto de cero.
//
// `refetchOnWindowFocus: true` (antes `false`, por miedo a ráfagas de consultas con muchas ventanas
// abiertas): varias personas usan la misma cuenta en distintas computadoras y no veían lo que cargaba
// la otra sin F5. Con 2-3 usuarias el costo es despreciable. Solo refresca queries activas y vencidas
// según su `staleTime` (las de `FRESCURA.referencia` esperan su minuto). Tiempo real (Supabase
// Realtime) queda descartado por ahora: más costo que beneficio para este problema.
export function crearQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        // 10 min, deliberadamente MUY por encima del `staleTime` de referencia (1 min). Son perillas
        // distintas: `staleTime` decide cuántos requests se hacen; `gcTime` decide si la usuaria ve
        // un spinner. Mientras el dato siga acá, una pantalla vencida se pinta igual al instante y
        // revalida en background. Bajar esto a la par del staleTime traería de vuelta los spinners
        // que el change vino a eliminar.
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: true,
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
