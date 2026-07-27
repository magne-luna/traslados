import type { ActualizacionAutorizacion, Autorizacion, NuevaAutorizacion } from '../../types/presupuesto';

// Contrato de datos (ver design.md de presupuestos-ui, Decisión 2 y 10): Autorizacion es una
// entidad separada de Presupuesto, referenciada por `presupuestoId` (relación 1---1). Las
// pantallas de la feature consumen esta interfaz, nunca Supabase directamente. Cuando el backend
// real (C-06) se archive, se escribe un SupabaseAutorizacionRepository que cumpla este mismo
// contrato y se inyecta en el punto de composición — los componentes no cambian.
export interface AutorizacionRepository {
  list(): Promise<Autorizacion[]>;
  /** Resuelve `null` si no existe una autorización con ese id (no lanza excepción). */
  getById(id: string): Promise<Autorizacion | null>;
  /** Resuelve `null` si el presupuesto todavía no tiene una autorización asociada. */
  getByPresupuestoId(presupuestoId: string): Promise<Autorizacion | null>;
  create(data: NuevaAutorizacion): Promise<Autorizacion>;
  update(id: string, data: ActualizacionAutorizacion): Promise<Autorizacion>;
}
