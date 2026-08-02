import { supabaseObraSocialRepository } from '../../shared/lib/obrasSociales/SupabaseObraSocialRepository';
import { supabasePrestadorRepository } from '../../shared/lib/prestadores/SupabasePrestadorRepository';
import { PrestadoresPage } from './PrestadoresPage';
import { PrestadorRepositoryProvider } from './PrestadorRepositoryContext';

// Único punto de composición que conoce supabasePrestadorRepository (design.md D1/D5 de
// prestadores-crud, Migration Plan paso 6 — "el corte real"): antes de este archivo, nadie
// importaba el dominio de Prestador construido en el work unit anterior. Sin test dedicado
// (tasks.md 4.3, plomería de composition-root) — mismo criterio que ObraSocialesRoute.tsx.
//
// `supabaseObraSocialRepository` (D2, tasks.md 5.1) se inyecta acá por prop a `PrestadoresPage`,
// no por Context — mismo patrón que `PacientesRoute.tsx` con `obraSocialRepository`: no hace
// falta un segundo Context nuevo cuando ya existe un precedente de inyección directa por prop.
export function PrestadoresRoute() {
  return (
    <PrestadorRepositoryProvider repository={supabasePrestadorRepository}>
      <PrestadoresPage obraSocialRepository={supabaseObraSocialRepository} />
    </PrestadorRepositoryProvider>
  );
}
