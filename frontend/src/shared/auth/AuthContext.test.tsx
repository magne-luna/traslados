import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { useAuth } from './useAuth';

// Test host: expone el estado de useAuth() en el DOM para poder asertar sobre él
// y dispara signIn()/signOut() vía botones.
function AuthProbe() {
  const { session, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="session-state">{session ? `logged-in:${session.user.nombre}` : 'logged-out'}</span>
      <button onClick={signOut}>sign-out</button>
      <button onClick={signIn}>sign-in</button>
    </div>
  );
}

describe('AuthProvider / useAuth', () => {
  it('arranca con una sesión falsa (logueado) por defecto', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('session-state').textContent).toMatch(/^logged-in:/);
  });

  it('signOut() deja session: null', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('sign-out'));

    expect(screen.getByTestId('session-state').textContent).toBe('logged-out');
  });

  it('signIn() restaura la sesión luego de un signOut()', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText('sign-out'));
    fireEvent.click(screen.getByText('sign-in'));

    expect(screen.getByTestId('session-state').textContent).toMatch(/^logged-in:/);
  });

  it('useAuth() fuera de AuthProvider lanza un error explícito', () => {
    // Silenciar el console.error que React emite por el throw durante el render.
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<AuthProbe />)).toThrow();

    consoleError.mockRestore();
  });
});
