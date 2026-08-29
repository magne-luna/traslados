import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ActualizacionConductor, Conductor, NuevoConductor } from '../../shared/types/conductor';
import type { ConductorRepository, FiltrosConductor } from '../../shared/lib/conductores/ConductorRepository';
import { usePaginaListado, type UsePaginaListadoResult } from '../../shared/lib/paginacion/usePaginaListado';
import { claves } from '../../shared/lib/query/claves';

// Tamaño de página fijo, sin selector (checkpoint 0.3 aprobado 2026-08-12).
const TAMANIO_PAGINA = 20;

export interface UseConductoresPaginadoResult extends UsePaginaListadoResult<Conductor> {
  crear: (data: NuevoConductor) => Promise<Conductor>;
  actualizar: (id: string, data: ActualizacionConductor) => Promise<Conductor>;
}

// Wiring de la pantalla de LISTADO de Conductores contra `listPage` (paginacion-listados, Fase 3,
// design.md §D3/D6, tasks.md 16.3). Distinto de `useConductores.ts` (`list()` sin paginar): ese
// hook sigue existiendo tal cual — lo sigue usando `HojaDeRutaPage` para su selector de
// conductores con el padrón COMPLETO. Este hook es exclusivo de ConductoresPage, la única
// pantalla que muestra el listado paginado en sí. Mismo patrón exacto que `usePacientesPaginado`.
export function useConductoresPaginado(repository: ConductorRepository): UseConductoresPaginadoResult {
  const listado = usePaginaListado<Conductor, FiltrosConductor>({
    listPage: repository.listPage,
    clave: claves.conductores.pagina,
    tamanio: TAMANIO_PAGINA,
    construirFiltros: (busqueda) => ({ busqueda }),
  });

  const queryClient = useQueryClient();

  // ⚠️ RIESGO #1 del change (migracion-react-query, tasks.md 3.8). Este camino de mutación es
  // DISTINTO del de los selectores: acá se recarga solo la página vigente. Invalidar el PREFIJO del
  // dominio —no la clave de la página— alcanza también al padrón completo (`list()`), que es lo que
  // consumen los selectores de otras pantallas. Sin esto, un alta hecha desde acá no aparecería en
  // esos selectores hasta que venciera el plazo de frescura, y fallaría en silencio: sin error, solo
  // un dato viejo. Y como el prefijo cubre también la página vigente, sigue recargándose la MISMA
  // página (nunca se salta a la 1), que es el comportamiento de 13.7 — por eso reemplaza a
  // `recargar()` en vez de sumarse (llamar a los dos haría dos consultas idénticas).
  const invalidarDominio = useCallback(
    () => queryClient.invalidateQueries({ queryKey: claves.conductores.todos() }),
    [queryClient],
  );

  // Tras crear/editar, se recarga la MISMA página (nunca se salta a la página 1 ni se deja la
  // pantalla desactualizada) — mismo criterio que `usePacientesPaginado` (Fase 2, tasks.md 13.7).
  const crear = useCallback(
    async (data: NuevoConductor) => {
      const creado = await repository.create(data);
      await invalidarDominio();
      return creado;
    },
    [repository, invalidarDominio],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionConductor) => {
      const actualizado = await repository.update(id, data);
      await invalidarDominio();
      return actualizado;
    },
    [repository, invalidarDominio],
  );

  return { ...listado, crear, actualizar };
}
