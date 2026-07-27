import type { ActualizacionFactura, Factura, NuevaFactura } from '../../types/factura';

// Contrato de datos (tasks.md 4.1, design.md Decisión 1 y 15). Las pantallas de la feature
// consumen esta interfaz, nunca Supabase directamente. Cuando el backend real (C-07) se archive,
// se escribe un SupabaseFacturaRepository que cumpla este mismo contrato y se inyecta en el
// punto de composición — los componentes no cambian. Las `AsistenciaPrestacion` viven embebidas
// en la `Factura` (design.md Decisión 1), sin repository aparte.
export interface FacturaRepository {
  list(): Promise<Factura[]>;
  /** Resuelve `null` si no existe una factura con ese id (no lanza excepción). */
  getById(id: string): Promise<Factura | null>;
  listByPaciente(pacienteId: string): Promise<Factura[]>;
  create(data: NuevaFactura): Promise<Factura>;
  update(id: string, data: ActualizacionFactura): Promise<Factura>;
}
