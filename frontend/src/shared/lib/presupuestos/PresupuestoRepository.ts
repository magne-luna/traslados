import type { ActualizacionPresupuesto, NuevoPresupuesto, Presupuesto } from '../../types/presupuesto';

// Contrato de datos (ver design.md de presupuestos-ui, Decisión 10). Las pantallas de la feature
// consumen esta interfaz, nunca Supabase directamente. Cuando el backend real (C-06) se archive,
// se escribe un SupabasePresupuestoRepository que cumpla este mismo contrato y se inyecta en el
// punto de composición — los componentes no cambian.
export interface PresupuestoRepository {
  list(): Promise<Presupuesto[]>;
  /** Resuelve `null` si no existe un presupuesto con ese id (no lanza excepción). */
  getById(id: string): Promise<Presupuesto | null>;
  create(data: NuevoPresupuesto): Promise<Presupuesto>;
  update(id: string, data: ActualizacionPresupuesto): Promise<Presupuesto>;
}
