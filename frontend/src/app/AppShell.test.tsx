import { afterEach, describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppShell } from './AppShell';
import { APP_ROUTES } from './routes';
import { renderConSesion } from '../shared/test/renderConSesion';
import type { MockAuthRepositoryOptions } from '../shared/lib/auth/mockAuthRepository';
import type { Usuario } from '../shared/types/usuario';

// AppShell ahora depende de useAuth() (tasks.md 8.1-8.4, design.md D10): la navegación se filtra
// con tienePermiso(...), /cuentas aparece solo para admin, y el sidebar muestra identidad +
// cierre de sesión. Todos los renders pasan por renderConSesion (design.md D11) — por defecto
// admin con todos los permisos, que preserva el comportamiento que los tests preexistentes de
// este archivo ya asumían antes de este batch.

const EMPLEADO_SOLO_PACIENTES: Usuario = {
  id: 'u2',
  nombre: 'Juan',
  apellido: 'Pérez',
  email: 'juan@x.com',
  rol: 'empleado',
};

const EMPLEADO_SIN_PERMISOS: Usuario = {
  id: 'u3',
  nombre: 'Rocío',
  apellido: 'Gómez',
  email: 'rocio@x.com',
  rol: 'empleado',
};

function renderShellAt(path: string, opciones: MockAuthRepositoryOptions = {}) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: [
          ...APP_ROUTES.map((route) => ({
            path: route.path === '/' ? undefined : route.path.slice(1),
            index: route.path === '/',
            element: <div>{route.label} screen</div>,
          })),
          { path: 'cuentas', element: <div>Cuentas screen</div> },
        ],
      },
      { path: '/login', element: <div>Login mock</div> },
    ],
    { initialEntries: [path] },
  );

  return renderConSesion(<RouterProvider router={router} />, opciones);
}

describe('AppShell', () => {
  it('renderiza los ítems de navegación de routes.ts', async () => {
    renderShellAt('/');

    // pacientes-docs-actividad-tabs: `ocultaEnSidebar` (routes.ts) saca a "Documentación por
    // Actividad" del sidebar a propósito — ahora se llega desde el tab dentro de Pacientes
    // (PacientesDocumentacionTabs), no desde Administración.
    for (const route of APP_ROUTES.filter((r) => !r.ocultaEnSidebar)) {
      expect(await screen.findByRole('link', { name: new RegExp(route.label) })).toBeInTheDocument();
    }
  });

  it('resalta el ítem de navegación correspondiente a la ruta activa', async () => {
    renderShellAt('/obras-sociales');

    const activeLink = await screen.findByRole('link', { name: /Obras Sociales/ });
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });

    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('renderiza el contenido de la ruta hija dentro del Outlet', async () => {
    renderShellAt('/vehiculos');

    expect(await screen.findByText('Vehículos screen')).toBeInTheDocument();
  });
});

