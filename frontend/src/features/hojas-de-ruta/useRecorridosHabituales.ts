import { useQuery } from '@tanstack/react-query';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import type { RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

// Carga los destinos habituales (RF-110, `pacientes.recorridos`) del paciente elegido en el
// formulario de armado de la hoja de ruta. Lo usan DOS formularios (NuevoRecorridoForm y
// AsignacionPanel).
//
// Un error de red NO rompe el formulario: se devuelve en `error` para que el selector lo muestre
// deshabilitado con el motivo, y el operador sigue cargando origen/destino/hora a mano. Se PROPAGA
// en vez de tragarse porque "falló la consulta" y "este paciente no tiene ninguno" se arreglan de
// maneras distintas y el operador tiene que poder distinguirlos. El `repository` es opcional a
// propósito (`undefined` = la pantalla no lo inyecta): sin él el hook no pide nada.
//
// migracion-react-query, Fase 4. Dos detalles propios de este hook:
//
//   1. **`enabled`** reemplaza al early-return del efecto: sin repository o sin paciente elegido,
//      no se consulta nada.
//   2. **`loading` sale de `isLoading`, NO de `isPending`.** Es la única excepción al criterio del
//      resto del change, y es por el `enabled`: en React Query v5 una consulta deshabilitada queda
//      con `isPending: true` para siempre (nunca resolvió), y este hook debe reportar `loading:
//      false` cuando no hay nada que cargar. `isLoading` es `isPending && isFetching`, que da
//      exactamente eso.
export function useRecorridosHabituales(
  repository: Pick<RecorridoHabitualRepository, 'list'> | undefined,
  pacienteId: string,
): { recorridos: RecorridoHabitual[]; loading: boolean; error: string | null } {
  const habilitada = repository !== undefined && pacienteId !== '';

  const { data, isLoading, error } = useQuery({
    queryKey: claves.recorridosHabituales.dePaciente(pacienteId),
    queryFn: () => repository!.list(pacienteId),
    enabled: habilitada,
    staleTime: FRESCURA.transaccional,
  });

  return {
    recorridos: data ?? [],
    loading: isLoading,
    // Mensaje propio, distinto del genérico del resto del change: el selector lo muestra en línea.
    error: error === null ? null : error.message || 'No se pudieron cargar los destinos habituales.',
  };
}
