import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { AuthRepository, SesionUsuario } from '../lib/auth/AuthRepository';
import { createMockAuthRepository, USUARIO_ADMIN_MOCK, PERMISOS_TOTALES_MOCK, CREDENCIALES_MOCK_PASSWORD } from '../lib/auth/mockAuthRepository';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

// Reescritura completa (tasks.md 4.3/4.4/4.10, design.md D1/D2): AuthProvider deja de mantener
// una sesión falsa en memoria y pasa a envolver un AuthRepository inyectado, con la máquina de
// 3 estados (loading/anonymous/authenticated) — nunca session | null.

function AuthProbe() {
  const estado = useAuth();
  return (
    <div>
      <span data-testid="status">{estado.status}</span>
      {estado.status === 'authenticated' && (
        <span data-testid="usuario">{estado.usuario.nombre}</span>
      )}
      <button
        onClick={() => {
          void estado.signIn('nadie@x.com', 'lo-que-sea');
        }}
      >
        sign-in
      </button>
      <button onClick={() => void estado.signOut()}>sign-out</button>
    </div>
  );
}

/** Repositorio de control total para probar el estado `loading` — resuelve
 * `getSesionActual()` solo cuando el test lo decide, cosa que el mock rápido no permite. */
function crearRepositorioControlado(): {
  repository: AuthRepository;
  resolver: (sesion: SesionUsuario | null) => void;
} {
  let resolver: ((sesion: SesionUsuario | null) => void) | undefined;
  const promise = new Promise<SesionUsuario | null>((resolve) => {
    resolver = resolve;
  });

  const repository: AuthRepository = {
    getSesionActual: () => promise,
    signIn: vi.fn(),
    signOut: vi.fn(),
    onCambioDeSesion: () => () => {},
  };

  if (!resolver) throw new Error('el executor de la Promise corre sincrónicamente');
  return { repository, resolver };
}

describe('AuthProvider / useAuth — estado de carga (tasks.md 4.3)', () => {
  it('arranca en "loading" mientras se resuelve getSesionActual()', () => {
    const { repository } = crearRepositorioControlado();

    render(
      <AuthProvider repository={repository}>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('status').textContent).toBe('loading');
  });

  it('pasa a "anonymous" cuando no hay sesión persistida', async () => {
    const { repository, resolver } = crearRepositorioControlado();

    render(
      <AuthProvider repository={repository}>
        <AuthProbe />
      </AuthProvider>,
    );

    resolver(null);

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });

  it('pasa a "authenticated" con perfil y permisos cuando el repositorio devuelve sesión', async () => {
    const { repository, resolver } = crearRepositorioControlado();

    render(
      <AuthProvider repository={repository}>
        <AuthProbe />
      </AuthProvider>,
    );

    resolver({ usuario: USUARIO_ADMIN_MOCK, permisos: PERMISOS_TOTALES_MOCK });

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('usuario').textContent).toBe(USUARIO_ADMIN_MOCK.nombre);
  });
});

describe('AuthProvider / useAuth — signIn/signOut (tasks.md 4.5)', () => {
  it('signIn con credenciales inválidas no crea sesión y expone el error', async () => {
    const repository = createMockAuthRepository({ status: 'anonymous' });

    function Host() {
      const estado = useAuth();
      return (
        <div>
          <span data-testid="status">{estado.status}</span>
          <button
            onClick={async () => {
              const resultado = await estado.signIn('nadie@x.com', 'mala');
              if (!resultado.ok) {
                document.body.setAttribute('data-error', resultado.error);
              }
            }}
          >
            entrar
          </button>
        </div>
      );
    }

    render(
      <AuthProvider repository={repository}>
        <Host />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));

    fireEvent.click(screen.getByText('entrar'));

    await waitFor(() => expect(document.body.getAttribute('data-error')).toMatch(/credenciales inválidas/i));
    expect(screen.getByTestId('status').textContent).toBe('anonymous');
  });

  it('signOut() vuelve a "anonymous"', async () => {
    const repository = createMockAuthRepository();

    render(
      <AuthProvider repository={repository}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    fireEvent.click(screen.getByText('sign-out'));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });

  it('signIn con credenciales válidas pasa a "authenticated"', async () => {
    const repository = createMockAuthRepository({ status: 'anonymous' });

    function Host() {
      const estado = useAuth();
      return (
        <div>
          <span data-testid="status">{estado.status}</span>
          <button onClick={() => void estado.signIn(USUARIO_ADMIN_MOCK.email, CREDENCIALES_MOCK_PASSWORD)}>
            entrar
          </button>
        </div>
      );
    }

    render(
      <AuthProvider repository={repository}>
        <Host />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));

    fireEvent.click(screen.getByText('entrar'));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
  });
});

describe('AuthProvider — suscripción a onCambioDeSesion (tasks.md 4.6)', () => {
  it('se registra al montar y se cancela al desmontar, sin dejar listeners activos', () => {
    const unsubscribe = vi.fn();
    const onCambioDeSesion = vi.fn().mockReturnValue(unsubscribe);
    const repository: AuthRepository = {
      getSesionActual: () => Promise.resolve(null),
      signIn: vi.fn(),
      signOut: vi.fn(),
      onCambioDeSesion,
    };

    const { unmount } = render(
      <AuthProvider repository={repository}>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(onCambioDeSesion).toHaveBeenCalledTimes(1);
    expect(unsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('reacciona a un cambio de sesión externo (ej. cierre de sesión en otra pestaña)', async () => {
    let emitirCambio: ((sesion: SesionUsuario | null) => void) | undefined;
    const repository: AuthRepository = {
      getSesionActual: () => Promise.resolve({ usuario: USUARIO_ADMIN_MOCK, permisos: PERMISOS_TOTALES_MOCK }),
      signIn: vi.fn(),
      signOut: vi.fn(),
      onCambioDeSesion: (callback) => {
        emitirCambio = callback;
        return () => {};
      },
    };

    render(
      <AuthProvider repository={repository}>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));

    emitirCambio?.(null);

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });
});

describe('useAuth() fuera de AuthProvider', () => {
  it('lanza un error explícito', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<AuthProbe />)).toThrow();

    consoleError.mockRestore();
  });
});