describe('AppShell — navegación filtrada por permisos (tasks.md 8.1/8.2, permisos-modulos-granulares tasks.md 5.6)', () => {
  it('oculta los módulos sobre los que la cuenta activa no tiene permiso', async () => {
    renderShellAt('/', { usuario: EMPLEADO_SOLO_PACIENTES, permisos: { pacientes: 'read' } });

    expect(await screen.findByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^Pacientes/ })).toBeInTheDocument();
    // Desde este change, 'pacientes' y 'hojas_de_ruta' son módulos independientes (design.md D1)
    // — tener uno ya no implica tener el otro, a diferencia del comportamiento agrupado anterior.
    expect(screen.queryByRole('link', { name: /Hojas de Ruta/ })).not.toBeInTheDocument();

    expect(screen.queryByRole('link', { name: /Obras Sociales/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Conductores/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Vehículos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Presupuestos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Facturación/ })).not.toBeInTheDocument();
  });

  it('con permiso solo de Conductores, ve Conductores pero NO Vehículos (triangulación del caso anterior)', async () => {
    renderShellAt('/', { usuario: EMPLEADO_SOLO_PACIENTES, permisos: { conductores: 'read' } });

    expect(await screen.findByRole('link', { name: /^Conductores/ })).toBeInTheDocument();
    // Desde este change, 'conductores' y 'vehiculos' son módulos independientes.
    expect(screen.queryByRole('link', { name: /Vehículos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Hojas de Ruta/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Pacientes/ })).not.toBeInTheDocument();
  });

  it('con permiso solo de Hojas de Ruta, ve Hojas de Ruta pero NO Pacientes (los 3 pares padre→hijo quedan desacoplados)', async () => {
    renderShellAt('/', { usuario: EMPLEADO_SOLO_PACIENTES, permisos: { hojas_de_ruta: 'read' } });

    expect(await screen.findByRole('link', { name: /Hojas de Ruta/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Pacientes/ })).not.toBeInTheDocument();
  });

  it('con permiso solo de Presupuestos, ve Presupuestos pero NO Facturación', async () => {
    renderShellAt('/', { usuario: EMPLEADO_SOLO_PACIENTES, permisos: { presupuestos: 'read' } });

    expect(await screen.findByRole('link', { name: /Presupuestos/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Facturación/ })).not.toBeInTheDocument();
  });

  it('con permiso solo de Vehículos, ve Vehículos pero NO Conductores', async () => {
    renderShellAt('/', { usuario: EMPLEADO_SOLO_PACIENTES, permisos: { vehiculos: 'read' } });

    expect(await screen.findByRole('link', { name: /Vehículos/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^Conductores/ })).not.toBeInTheDocument();
  });

  it('una cuenta con rol admin ve la entrada de administración de cuentas', async () => {
    renderShellAt('/');

    expect(await screen.findByRole('link', { name: /Cuentas/ })).toBeInTheDocument();
  });

  it('una cuenta con rol empleado no ve la entrada de administración de cuentas', async () => {
    renderShellAt('/', { usuario: EMPLEADO_SOLO_PACIENTES, permisos: { pacientes: 'admin' } });

    await screen.findByRole('link', { name: /Dashboard/ });
    expect(screen.queryByRole('link', { name: /Cuentas/ })).not.toBeInTheDocument();
  });
});

describe('AppShell — cuenta sin ningún módulo habilitado (tasks.md 8.3)', () => {
  it('muestra un mensaje pidiendo acceso a la administradora en vez de una navegación vacía', async () => {
    renderShellAt('/', { usuario: EMPLEADO_SIN_PERMISOS, permisos: {} });

    expect(await screen.findByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Pacientes/ })).not.toBeInTheDocument();
    expect(screen.getByText(/solicit.*acceso a la administradora/i)).toBeInTheDocument();
  });

  it('una cuenta admin nunca ve el mensaje de "solicitar acceso", incluso con la matriz vacía', async () => {
    renderShellAt('/', { usuario: { ...EMPLEADO_SIN_PERMISOS, rol: 'admin' }, permisos: {} });

    await screen.findByRole('link', { name: /Dashboard/ });
    expect(screen.queryByText(/solicit.*acceso a la administradora/i)).not.toBeInTheDocument();
  });
});

describe('AppShell — identidad y cierre de sesión (tasks.md 8.4)', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('muestra el nombre y el email de la cuenta autenticada', async () => {
    // El rol ya no se muestra acá (feedback de usuario: "arriba el nombre y abajo el mail, sin
    // el rol") — SidebarIdentity.tsx dejó de renderizar el Chip de rol. El nombre completo
    // tampoco: cuentas compartidas ("Facturación Pastor Traslados") no entran en el sidebar, así
    // que solo se muestra la primera palabra (ver primeraPalabra() en SidebarIdentity.tsx).
    renderShellAt('/', { usuario: EMPLEADO_SOLO_PACIENTES, permisos: { pacientes: 'read' } });

    expect(await screen.findByText('Juan')).toBeInTheDocument();
    expect(screen.getByText('juan@x.com')).toBeInTheDocument();
  });

  it('el control de cerrar sesión cierra la sesión real y navega a /login', async () => {
    const user = userEvent.setup();
    renderShellAt('/');

    await user.click(await screen.findByRole('button', { name: /cerrar sesión/i }));

    expect(await screen.findByText('Login mock')).toBeInTheDocument();
  });

  it('el control de cerrar sesión sigue siendo accesible cuando el sidebar está colapsado', async () => {
    const user = userEvent.setup();
    renderShellAt('/');

    await user.click(await screen.findByRole('button', { name: /colapsar navegación/i }));

    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
  });
});

