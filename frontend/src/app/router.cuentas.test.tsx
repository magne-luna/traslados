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
// `SUPABASE_ANON_KEY` en el entorno de test; por eso `router.tsx` usa `lazy` para esta ruta (ver
// su comentario) — así el resto de los tests que importan `router.tsx` sin mockear
// `supabaseClient` (ej. `router.test.tsx`) no rompen.
vi.mock('../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({ from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
    functions: { invoke: vi.fn() },
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

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));

    expect(screen.getByRole('heading', { name: 'Cuentas' })).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
  });

  it('con rol empleado sin rol admin muestra acceso denegado, no un redirect silencioso (Scenario: Acceso denegado para empleados)', async () => {
    navegarA('/cuentas');
    renderConSesion(<RouterProvider router={router} />, {
      usuario: { id: 'e1', nombre: 'Enzo', apellido: 'Gómez', email: 'enzo@x.com', rol: 'empleado' },
      permisos: {},
    });

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));

    expect(screen.getByText(/acceso denegado/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Cuentas' })).not.toBeInTheDocument();
  });
});
