import { useCallback } from 'react';
import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../shared/types/obraSocial';
import type { FiltrosObraSocial, ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { usePaginaListado, type UsePaginaListadoResult } from '../../shared/lib/paginacion/usePaginaListado';

// Tamaño de página fijo, sin selector (checkpoint 0.3 aprobado 2026-08-12).
const TAMANIO_PAGINA = 20;

export interface UseObrasSocialesPaginadoResult extends UsePaginaListadoResult<ObraSocial> {
  crear: (data: NuevaObraSocial) => Promise<ObraSocial>;
  actualizar: (id: string, data: ActualizacionObraSocial) => Promise<ObraSocial>;
}

// Wiring de la pantalla de LISTADO de Obras Sociales contra `listPage` (paginacion-listados,
// Fase 3, design.md §D3/D6, tasks.md 17.3). Distinto de `useObrasSociales.ts` (`list()` sin
// paginar): ese hook sigue existiendo tal cual — lo siguen usando PacientesPage/
// PresupuestosPage/FacturacionPage para sus selectores con el catálogo COMPLETO (design.md §D3,
// caso "PacientesList resuelve nombreObraSocial vía list()"). Este hook es exclusivo de
// ObraSocialesPage, la única pantalla que muestra el listado paginado en sí.
export function useObrasSocialesPaginado(repository: ObraSocialRepository): UseObrasSocialesPaginadoResult {
  const listado = usePaginaListado<ObraSocial, FiltrosObraSocial>({
    listPage: repository.listPage,
    tamanio: TAMANIO_PAGINA,
    construirFiltros: (busqueda) => ({ busqueda }),
  });

  const { recargar } = listado;

  // Tras crear/editar, se recarga la MISMA página (mismo criterio que
  // usePacientesPaginado/useConductoresPaginado, Fase 2 tasks.md 13.7).
  const crear = useCallback(
    async (data: NuevaObraSocial) => {
      const creada = await repository.create(data);
      recargar();
      return creada;
    },
    [repository, recargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionObraSocial) => {
      const actualizada = await repository.update(id, data);
      recargar();
      return actualizada;
    },
    [repository, recargar],
  );

  return { ...listado, crear, actualizar };
}
