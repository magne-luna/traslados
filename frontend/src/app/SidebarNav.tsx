import { NavLink } from 'react-router';
import { NavIcon, Tooltip } from '../design-system/components';
import { Alert } from '../design-system/feedback';
import { tienePermiso } from '../shared/lib/auth/permisos';
import { iconPaths } from './navIcons';
import { ADMIN_NAV_ROUTES, APP_ROUTES, type AppRoute, type NavItem, type NavSection } from './routes';
import type { MapaPermisos, Modulo, Rol } from '../shared/types/usuario';

// Navegación del sidebar (extraído de AppShell.tsx en el REFACTOR de tasks.md 8.5, implementado
// en tasks.md 8.1-8.3, permisos-modulo-frontend spec "Navegación filtrada por permisos" /
// "Cuenta sin ningún módulo habilitado"): filtra APP_ROUTES con tienePermiso(...) y agrega la
// entrada de /cuentas solo para rol admin. Si a una cuenta no-admin no le queda ningún módulo
// habilitado, muestra un aviso en vez de un sidebar en blanco sin explicación.
//
// IMPORTANTE (security-review, tasks.md 8.8, permisos-modulo-frontend spec "El control de
// permisos del cliente no sustituye a la RLS"): este filtrado es UX, no una frontera de
// seguridad — solo evita mostrarle a la cuenta activa enlaces a pantallas a las que igual no
// podría entrar. La autorización efectiva la impone la RLS del servidor en cada tabla de
// dominio vía `modulos.tiene_permiso()` (mismo principio documentado en `shared/lib/auth/
// permisos.ts` y `shared/auth/usePermiso.ts`). Un cliente parcheado que reconstruya este menú a
// mano no obtiene ni una fila más de datos de las que la RLS le permite.

interface SidebarNavProps {
  rol: Rol;
  permisos: MapaPermisos;
  collapsed: boolean;
  onNavigate: () => void;
}

function agruparPorSeccion(items: readonly NavItem[]): Array<[NavSection, NavItem[]]> {
  const grupos = items.reduce((acc, item) => {
    const lista = acc.get(item.section) ?? [];
    lista.push(item);
    acc.set(item.section, lista);
    return acc;
  }, new Map<NavSection, NavItem[]>());

  return Array.from(grupos);
}

export function SidebarNav({ rol, permisos, collapsed, onNavigate }: SidebarNavProps) {
  const rutasConModulo = APP_ROUTES.filter(
    (route): route is AppRoute & { modulo: Modulo } => route.modulo !== null,
  );
  // `ocultaEnSidebar` (pacientes-docs-actividad-tabs) filtra solo el renderizado del sidebar —
  // `rutasConModulo`/`sinAccesoAModulos` más abajo siguen leyendo de APP_ROUTES sin este filtro,
  // así que una cuenta con permiso únicamente sobre ese módulo no ve el aviso de "sin acceso".
  const rutasVisibles = APP_ROUTES.filter(
    (route) => route.modulo === null || tienePermiso(rol, permisos, route.modulo, 'read'),
  ).filter((route) => !route.ocultaEnSidebar);
  const rutasAdmin = rol === 'admin' ? ADMIN_NAV_ROUTES : [];

  // "Cuenta sin ningún módulo habilitado" (tasks.md 8.3): sin esto, una cuenta empleado recién
  // creada (sin ninguna fila en modulos.permisos) ve solo "Dashboard" sin ninguna pista de por
  // qué el resto de la navegación no está. Nunca aplica a admin (D5: short-circuit siempre true).
  const sinAccesoAModulos =
    rol !== 'admin' && !rutasConModulo.some((route) => tienePermiso(rol, permisos, route.modulo, 'read'));

  const navGroups = agruparPorSeccion([...rutasVisibles, ...rutasAdmin]);

  return (
    <nav className="flex flex-col gap-xl">
      {navGroups.map(([section, routes]) => (
        <div key={section}>
          <div className={`flex items-center gap-sm pb-sm ${collapsed ? 'justify-center px-sm' : 'px-md'}`}>
            {!collapsed && (
              <span className="font-body text-[10px] font-bold whitespace-nowrap tracking-[0.08em] text-muted uppercase">
                {section}
              </span>
            )}
            <span className={`h-px bg-sidebar-border ${collapsed ? 'w-8' : 'flex-1'}`} />
          </div>
          <ul className="nav-list m-0 flex list-none flex-col gap-md p-0">
            {routes.map((route) => (
              <li key={route.path}>
                <Tooltip label={route.label} disabled={!collapsed}>
                  <NavLink
                    to={route.path}
                    end={route.path === '/'}
                    aria-label={collapsed ? route.label : undefined}
                    className={({ isActive }) =>
                      `nav-item flex items-center gap-sm rounded-sm px-md py-sm font-body text-[13px] whitespace-nowrap no-underline hover:bg-surface-soft/50 ${
                        collapsed ? 'justify-center' : 'justify-start'
                      } ${
                        isActive
                          ? 'bg-surface-soft text-sidebar-text-active shadow-[inset_2px_0_0_var(--color-primary-soft)]'
                          : 'bg-transparent text-sidebar-text shadow-none'
                      }`
                    }
                    onClick={onNavigate}
                  >
                    <NavIcon>{iconPaths[route.icon]}</NavIcon>
                    {!collapsed && route.label}
                  </NavLink>
                </Tooltip>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {!collapsed && sinAccesoAModulos && (
        <div className="px-md">
          <Alert tone="info" size="sm">
            Todavía no tenés acceso a ningún módulo. Solicitá acceso a la administradora.
          </Alert>
        </div>
      )}
    </nav>
  );
}
