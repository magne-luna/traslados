import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RequireAuth } from './RequireAuth';
import { useAuth } from './useAuth';

// Mockeamos useAuth() para controlar sesión/no-sesión sin depender de AuthProvider real.
vi.mock('./useAuth');
const mockedUseAuth = vi.mocked(useAuth);

function renderGuardAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [{ path: '/', element: <div>Dashboard protegido</div> }],
      },
      { path: '/login', element: <div>Login mock</div> },
    ],
    { initialEntries: [path] },
  );

  return render(<RouterProvider router={router} />);
}

describe('RequireAuth', () => {
  it('sin sesión redirige a /login', () => {
    mockedUseAuth.mockReturnValue({ session: null, signIn: vi.fn(), signOut: vi.fn() });

    renderGuardAt('/');

    expect(screen.getByText('Login mock')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard protegido')).not.toBeInTheDocument();
  });

  it('con sesión renderiza el <Outlet>', () => {
    mockedUseAuth.mockReturnValue({
      session: { user: { id: '1', nombre: 'Test User', email: 't@t.com' } },
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    renderGuardAt('/');

    expect(screen.getByText('Dashboard protegido')).toBeInTheDocument();
    expect(screen.queryByText('Login mock')).not.toBeInTheDocument();
  });
});
