import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthRepository } from '../lib/auth/AuthRepository';
import type { EstadoAuth } from '../types/usuario';

// Reescritura completa (tasks.md 4.4, design.md D1/D2): reemplaza el mock en memoria (session
// falsa siempre activa salvo VITE_DEMO_MODE) por un AuthRepository inyectado por prop, con la
// máquina de 3 estados (loading/anonymous/authenticated) — nunca session | null. La restauración
// de sesión con Supabase es asíncrona; sin el estado `loading` explícito, un refresh de página
// expulsaría al usuario a /login antes de que la sesión se rehidrate.

export type SignInResult = { ok: true } | { ok: false; error: string };

export type AuthContextValue = EstadoAuth & {
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

interface AuthProviderProps {
  /** Inyectado por el composition root (design.md D1): SupabaseAuthRepository en producción
   * (ver App.tsx), createMockAuthRepository(...) en tests (ver renderConSesion). */
  repository: AuthRepository;
  children: ReactNode;
}

export function AuthProvider({ repository, children }: AuthProviderProps) {
  const [estado, setEstado] = useState<EstadoAuth>({ status: 'loading' });

  useEffect(() => {
    let montado = true;

    function aplicarSesion(sesion: Awaited<ReturnType<AuthRepository['getSesionActual']>>) {
      if (!montado) return;
      setEstado(
        sesion ? { status: 'authenticated', usuario: sesion.usuario, permisos: sesion.permisos } : { status: 'anonymous' },
      );
    }

    repository.getSesionActual().then(aplicarSesion);

    // tasks.md 4.6: la suscripción se registra al montar y se cancela al desmontar — react-
    // best-practices exige nunca dejar listeners colgados.
    const unsubscribe = repository.onCambioDeSesion(aplicarSesion);

    return () => {
      montado = false;
      unsubscribe();
    };
  }, [repository]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<SignInResult> => {
      try {
        const sesion = await repository.signIn(email, password);
        setEstado({ status: 'authenticated', usuario: sesion.usuario, permisos: sesion.permisos });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'No se pudo iniciar sesión.' };
      }
    },
    [repository],
  );

  const signOut = useCallback(async () => {
    await repository.signOut();
    setEstado({ status: 'anonymous' });
  }, [repository]);

  const value = useMemo<AuthContextValue>(
    () => ({ ...estado, signIn, signOut }),
    [estado, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
