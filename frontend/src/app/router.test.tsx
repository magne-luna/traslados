import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { AuthProvider } from '../shared/auth/AuthContext';
import { router } from './router';

// tasks.md 8.3, design.md de dashboard-ui (Migration Plan paso 4): acceder a `/` autenticada
// renderiza el DashboardRoute dentro del AppShell — ya no PlaceholderPage. AuthProvider arranca
// logueado por defecto (ver AuthContext.tsx: FAKE_SESSION), así que no hace falta simular login;
// el router real (createBrowserRouter) usa la URL por defecto de jsdom, que es `/`.
describe('router: la ruta / monta el dashboard (tasks.md 8.3)', () => {
  it('renderiza el dashboard dentro del shell autenticado, no el placeholder de "Próximamente"', async () => {
    render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));

    expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/recorridos de hoy/i)).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
  });
});
