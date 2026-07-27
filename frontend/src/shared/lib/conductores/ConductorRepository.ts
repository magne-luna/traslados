import type { ActualizacionConductor, Conductor, NuevoConductor } from '../../types/conductor';

// Contrato de datos (ver design.md de conductores-ui, Decisión 9). Las pantallas de la feature
// consumen esta interfaz, nunca Supabase directamente. Cuando C-09 (conductores) se archive en
// el backend, se escribe un SupabaseConductorRepository que cumpla este mismo contrato y se
// inyecta en el punto de composición — los componentes no cambian.
export interface ConductorRepository {
  list(): Promise<Conductor[]>;
  /** Resuelve `null` si no existe un conductor con ese id (no lanza excepción). */
  getById(id: string): Promise<Conductor | null>;
  create(data: NuevoConductor): Promise<Conductor>;
  update(id: string, data: ActualizacionConductor): Promise<Conductor>;
}
