import { supabaseRequisitosActividadRepository } from '../../shared/lib/requisitosActividad/SupabaseRequisitosActividadRepository';
import { PacientesDocumentacionTabs } from '../../shared/components/PacientesDocumentacionTabs';
import { RequisitosActividadPage } from './RequisitosActividadPage';

// Único punto de composición que conoce supabaseRequisitosActividadRepository
// (documentos-checklist-items-por-actividad, tasks.md 5.1-5.2) — mismo criterio que
// `ObraSocialesRoute.tsx`/`PacientesRoute.tsx`: esta tabla ya tiene backend real (migración
// aplicada en 3.5), así que la ruta inyecta directamente el repository real, sin mock intermedio.
//
// `PacientesDocumentacionTabs` (pacientes-docs-actividad-tabs) se monta acá, mismo criterio que
// en `PacientesRoute.tsx`: necesita Router/AuthProvider, y esta es la composición raíz de la
// feature.
export function RequisitosActividadRoute() {
  return (
    <>
      <PacientesDocumentacionTabs />
      <RequisitosActividadPage repository={supabaseRequisitosActividadRepository} />
    </>
  );
}
