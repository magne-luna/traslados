import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { renderConSesion } from '../shared/test/renderConSesion';
import { router } from './router';

// tasks.md 8.3, design.md de dashboard-ui (Migration Plan paso 4): acceder a `/` autenticada
// renderiza el DashboardRoute dentro del AppShell — ya no PlaceholderPage. renderConSesion()
// (auth-frontend-real, tasks.md 5.1/5.8) monta un AuthProvider con sesión admin de todos los
// permisos por defecto, así que no hace falta simular login explícitamente; el router real
// (createBrowserRouter) usa la URL por defecto de jsdom, que es `/`.
describe('router: la ruta / monta el dashboard (tasks.md 8.3)', () => {
  it('renderiza el dashboard dentro del shell autenticado, no el placeholder de "Próximamente"', async () => {
    renderConSesion(<RouterProvider router={router} />);

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));

    expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/recorridos de hoy/i)).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
  });
});
