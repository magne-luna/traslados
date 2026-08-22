import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePacienteRepository } from '../../shared/lib/pacientes/SupabasePacienteRepository';
import { supabaseRecorridoHabitualRepository } from '../../shared/lib/pacientes/SupabaseRecorridoHabitualRepository';
import { supabaseAutorizacionRepository } from '../../shared/lib/presupuestos/SupabaseAutorizacionRepository';
import { supabasePresupuestoRepository } from '../../shared/lib/presupuestos/SupabasePresupuestoRepository';
import { AutorizacionRepositoryProvider } from './AutorizacionRepositoryContext';
import { PresupuestoRepositoryProvider } from './PresupuestoRepositoryContext';
import { PresupuestosPage } from './PresupuestosPage';

// Único punto de composición que conoce supabasePresupuestoRepository,
// supabaseAutorizacionRepository, supabasePacienteRepository y supabaseObraSocialRepository
// (design.md Decisión 8/10, tasks.md 4.1 — "el corte real"): Presupuestos y Autorizaciones ya
// tienen backend real (Edge Functions `presupuestos`/`autorizaciones`, C-06/`integracion-
// presupuestos`), a diferencia de Pacientes/Obras Sociales, que ya tenían backend real desde antes
// (D8: reutilizados de PacientesRoute.tsx/ObraSocialesRoute.tsx, no recreados acá — sin ellos toda
// alta falla con 23503 porque presupuesto/autorizacion referencian paciente/obra_social reales) —
// el resto de la feature solo conoce las interfaces de los repositories, así que este es el único
// archivo que cambió (mismo criterio que PacientesRoute.tsx/ObraSocialesRoute.tsx).
//
// También `supabaseRecorridoHabitualRepository` (presupuestos-vigencia-datos-traslado-vista-previa,
// tasks.md 8.5): botón "Traer de los destinos habituales del paciente" de `PresupuestoForm`, mismo
// repository real ya wireado en `PacientesRoute.tsx` — solo se reutiliza `list()`, nunca
// `create`/`remove` desde este lado.
//
// ⚠️ 1B.4 (verificación del gateo de permisos de las Edge Functions con 3 cuentas reales) fue
// postergada por decisión explícita de la usuaria (2026-08-05) — se corre después de este swap, no
// antes. Si algo falla en producción con 403, puede ser un bug real o un permiso sin verificar; no
// asumir que el gateo ya está confirmado contra cuentas reales (ver tasks.md §4).
export function PresupuestosRoute() {
  return (
    <PresupuestoRepositoryProvider repository={supabasePresupuestoRepository}>
      <AutorizacionRepositoryProvider repository={supabaseAutorizacionRepository}>
        <PresupuestosPage
          pacienteRepository={supabasePacienteRepository}
          obraSocialRepository={supabaseObraSocialRepository}
          recorridoHabitualRepository={supabaseRecorridoHabitualRepository}
        />
      </AutorizacionRepositoryProvider>
    </PresupuestoRepositoryProvider>
  );
}
