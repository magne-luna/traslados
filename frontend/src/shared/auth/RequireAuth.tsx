import { Navigate, Outlet } from 'react-router';
import { useAuth } from './useAuth';

// Decisión 4 de design.md: guard como wrapper de ruta, solo verifica autenticación
// (presencia de sesión), no roles ni permisos por módulo.
export function RequireAuth() {
  const { session } = useAuth();

  if (session === null) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
