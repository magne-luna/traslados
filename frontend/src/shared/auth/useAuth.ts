import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './AuthContext';

// Falla explícita si se usa fuera de AuthProvider (Decisión 3): un estado ambiguo
// (undefined tratado como "sin sesión") sería un bug silencioso más difícil de detectar.
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth() debe usarse dentro de un <AuthProvider>.');
  }
  return context;
}