describe('AppShell — sidebar colapsable en desktop', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('al colapsar oculta las etiquetas de texto de los NavLink, y al expandir las vuelve a mostrar', async () => {
    const user = userEvent.setup();
    renderShellAt('/');

    expect(await screen.findByText('Dashboard')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /colapsar navegación/i }));

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expandir navegación/i }));

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('cada NavLink expone el nombre del módulo vía aria-label cuando el sidebar está colapsado', async () => {
    const user = userEvent.setup();
    renderShellAt('/');

    await screen.findByText('Dashboard');
    await user.click(screen.getByRole('button', { name: /colapsar navegación/i }));

    for (const route of APP_ROUTES.filter((r) => !r.ocultaEnSidebar)) {
      expect(screen.getByRole('link', { name: route.label })).toBeInTheDocument();
    }
  });

  it('persiste la preferencia de colapso en localStorage y la lee al montar', async () => {
    const user = userEvent.setup();
    renderShellAt('/');

    await screen.findByText('Dashboard');
    await user.click(screen.getByRole('button', { name: /colapsar navegación/i }));

    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');

    renderShellAt('/');

    expect(screen.getAllByRole('button', { name: /expandir navegación/i })[0]).toBeInTheDocument();
  });
});

describe('AppShell — barra superior móvil', () => {
  it('el botón de menú vive dentro de una barra superior fija (no flotando suelto), con el ícono centrado', async () => {
    renderShellAt('/');

    const toggle = await screen.findByRole('button', { name: /abrir navegación/i });
    const header = toggle.closest('header');

    expect(header).not.toBeNull();
    expect(header?.className).toMatch(/\bmd:hidden\b/);
    expect(toggle.className).toMatch(/\bitems-center\b/);
    expect(toggle.className).toMatch(/\bjustify-center\b/);
  });

  it('reserva en el contenido exactamente el alto de la barra superior en mobile, y lo libera en desktop', async () => {
    const { container } = renderShellAt('/');

    await screen.findByText('Dashboard');
    const main = container.querySelector('main');

    expect(main?.className).toMatch(/\bpt-14\b/);
    expect(main?.className).toMatch(/\bmd:pt-0\b/);
  });

  it('separa la barra del contenido con un borde en <main> (no en el header), para que el drawer abierto lo tape en vez de superponerse', async () => {
    renderShellAt('/');

    const toggle = await screen.findByRole('button', { name: /abrir navegación/i });
    const header = toggle.closest('header');
    const main = document.querySelector('main');

    expect(header?.className).not.toMatch(/\bborder-b\b/);
    expect(main?.className).toMatch(/\bborder-t\b/);
    expect(main?.className).toMatch(/\bmd:border-t-0\b/);
  });
});

describe('AppShell — drawer móvil no debe heredar el colapso de desktop', () => {
  const originalInnerWidth = window.innerWidth;

  afterEach(() => {
    localStorage.clear();
    window.innerWidth = originalInnerWidth;
    window.dispatchEvent(new Event('resize'));
  });

  it('muestra las etiquetas de texto en el drawer móvil aunque el sidebar esté colapsado en desktop', async () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));

    const user = userEvent.setup();
    renderShellAt('/');

    await user.click(await screen.findByRole('button', { name: /abrir navegación/i }));

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('vuelve a colapsar el sidebar (sin etiquetas) al ensanchar la ventana a tamaño desktop', async () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));

    const user = userEvent.setup();
    renderShellAt('/');

    await user.click(await screen.findByRole('button', { name: /abrir navegación/i }));
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    window.innerWidth = 1280;
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });
  });
});

// render usado únicamente para confirmar que AppShell no crashea si se monta sin sesión
// autenticada (defensivo, tasks.md 8.4) — no es un escenario alcanzable en producción, donde
// RequireAuth garantiza 'authenticated' antes de montar AppShell.
describe('AppShell — defensivo fuera de una sesión autenticada', () => {
  it('no lanza y no renderiza nada si la sesión no está autenticada', () => {
    const router = createMemoryRouter([{ path: '/', element: <AppShell /> }], { initialEntries: ['/'] });

    expect(() => renderConSesion(<RouterProvider router={router} />, { status: 'anonymous' })).not.toThrow();
  });
});
