import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { LoginPage } from './LoginPage';
import { useAuth } from '../../shared/auth/useAuth';
import { getCuentasDePrueba } from './testAccounts';

vi.mock('../../shared/auth/useAuth');
vi.mock('./testAccounts');
const mockedUseAuth = vi.mocked(useAuth);
const mockedGetCuentasDePrueba = vi.mocked(getCuentasDePrueba);

function renderLoginAt(initialEntry: string, signIn = vi.fn()) {
  const router = createMemoryRouter(
    [
      { path: '/login', element: <LoginPage /> },
      { path: '/', element: <div>Dashboard</div> },
      { path: '/facturacion', element: <div>Facturación</div> },
    ],
    { initialEntries: [initialEntry] },
  );

  return { ...render(<RouterProvider router={router} />), signIn };
}

// Reescritura (tasks.md 5.6/5.7, route-guard spec): lee email/contraseña reales del formulario,
// invoca signIn(email, password) y solo navega tras un login efectivo — borrado el hack de demo
// (DEMO_EMAIL/DEMO_PASSWORD/defaultValue).

beforeEach(() => {
  mockedGetCuentasDePrueba.mockReturnValue([]);
});

describe('LoginPage — login con credenciales válidas', () => {
  it('lee email y contraseña del formulario, invoca signIn(email, password) y navega al Dashboard', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ ok: true });
    mockedUseAuth.mockReturnValue({ status: 'anonymous', signIn, signOut: vi.fn() });

    renderLoginAt('/login');

    await user.type(screen.getByLabelText(/email/i), 'andrea@traslados.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'secreta123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(signIn).toHaveBeenCalledWith('andrea@traslados.com', 'secreta123');
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });

  it('navega al destino guardado en el query param "destino" en vez del Dashboard', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ ok: true });
    mockedUseAuth.mockReturnValue({ status: 'anonymous', signIn, signOut: vi.fn() });

    renderLoginAt('/login?destino=%2Ffacturacion');

    await user.type(screen.getByLabelText(/email/i), 'andrea@traslados.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'secreta123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    await waitFor(() => expect(screen.getByText('Facturación')).toBeInTheDocument());
  });
});

describe('LoginPage — credenciales inválidas', () => {
  it('muestra un mensaje de error, permanece en /login y no crea sesión', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ ok: false, error: 'Credenciales inválidas.' });
    mockedUseAuth.mockReturnValue({ status: 'anonymous', signIn, signOut: vi.fn() });

    renderLoginAt('/login');

    await user.type(screen.getByLabelText(/email/i), 'andrea@traslados.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'mala');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/credenciales inválidas/i);
    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});

describe('LoginPage — envío en curso', () => {
  it('deshabilita el botón mientras la autenticación está en curso', async () => {
    const user = userEvent.setup();
    let resolverSignIn: (value: { ok: true }) => void = () => {};
    const signIn = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolverSignIn = resolve;
      }),
    );
    mockedUseAuth.mockReturnValue({ status: 'anonymous', signIn, signOut: vi.fn() });

    renderLoginAt('/login');

    await user.type(screen.getByLabelText(/email/i), 'andrea@traslados.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'secreta123');
    await user.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(screen.getByRole('button', { name: /ingres/i })).toBeDisabled();

    resolverSignIn({ ok: true });
    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
  });
});

describe('LoginPage — campos vacíos', () => {
  it('con campos vacíos, señala el error y no invoca signIn()', () => {
    const signIn = vi.fn();
    mockedUseAuth.mockReturnValue({ status: 'anonymous', signIn, signOut: vi.fn() });

    renderLoginAt('/login');

    fireEvent.click(screen.getByRole('button', { name: /ingresar/i }));

    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('LoginPage — usuario ya autenticado', () => {
  it('redirige al Dashboard en vez de mostrar el formulario', async () => {
    mockedUseAuth.mockReturnValue({
      status: 'authenticated',
      usuario: { id: '1', nombre: 'Andrea', apellido: 'Pastor', email: 'andrea@x.com', rol: 'admin' },
      permisos: {},
      signIn: vi.fn(),
      signOut: vi.fn(),
    });

    renderLoginAt('/login');

    await waitFor(() => expect(screen.getByText('Dashboard')).toBeInTheDocument());
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument();
  });
});

describe('LoginPage — sin hack de demo', () => {
  it('no precarga ningún valor en los campos de email/contraseña', () => {
    mockedUseAuth.mockReturnValue({ status: 'anonymous', signIn: vi.fn(), signOut: vi.fn() });

    renderLoginAt('/login');

    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    const passwordInput = screen.getByLabelText(/contraseña/i) as HTMLInputElement;

    expect(emailInput.value).toBe('');
    expect(passwordInput.value).toBe('');
    expect(passwordInput.type).toBe('password');
  });
});

describe('LoginPage — botones de cuentas de prueba', () => {
  it('no muestra ningún botón si no hay cuentas de prueba configuradas', () => {
    mockedUseAuth.mockReturnValue({ status: 'anonymous', signIn: vi.fn(), signOut: vi.fn() });
    mockedGetCuentasDePrueba.mockReturnValue([]);

    renderLoginAt('/login');

    expect(screen.queryByText(/cuentas de prueba/i)).not.toBeInTheDocument();
  });

  it('rellena el email y la contraseña al hacer click, sin loguear automáticamente', async () => {
    const user = userEvent.setup();
    const signIn = vi.fn().mockResolvedValue({ ok: true });
    mockedUseAuth.mockReturnValue({ status: 'anonymous', signIn, signOut: vi.fn() });
    mockedGetCuentasDePrueba.mockReturnValue([
      { label: 'Admin', email: 'andrea.test@gmail.com', password: '123456' },
      { label: 'Facturación', email: 'facturacion@pastor.com', password: 'facturacion' },
    ]);

    renderLoginAt('/login');

    await user.click(screen.getByRole('button', { name: 'Facturación' }));

    expect(screen.getByLabelText(/email/i)).toHaveValue('facturacion@pastor.com');
    expect(screen.getByLabelText(/contraseña/i)).toHaveValue('facturacion');
    expect(signIn).not.toHaveBeenCalled();
  });
});
