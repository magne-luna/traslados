import type { ActualizacionConductor, NuevoConductor, Conductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import { claves } from '../../shared/lib/query/claves';
import { FRESCURA } from '../../shared/lib/query/frescura';
import { useListaDeDominio } from '../../shared/lib/query/useListaDeDominio';

export interface UseConductoresResult {
  conductores: Conductor[];
  loading: boolean;
  error: string | null;
  recargar: () => Promise<void>;
  crear: (data: NuevoConductor) => Promise<Conductor>;
  actualizar: (id: string, data: ActualizacionConductor) => Promise<Conductor>;
}

// Wiring de estado entre las pantallas de Conductores y un ConductorRepository.
//
// migracion-react-query, Fase 3: el cuerpo delega en `useListaDeDominio` (el patrón compartido de
// los cuatro dominios de referencia). **`UseConductoresResult` NO cambió** — solo se renombra `datos` a
// `conductores`, que es el nombre que las pantallas ya usan.
export function useConductores(repository: ConductorRepository): UseConductoresResult {
  const { datos, ...resto } = useListaDeDominio<Conductor, NuevoConductor, ActualizacionConductor>({
    claveDominio: claves.conductores.todos(),
    claveLista: claves.conductores.lista(),
    cargar: () => repository.list(),
    crear: (data) => repository.create(data),
    actualizar: (id, data) => repository.update(id, data),
    frescuraMs: FRESCURA.referencia,
  });

  return { conductores: datos, ...resto };
}
