import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RequireAuth } from './RequireAuth';
import { AuthProvider } from './AuthContext';
import { renderConSesion } from '../test/renderConSesion';
import type { AuthRepository } from '../lib/auth/AuthRepository';
import type { MockAuthRepositoryOptions } from '../lib/auth/mockAuthRepository';

// Reescritura (tasks.md 5.2-5.4, route-guard spec): RequireAuth distingue loading/anonymous/
// authenticated, y con sesión activa además verifica permiso de módulo sobre la ruta (D4/D5).

function renderGuardAt(path: string, opciones?: MockAuthRepositoryOptions) {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <div>Dashboard protegido</div> },
          { path: '/pacientes', element: <div>Pacientes protegido</div> },
          { path: '/cuentas', element: <div>Cuentas protegido</div> },
        ],
      },
      { path: '/login', element: <div>Login mock</div> },
    ],
    { initialEntries: [path] },
  );

  return renderConSesion(<RouterProvider router={router} />, opciones);
}

describe('RequireAuth — anonymous/loading (tasks.md 5.2)', () => {
  it('sin sesión (anonymous) redirige a /login', async () => {
    renderGuardAt('/', { status: 'anonymous' });

    expect(await screen.findByText('Login mock')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard protegido')).not.toBeInTheDocument();
  });

  it('con sesión y permiso renderiza el <Outlet>', async () => {
    renderGuardAt('/pacientes');

    expect(await screen.findByText('Pacientes protegido')).toBeInTheDocument();
  });
});

describe('RequireAuth — sin permiso sobre el módulo (tasks.md 5.4)', () => {
  it('autenticado sin permiso sobre el módulo de la ruta muestra acceso denegado, no redirige', async () => {
    renderGuardAt('/pacientes', {
      usuario: { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' },
      permisos: {},
    });

    expect(await screen.findByRole('heading', { name: /acceso denegado/i })).toBeInTheDocument();
    expect(screen.queryByText('Pacientes protegido')).not.toBeInTheDocument();
    expect(screen.queryByText('Login mock')).not.toBeInTheDocument();
  });

  it('/cuentas con rol empleado muestra acceso denegado, aunque no tenga módulo propio', async () => {
    renderGuardAt('/cuentas', {
      usuario: { id: 'u2', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' },
      permisos: {},
    });

    expect(await screen.findByRole('heading', { name: /acceso denegado/i })).toBeInTheDocument();
    expect(screen.queryByText('Cuentas protegido')).not.toBeInTheDocument();
  });

  it('/cuentas con rol admin renderiza el <Outlet>', async () => {
    renderGuardAt('/cuentas');

    expect(await screen.findByText('Cuentas protegido')).toBeInTheDocument();
  });
});

describe('RequireAuth — sesión en restauración (route-guard spec)', () => {
  it('con status "loading" muestra un indicador y NO redirige a /login', () => {
    const repository: AuthRepository = {
      getSesionActual: () => new Promise(() => {}), // nunca resuelve: se queda en loading
      signIn: vi.fn(),
      signOut: vi.fn(),
      onCambioDeSesion: () => () => {},
    };

    const router = createMemoryRouter(
      [
        { element: <RequireAuth />, children: [{ path: '/', element: <div>Dashboard protegido</div> }] },
        { path: '/login', element: <div>Login mock</div> },
      ],
      { initialEntries: ['/'] },
    );

    render(
      <AuthProvider repository={repository}>
        <RouterProvider router={router} />
      </AuthProvider>,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('Login mock')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard protegido')).not.toBeInTheDocument();
  });
});
