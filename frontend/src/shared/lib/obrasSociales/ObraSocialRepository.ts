import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../types/obraSocial';

// Contrato de datos (ver design.md de obras-sociales-ui, Decisión 6). Las pantallas de la
// feature consumen esta interfaz, nunca Supabase directamente. Cuando C-04 (obras-sociales-
// prestadores) se archive en el backend, se escribe un SupabaseObraSocialRepository que cumpla
// este mismo contrato y se inyecta en el punto de composición — los componentes no cambian.
export interface ObraSocialRepository {
  list(): Promise<ObraSocial[]>;
  /** Resuelve `null` si no existe una obra social con ese id (no lanza excepción). */
  getById(id: string): Promise<ObraSocial | null>;
  create(data: NuevaObraSocial): Promise<ObraSocial>;
  update(id: string, data: ActualizacionObraSocial): Promise<ObraSocial>;
}
