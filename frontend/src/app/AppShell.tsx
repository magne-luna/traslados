import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router';
import { NavIcon } from '../design-system/components';
import { useAuth } from '../shared/auth/useAuth';
import { SidebarIdentity } from './SidebarIdentity';
import { SidebarNav } from './SidebarNav';

// Layout raíz de la app (Decisión 2 y 6 de design.md): navegación lateral persistente +
// <Outlet> para las pantallas hijas. Construido sobre NavIcon/tokens del design system — no
// se recrean primitivos, solo se compone el layout de shell alrededor de ellos.
//
// REFACTOR (tasks.md 8.5, mantener cada componente <~200 líneas): los paths de íconos viven en
// navIcons.tsx, el filtrado de navegación por permisos en SidebarNav.tsx, y el bloque de
// identidad + cierre de sesión en SidebarIdentity.tsx. Este archivo solo compone el layout
// (header móvil, aside, botón de colapso, <main>) y resuelve la sesión activa.

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';
// Breakpoint `md` de Tailwind (768px): el toggle de colapso solo existe en desktop
// (RNF-08 / Requirement "Sidebar colapsable en desktop", escenario "Sin efecto en mobile").
const MD_BREAKPOINT_PX = 768;

function readCollapsedPreference(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
}

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= MD_BREAKPOINT_PX);

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= MD_BREAKPOINT_PX);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isDesktop;
}

export function AppShell() {
  const estado = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsedPreference);
  const isDesktop = useIsDesktop();
  // La preferencia de colapso persiste en localStorage, pero solo debe afectar el layout
  // en desktop — el drawer off-canvas de mobile siempre se muestra expandido.
  const effectiveCollapsed = collapsed && isDesktop;

  function toggleCollapsed() {
    setCollapsed((value) => {
      const next = !value;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  // Defensivo, no alcanzable en producción: RequireAuth (route-guard) solo monta AppShell con
  // `status === 'authenticated'`. El chequeo evita un crash si algún día AppShell se renderiza
  // fuera de ese guard (p. ej. un test aislado) en vez de asumirlo silenciosamente.
  if (estado.status !== 'authenticated') {
    return null;
  }

  const { usuario, permisos } = estado;

  async function handleLogout() {
    await estado.signOut();
    navigate('/login', { replace: true });
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

      {/* Barra superior móvil: aloja el botón de menú dentro de una franja fija en vez de
          flotarlo suelto, para que el espacio reservado en <main> tenga un propósito visible. */}
      <header className="fixed top-0 inset-x-0 z-50 flex h-14 items-center bg-surface px-md md:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen((open) => !open)}
          className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-ink"
          aria-label={mobileNavOpen ? 'Cerrar navegación' : 'Abrir navegación'}
        >
          <NavIcon>
            <line x1={3} y1={6} x2={21} y2={6} />
            <line x1={3} y1={12} x2={21} y2={12} />
            <line x1={3} y1={18} x2={21} y2={18} />
          </NavIcon>
        </button>
      </header>

      <aside
        id="sidebar"
        className={`fixed top-0 bottom-0 left-0 z-40 flex shrink-0 flex-col gap-xs overflow-hidden border-r border-sidebar-border bg-sidebar-bg px-lg pt-14 pb-lg transition-[transform,width] duration-200 ease-[ease] md:translate-x-0 md:pt-lg ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'} ${effectiveCollapsed ? 'w-18' : 'w-56'}`}
      >
        <div className={`mt-1 mb-lg flex items-center gap-sm ${effectiveCollapsed ? 'justify-center' : ''}`}>
          <div className="flex min-w-0 items-center gap-sm">
            <img
              src="/logo.jpeg"
              alt="Pastor Traslados"
              className="h-8 w-8 shrink-0 rounded-full object-cover"
            />
            {!effectiveCollapsed && (
              <span className="truncate font-heading text-base font-bold text-ink">Pastor Traslados</span>
            )}
          </div>
        </div>

        <SidebarNav
          rol={usuario.rol}
          permisos={permisos}
          collapsed={effectiveCollapsed}
          onNavigate={() => setMobileNavOpen(false)}
        />

        <SidebarIdentity usuario={usuario} collapsed={effectiveCollapsed} onLogout={() => void handleLogout()} />
      </aside>

      {/* Chevron de colapso, a caballo entre el borde del sidebar y el contenido — vive fuera
          del <aside> (que tiene overflow-hidden) para no quedar recortado, y se posiciona en
          `left` según el ancho actual del sidebar. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        className={`fixed top-9 z-50 hidden h-7 w-7 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-sidebar-border bg-surface text-sidebar-text shadow-card transition-[left] duration-200 ease-[ease] md:inline-flex ${effectiveCollapsed ? 'left-18' : 'left-56'}`}
        aria-label={collapsed ? 'Expandir navegación' : 'Colapsar navegación'}
      >
        <NavIcon>
          {collapsed ? <polyline points="9 6 15 12 9 18" /> : <polyline points="15 6 9 12 15 18" />}
        </NavIcon>
      </button>

      {/* pt-14: mismo alto que la barra superior móvil (h-14), liberado en desktop. El borde
          separador va acá (no en el header, que es `fixed` y quedaría pintado por encima del
          drawer abierto) — al estar `main` en flujo normal, el drawer opaco lo tapa sin costuras. */}
      <main
        className={`min-w-0 flex-1 border-t border-border-strong pt-14 md:border-t-0 md:pt-0 ${effectiveCollapsed ? 'md:ml-18' : 'md:ml-56'}`}
      >
        <Outlet />
      </main>
    </div>
  );
}
