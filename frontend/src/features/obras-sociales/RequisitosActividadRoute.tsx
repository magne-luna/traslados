import { supabaseRequisitosActividadRepository } from '../../shared/lib/requisitosActividad/SupabaseRequisitosActividadRepository';
import { RequisitosActividadPage } from './RequisitosActividadPage';

// Único punto de composición que conoce supabaseRequisitosActividadRepository
// (documentos-checklist-items-por-actividad, tasks.md 5.1-5.2) — mismo criterio que
// `ObraSocialesRoute.tsx`/`PacientesRoute.tsx`: esta tabla ya tiene backend real (migración
// aplicada en 3.5), así que la ruta inyecta directamente el repository real, sin mock intermedio.
export function RequisitosActividadRoute() {
  return <RequisitosActividadPage repository={supabaseRequisitosActividadRepository} />;
}
