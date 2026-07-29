import { supabaseCuentaRepository } from '../../shared/lib/cuentas/SupabaseCuentaRepository';
import { CuentaRepositoryProvider } from './CuentaRepositoryContext';
import { CuentasPage } from './CuentasPage';

// Único punto de composición que conoce `supabaseCuentaRepository` (design.md D1/D8/D9, tasks.md
// 7.8) — a diferencia de `ObraSocialesRoute` (que inyecta un mock porque el backend real de esa
// capability todavía no existe), acá el backend de C-02 YA está desplegado, así que esta es la
// ÚNICA implementación de producción; los tests inyectan `createMockCuentaRepository(...)` en su
// lugar (mismo criterio que `App.tsx` con `supabaseAuthRepository`/`renderConSesion` — sin test
// propio, por la misma razón: es un composition root que solo cablea una dependencia real).
export function CuentasRoute() {
  return (
    <CuentaRepositoryProvider repository={supabaseCuentaRepository}>
      <CuentasPage />
    </CuentaRepositoryProvider>
  );
}
