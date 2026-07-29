import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './useAuth';
import { moduloDeRuta, requiereRolAdmin } from '../../app/routes';
import { tienePermiso } from '../lib/auth/permisos';
import { AccesoDenegado } from '../components/AccesoDenegado';

// Reescritura (tasks.md 5.3, route-guard spec, design.md D2/D4/D6): distingue loading/anonymous/
// authenticated. Con sesión activa, además verifica el módulo asociado a la ruta (app/routes.ts)
// y, para /cuentas, el rol admin. Sin permiso ⇒ AccesoDenegado dentro del shell, nunca un
// redirect silencioso (D6).
export function RequireAuth() {
  const estado = useAuth();
  const location = useLocation();

  if (estado.status === 'loading') {
    return (
      <p role="status" className="p-xl font-body text-sm text-muted">
        Cargando sesión…
      </p>
    );
  }

  if (estado.status === 'anonymous') {
    const destino = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?destino=${destino}`} replace />;
  }

  const modulo = moduloDeRuta(location.pathname);

  // Ruta no declarada en app/routes.ts: tratar como sin acceso, nunca como "sin módulo"
  // (moduloDeRuta devuelve undefined a propósito para distinguir este caso de `null`).
  if (modulo === undefined) {
    return <AccesoDenegado />;
  }

  if (requiereRolAdmin(location.pathname) && estado.usuario.rol !== 'admin') {
    return <AccesoDenegado />;
  }

  if (modulo !== null && !tienePermiso(estado.usuario.rol, estado.permisos, modulo, 'read')) {
    return <AccesoDenegado />;
  }

  return <Outlet />;
}
