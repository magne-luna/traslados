import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ActualizacionPaciente, NuevoPaciente, Paciente } from '../../shared/types/paciente';
import type { FiltrosPaciente, PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { usePaginaListado, type UsePaginaListadoResult } from '../../shared/lib/paginacion/usePaginaListado';
import { claves } from '../../shared/lib/query/claves';

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
    clave: claves.pacientes.pagina,
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
    () => queryClient.invalidateQueries({ queryKey: claves.pacientes.todos() }),
    [queryClient],
  );

  // 13.7: tras crear/editar, se recarga la MISMA página (nunca se salta a la página 1 ni se deja
  // la pantalla desactualizada) — `recargar()` de `usePaginaListado` está pensado exactamente
  // para esto (no toca `pagina`/`busqueda`, solo repite la consulta vigente).
  const crear = useCallback(
    async (data: NuevoPaciente) => {
      const creado = await repository.create(data);
      await invalidarDominio();
      return creado;
    },
    [repository, invalidarDominio],
  );

  const actualizar = useCallback(
    async (id: string, data: ActualizacionPaciente) => {
      const actualizado = await repository.update(id, data);
      await invalidarDominio();
      return actualizado;
    },
    [repository, invalidarDominio],
  );

  return { ...listado, crear, actualizar };
}
