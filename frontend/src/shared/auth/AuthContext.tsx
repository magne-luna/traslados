import { createContext, useCallback, useMemo, useState, type ReactNode } from 'react';

// Auth mock — Decisión 3 de openspec/changes/app-shell-navegacion/design.md: Context en
// memoria, solo presencia/ausencia de sesión + usuario falso (SIN roles ni permisos por
// módulo, eso lo resuelve el backend real en FE-8). Arranca logueado por defecto para no
// bloquear el desarrollo del resto del frontend. Excepción: con VITE_DEMO_MODE=true (build de
// demo) arranca deslogueado para mostrar el LoginPage al entrar; el dev normal no se ve afectado.

export interface Session {
  user: {
    id: string;
    nombre: string;
    email: string;
  };
}

export interface AuthContextValue {
  session: Session | null;
  signIn: () => void;
  signOut: () => void;
}

const FAKE_SESSION: Session = {
  user: { id: 'mock-user-1', nombre: 'Andrea Pastor', email: 'andrea@traslados.mock' },
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const startsLoggedIn = import.meta.env.VITE_DEMO_MODE !== 'true';
  const [session, setSession] = useState<Session | null>(startsLoggedIn ? FAKE_SESSION : null);

  const signIn = useCallback(() => setSession(FAKE_SESSION), []);
  const signOut = useCallback(() => setSession(null), []);

  const value = useMemo<AuthContextValue>(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
