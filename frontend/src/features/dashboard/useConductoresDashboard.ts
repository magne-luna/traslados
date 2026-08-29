import { useQuery } from '@tanstack/react-query';
import type { Conductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import { aMensaje } from '../../shared/lib/query/aMensaje';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';

export interface UseConductoresDashboardResult {
  conductores: Conductor[];
  cargando: boolean;
  error: string | null;
}

// tasks.md 5.4: lectura para el panel de recorridos del día.
//
// migracion-react-query, Fase 5. **`UseConductoresDashboardResult` NO cambió** (sigue exponiendo `cargando`, no
// `loading`). Lo que cambia es de dónde sale el dato: usa **la misma clave** que
// `useConductores` (`claves.conductores.lista()`), así que si la usuaria ya pasó por ese módulo el
// dashboard NO vuelve a pedir el padrón — y viceversa. `/` es la ruta índice y se la visita
// constantemente: ese round-trip repetido era uno de los tres desperdicios que motivaron el change.
//
// Sigue siendo de SOLO LECTURA: no expone `crear` ni `actualizar`, para que sea estructuralmente
// imposible que el dashboard escriba (design.md Non-Goals del change de dashboard).
export function useConductoresDashboard(repository: ConductorRepository): UseConductoresDashboardResult {
  const { data, isPending, error } = useQuery({
    queryKey: claves.conductores.lista(),
    queryFn: () => repository.list(),
    staleTime: FRESCURA.referencia,
  });

  return { conductores: data ?? [], cargando: isPending, error: aMensaje(error) };
}
