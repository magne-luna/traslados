import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { renderConSesion } from '../shared/test/renderConSesion';

// tasks.md 8.3, design.md de dashboard-ui (Migration Plan paso 4): acceder a `/` autenticada
// renderiza el DashboardRoute dentro del AppShell — ya no PlaceholderPage. renderConSesion()
// (auth-frontend-real, tasks.md 5.1/5.8) monta un AuthProvider con sesión admin de todos los
// permisos por defecto, así que no hace falta simular login explícitamente; el router real
// (createBrowserRouter) usa la URL por defecto de jsdom, que es `/`.
//
// `router` importa TODAS las rutas y varias ya cablean `Supabase*Repository` (Pacientes, Hojas de
// Ruta, Presupuestos, Dashboard, …), que a su vez importan `shared/lib/supabaseClient` — ese
// módulo lanza al cargar si no hay `SUPABASE_URL`/`SUPABASE_ANON_KEY` (no se setean en el entorno
// de test). Igual que el resto de los `*Route.test.tsx`, se mockea el cliente con un doble
// encadenable para no depender de red ni de esas variables. `/` solo monta el dashboard (seis
// `list()`/`getByFecha()` de solo lectura); el doble resuelve todo como listas vacías.
class ChainableFakeQuery implements PromiseLike<{ data: unknown[]; error: null; count: number }> {
  select(): this {
    return this;
  }
  order(): this {
    return this;
  }
  eq(): this {
    return this;
  }
  or(): this {
    return this;
  }
  in(): this {
    return this;
  }
  range(): this {
    return this;
  }
  maybeSingle(): Promise<{ data: null; error: null }> {
    return Promise.resolve({ data: null, error: null });
  }
  then<TResult1 = { data: unknown[]; error: null; count: number }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: [], error: null, count: 0 }).then(onfulfilled, onrejected);
  }
}

vi.mock('../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({
      from: () => new ChainableFakeQuery(),
      rpc: () => Promise.resolve({ data: null, error: null }),
    }),
    from: () => new ChainableFakeQuery(),
    rpc: () => Promise.resolve({ data: null, error: null }),
    functions: { invoke: vi.fn(() => Promise.resolve({ data: [], error: null })) },
    storage: { from: () => ({ createSignedUrl: () => Promise.resolve({ data: null, error: null }) }) },
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  },
}));

const { router } = await import('./router');

describe('router: la ruta / monta el dashboard (tasks.md 8.3)', () => {
  it('renderiza el dashboard dentro del shell autenticado, no el placeholder de "Próximamente"', async () => {
    renderConSesion(<RouterProvider router={router} />);

    // Dos fases async ENCADENADAS, cada una con su propia espera Y su propio timeout explícito de
    // 3 s. Partirlas no alcanzaba: ambas seguían con el default de 1 s de testing-library, así que
    // el test seguía flaky bajo la suite completa (falla al azar, pasa aislado — el peor tipo de
    // fallo). 3 s es la misma convención que ya usa `DashboardRoute.test.tsx` para esperar el fin
    // de los "Cargando …" de este mismo dashboard. Las fases son:
    //   1. `code-splitting-rutas`: baja el chunk de la ruta (hasta acá se ve `CargandoPantalla`).
    //   2. `migracion-react-query`: el dashboard consulta sus datos (sus tarjetas muestran sus
    //      propios "Cargando …" mientras tanto).
    // Esperar el encabezado primero es además lo que el test realmente afirma: que `/` monta el
    // dashboard. La ausencia de "cargando" se verifica después, ya sin competir por el mismo reloj.
    expect(
      await screen.findByRole('heading', { level: 1, name: /dashboard/i }, { timeout: 3000 }),
    ).toBeInTheDocument();

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0), { timeout: 3000 });

    expect(screen.getByText(/recorridos de hoy/i)).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
  });
});
