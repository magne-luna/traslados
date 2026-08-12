import { useCallback } from 'react';
import type { ActualizacionConductor, Conductor, NuevoConductor } from '../../shared/types/conductor';
import type { ConductorRepository, FiltrosConductor } from '../../shared/lib/conductores/ConductorRepository';
import { usePaginaListado, type UsePaginaListadoResult } from '../../shared/lib/paginacion/usePaginaListado';

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
    tamanio: TAMANIO_PAGINA,
    construirFiltros: (busqueda) => ({ busqueda }),
  });

  const { recargar } = listado;

  // Tras crear/editar, se recarga la MISMA página (nunca se salta a la página 1 ni se deja la
  // pantalla desactualizada) — mismo criterio que `usePacientesPaginado` (Fase 2, tasks.md 13.7).
  const crear = useCallback(
    async (data: NuevoConductor) => {
      const creado = await repository.create(data);
      recargar();
      return creado;
    },
    [repository, recargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionConductor) => {
      const actualizado = await repository.update(id, data);
      recargar();
      return actualizado;
    },
    [repository, recargar],
  );

  return { ...listado, crear, actualizar };
}
