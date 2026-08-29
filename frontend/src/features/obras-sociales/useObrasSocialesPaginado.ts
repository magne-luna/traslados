import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../shared/types/obraSocial';
import type { FiltrosObraSocial, ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { usePaginaListado, type UsePaginaListadoResult } from '../../shared/lib/paginacion/usePaginaListado';
import { claves } from '../../shared/lib/query/claves';

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
    clave: claves.obrasSociales.pagina,
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
    () => queryClient.invalidateQueries({ queryKey: claves.obrasSociales.todos() }),
    [queryClient],
  );

  // Tras crear/editar, se recarga la MISMA página (mismo criterio que
  // usePacientesPaginado/useConductoresPaginado, Fase 2 tasks.md 13.7).
  const crear = useCallback(
    async (data: NuevaObraSocial) => {
      const creada = await repository.create(data);
      await invalidarDominio();
      return creada;
    },
    [repository, invalidarDominio],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionObraSocial) => {
      const actualizada = await repository.update(id, data);
      await invalidarDominio();
      return actualizada;
    },
    [repository, invalidarDominio],
  );

  return { ...listado, crear, actualizar };
}
