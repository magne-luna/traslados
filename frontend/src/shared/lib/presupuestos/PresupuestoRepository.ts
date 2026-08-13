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
  /**
   * Alta atómica de N presupuestos (`presupuesto-prestaciones` PR 2, design.md D2/D4): respaldada
   * por la RPC `facturacion.crear_presupuestos_lote`, uno por prestación seleccionada en modalidad
   * `por-prestacion`. O resuelve con los N presupuestos creados, o rechaza sin persistir ninguno —
   * nunca deja el lote a medias. `create(data)` NO cambia de firma para acomodar esto (D4).
   */
  createLote(nuevos: NuevoPresupuesto[]): Promise<Presupuesto[]>;
  update(id: string, data: ActualizacionPresupuesto): Promise<Presupuesto>;
}
