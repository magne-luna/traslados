import { useCallback } from 'react';
import type { ActualizacionPaciente, NuevoPaciente, Paciente } from '../../shared/types/paciente';
import type { FiltrosPaciente, PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { usePaginaListado, type UsePaginaListadoResult } from '../../shared/lib/paginacion/usePaginaListado';

// Tamaño de página fijo, sin selector (checkpoint 0.3 aprobado 2026-08-12).
const TAMANIO_PAGINA = 20;

export interface UsePacientesPaginadoResult extends UsePaginaListadoResult<Paciente> {
  crear: (data: NuevoPaciente) => Promise<Paciente>;
  actualizar: (id: string, data: ActualizacionPaciente) => Promise<Paciente>;
}

// Wiring de la pantalla de LISTADO de Pacientes contra `listPage` (paginacion-listados, Fase 2,
// design.md §D3/D6, tasks.md 13.2). Distinto de `usePacientes.ts` (FE-8, `list()` sin paginar):
// ese hook sigue existiendo tal cual — lo siguen usando PresupuestosPage/FacturacionPage/
// HojaDeRutaPage para poblar sus selectores con el padrón COMPLETO (design.md §D3, tabla de
// consumidores de `list()`). Este hook es exclusivo de PacientesPage, la única pantalla que
// muestra el listado paginado en sí.
export function usePacientesPaginado(repository: PacienteRepository): UsePacientesPaginadoResult {
  const listado = usePaginaListado<Paciente, FiltrosPaciente>({
    listPage: repository.listPage,
    tamanio: TAMANIO_PAGINA,
    construirFiltros: (busqueda) => ({ busqueda }),
  });

  const { recargar } = listado;

  // 13.7: tras crear/editar, se recarga la MISMA página (nunca se salta a la página 1 ni se deja
  // la pantalla desactualizada) — `recargar()` de `usePaginaListado` está pensado exactamente
  // para esto (no toca `pagina`/`busqueda`, solo repite la consulta vigente).
  const crear = useCallback(
    async (data: NuevoPaciente) => {
      const creado = await repository.create(data);
      recargar();
      return creado;
    },
    [repository, recargar],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionPaciente) => {
      const actualizado = await repository.update(id, data);
      recargar();
      return actualizado;
    },
    [repository, recargar],
  );

  return { ...listado, crear, actualizar };
}
