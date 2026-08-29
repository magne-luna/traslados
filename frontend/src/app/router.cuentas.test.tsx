import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { renderConSesion } from '../shared/test/renderConSesion';

// tasks.md 7.9 (auth-frontend-real, design.md D4): /cuentas cuelga de RequireAuth + AppShell,
// admin-only (route-guard ya lo exige vía `requiereRolAdmin`, sección 5 de este tasks.md — este
// test verifica el CABLEADO del router, no reimplementa esa lógica).
//
// `CuentasRoute` inyecta `supabaseCuentaRepository` (real) — este test mockea
// `shared/lib/supabaseClient` (mismo criterio que SupabaseAuthRepository.test.ts/
// SupabaseCuentaRepository.test.ts) para no depender de red ni de `SUPABASE_URL`/
// `SUPABASE_ANON_KEY` en el entorno de test.
//
// El `router` construye su estado inicial en la URL por defecto de jsdom (`/`), que ahora resuelve
// a `DashboardRoute` — seis `Supabase*Repository` reales de solo lectura, cuyos `list()` encadenan
// `.select().order()` / `.eq().maybeSingle()`. Un `select()` que devuelve una `Promise` pelada
// rompía esa cadena (`.order` undefined) y tumbaba el render entero. El doble pasa a ser un builder
// encadenable mínimo (mismo criterio que `PacientesRoute.test.tsx`): cada eslabón devuelve `this` y
// solo al awaitearlo resuelve `{ data: [], error: null, count: 0 }`.
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
  },
}));

const { router } = await import('./router');

function navegarA(path: string) {
  window.history.pushState({}, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

describe('router: /cuentas (tasks.md 7.9)', () => {
  afterEach(() => {
    navegarA('/');
  });

  it('con rol admin monta CuentasPage dentro del AppShell (Scenario: Listado visible para la administradora)', async () => {
    navegarA('/cuentas');
    renderConSesion(<RouterProvider router={router} />);

    // `waitFor` sobre la aserción final, no sobre la ausencia de "cargando": la ruta índice `/`
    // (DashboardRoute) resuelve primero y su carga por bloques puede dejar el DOM sin ningún
    // "cargando" en un tick intermedio, antes de que el router termine de navegar a `/cuentas`.
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Cuentas' })).toBeInTheDocument(), {
      timeout: 5000,
    });
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
  });

  it('con rol empleado sin rol admin muestra acceso denegado, no un redirect silencioso (Scenario: Acceso denegado para empleados)', async () => {
    navegarA('/cuentas');
    renderConSesion(<RouterProvider router={router} />, {
      usuario: { id: 'e1', nombre: 'Enzo', apellido: 'Gómez', email: 'enzo@x.com', rol: 'empleado' },
      permisos: {},
    });

    await waitFor(() => expect(screen.getByText(/acceso denegado/i)).toBeInTheDocument(), { timeout: 5000 });
    expect(screen.queryByRole('heading', { name: 'Cuentas' })).not.toBeInTheDocument();
  });
});
