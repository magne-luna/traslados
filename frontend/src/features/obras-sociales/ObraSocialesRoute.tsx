import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePrestadorRepository } from '../../shared/lib/prestadores/SupabasePrestadorRepository';
import { PrestadorRepositoryProvider } from '../prestadores/PrestadorRepositoryContext';
import { ObraSocialesPage } from './ObraSocialesPage';
import { ObraSocialRepositoryProvider } from './ObraSocialRepositoryContext';

// Único punto de composición que conoce supabaseObraSocialRepository (integracion-obra-social,
// design.md D1-D12, tasks.md 5.1 — "el corte real"): Obras Sociales ya tiene backend real (las dos
// migraciones de la sección 1B están redactadas y revisadas, pendientes de que la usuaria/Enzo las
// aplique — ver CHANGES.md §C-04), a diferencia de otros módulos que siguen en mock porque sus
// propios backends todavía no existen. El resto de la feature solo conoce la interfaz
// `ObraSocialRepository` — mismo criterio que `PacientesRoute.tsx`/`CuentasRoute.tsx`.
//
// `PrestadorRepositoryProvider` (design.md D2 de prestadores-crud, tasks.md 5.3) se monta acá
// también: es el único lugar que conoce las dos implementaciones concretas a la vez, para que
// `PrestadoresDeObraSocial.tsx` (panel de solo lectura dentro de `ObraSocialDetail.tsx`) resuelva
// el vínculo sin que ninguna pantalla de esta feature importe `supabasePrestadorRepository`
// directamente.
export function ObraSocialesRoute() {
  return (
    <ObraSocialRepositoryProvider repository={supabaseObraSocialRepository}>
      <PrestadorRepositoryProvider repository={supabasePrestadorRepository}>
        <ObraSocialesPage />
      </PrestadorRepositoryProvider>
    </ObraSocialRepositoryProvider>
  );
}
