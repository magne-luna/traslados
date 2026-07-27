import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import { NavIcon } from '../design-system/components';
import { APP_ROUTES, type AppRoute, type IconKey, type NavSection } from './routes';

// Layout raíz de la app (Decisión 2 y 6 de design.md): navegación lateral persistente +
// <Outlet> para las pantallas hijas. Construido sobre NavIcon/tokens del design system — no
// se recrean primitivos, solo se compone el layout de shell alrededor de ellos.

const iconPaths: Record<IconKey, ReactNode> = {
  dashboard: (
    <>
      <rect x={3} y={3} width={7} height={9} rx={1} />
      <rect x={14} y={3} width={7} height={5} rx={1} />
      <rect x={14} y={12} width={7} height={9} rx={1} />
      <rect x={3} y={16} width={7} height={5} rx={1} />
    </>
  ),
  obrasSociales: (
    <>
      <rect x={2} y={5} width={20} height={14} rx={2} />
      <line x1={2} y1={10} x2={22} y2={10} />
      <line x1={6} y1={15} x2={10} y2={15} />
    </>
  ),
  vehiculos: (
    <>
      <path
        d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={7} cy={17} r={2} />
      <path d="M9 17h6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={17} cy={17} r={2} />
    </>
  ),
  pacientes: (
    <path
      d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm11 10v-2a4 4 0 0 0-3-3.87m-4-12a4 4 0 0 1 0 7.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  conductores: (
    <>
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21c0-3.5 3.5-6 8-6s8 2.5 8 6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  presupuestos: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
      <polyline points="14 2 14 8 20 8" />
      <line x1={16} y1={13} x2={8} y2={13} />
      <line x1={16} y1={17} x2={8} y2={17} />
    </>
  ),
  hojasDeRuta: (
    <path d="M9 20 3 17V4l6 3 6-3 6 3v13l-6-3-6 3zM9 7v13m6-16v13" strokeLinecap="round" strokeLinejoin="round" />
  ),
  facturacion: (
    <>
      <line x1={12} y1={1} x2={12} y2={23} />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
};

// Agrupa APP_ROUTES por sección preservando el orden de aparición (define el orden de las
// secciones en el sidebar y en el menú móvil).
const navGroups: Array<[NavSection, AppRoute[]]> = Array.from(
  APP_ROUTES.reduce((groups, route) => {
    const routes = groups.get(route.section) ?? [];
    routes.push(route);
    groups.set(route.section, routes);
    return groups;
  }, new Map<NavSection, AppRoute[]>()),
);

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

function readCollapsedPreference(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

export function AppShell() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Overlay móvil: cierra el drawer al tocar fuera de la nav (RNF-08). */}
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-[rgba(27,43,42,0.35)] md:hidden"
        />
      )}

      <button
        type="button"
        onClick={() => setMobileNavOpen((open) => !open)}
        className="fixed top-md left-md z-50 h-10 w-10 cursor-pointer rounded-md border border-border-strong bg-surface text-ink md:hidden"
        aria-label={mobileNavOpen ? 'Cerrar navegación' : 'Abrir navegación'}
      >
        <NavIcon>
          <line x1={3} y1={6} x2={21} y2={6} />
          <line x1={3} y1={12} x2={21} y2={12} />
          <line x1={3} y1={18} x2={21} y2={18} />
        </NavIcon>
      </button>

      <aside
        id="sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 flex shrink-0 flex-col gap-xs overflow-hidden border-r border-sidebar-border bg-sidebar-bg p-lg transition-[transform,width] duration-200 ease-[ease] md:translate-x-0 ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'w-18' : 'w-56'}`}
      >
        <div
          className={`mt-1 mb-lg flex items-center gap-sm ${collapsed ? 'justify-center' : 'justify-between'}`}
        >
          {!collapsed && (
            <div className="font-heading text-base font-bold whitespace-nowrap text-ink">Pastor Traslados</div>
          )}

          <button
            type="button"
            onClick={toggleCollapsed}
            className="hidden h-7 w-7 cursor-pointer items-center justify-center rounded-sm border border-sidebar-border bg-transparent text-sidebar-text md:inline-flex"
            aria-label={collapsed ? 'Expandir navegación' : 'Colapsar navegación'}
          >
            <NavIcon>
              {collapsed ? (
                <polyline points="9 6 15 12 9 18" />
              ) : (
                <polyline points="15 6 9 12 15 18" />
              )}
            </NavIcon>
          </button>
        </div>

        <nav className="flex flex-col gap-xl">
          {navGroups.map(([section, routes]) => (
            <div key={section}>
              <div
                className={`flex items-center gap-sm pb-sm ${collapsed ? 'justify-center px-sm' : 'px-md'}`}
              >
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
                    <NavLink
                      to={route.path}
                      end={route.path === '/'}
                      aria-label={collapsed ? route.label : undefined}
                      title={collapsed ? route.label : undefined}
                      className={({ isActive }) =>
                        `nav-item flex items-center gap-sm rounded-sm px-md py-sm font-body text-[13px] font-semibold whitespace-nowrap no-underline ${
                          collapsed ? 'justify-center' : 'justify-start'
                        } ${
                          isActive
                            ? 'bg-surface-soft text-sidebar-text-active shadow-[inset_2px_0_0_var(--color-primary-soft)]'
                            : 'bg-transparent text-sidebar-text shadow-none'
                        }`
                      }
                      onClick={() => setMobileNavOpen(false)}
                    >
                      <NavIcon>{iconPaths[route.icon]}</NavIcon>
                      {!collapsed && route.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <main className={`min-w-0 flex-1 ${collapsed ? 'md:ml-18' : 'md:ml-56'}`}>
        <Outlet />
      </main>
    </div>
  );
}
