import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppShell } from './AppShell';
import { APP_ROUTES } from './routes';

function renderShellAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <AppShell />,
        children: APP_ROUTES.map((route) => ({
          path: route.path === '/' ? undefined : route.path.slice(1),
          index: route.path === '/',
          element: <div>{route.label} screen</div>,
        })),
      },
    ],
    { initialEntries: [path] },
  );

  return render(<RouterProvider router={router} />);
}

describe('AppShell', () => {
  it('renderiza los ítems de navegación de routes.ts', () => {
    renderShellAt('/');

    for (const route of APP_ROUTES) {
      expect(screen.getByRole('link', { name: new RegExp(route.label) })).toBeInTheDocument();
    }
  });

  it('resalta el ítem de navegación correspondiente a la ruta activa', () => {
    renderShellAt('/obras-sociales');

    const activeLink = screen.getByRole('link', { name: /Obras Sociales/ });
    const dashboardLink = screen.getByRole('link', { name: /Dashboard/ });

    expect(activeLink).toHaveAttribute('aria-current', 'page');
    expect(dashboardLink).not.toHaveAttribute('aria-current', 'page');
  });

  it('renderiza el contenido de la ruta hija dentro del Outlet', () => {
    renderShellAt('/vehiculos');

    expect(screen.getByText('Vehículos screen')).toBeInTheDocument();
  });
});

describe('AppShell — sidebar colapsable en desktop', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('al colapsar oculta las etiquetas de texto de los NavLink, y al expandir las vuelve a mostrar', async () => {
    const user = userEvent.setup();
    renderShellAt('/');

    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /colapsar navegación/i }));

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /expandir navegación/i }));

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('cada NavLink expone el nombre del módulo vía aria-label cuando el sidebar está colapsado', async () => {
    const user = userEvent.setup();
    renderShellAt('/');

    await user.click(screen.getByRole('button', { name: /colapsar navegación/i }));

    for (const route of APP_ROUTES) {
      expect(screen.getByRole('link', { name: route.label })).toBeInTheDocument();
    }
  });

  it('persiste la preferencia de colapso en localStorage y la lee al montar', async () => {
    const user = userEvent.setup();
    renderShellAt('/');

    await user.click(screen.getByRole('button', { name: /colapsar navegación/i }));

    expect(localStorage.getItem('sidebar-collapsed')).toBe('true');

    renderShellAt('/');

    expect(screen.getAllByRole('button', { name: /expandir navegación/i })[0]).toBeInTheDocument();
  });
});

describe('AppShell — barra superior móvil', () => {
  it('el botón de menú vive dentro de una barra superior fija (no flotando suelto), con el ícono centrado', () => {
    renderShellAt('/');

    const toggle = screen.getByRole('button', { name: /abrir navegación/i });
    const header = toggle.closest('header');

    expect(header).not.toBeNull();
    expect(header?.className).toMatch(/\bmd:hidden\b/);
    expect(toggle.className).toMatch(/\bitems-center\b/);
    expect(toggle.className).toMatch(/\bjustify-center\b/);
  });

  it('reserva en el contenido exactamente el alto de la barra superior en mobile, y lo libera en desktop', () => {
    const { container } = renderShellAt('/');

    const main = container.querySelector('main');

    expect(main?.className).toMatch(/\bpt-14\b/);
    expect(main?.className).toMatch(/\bmd:pt-0\b/);
  });

  it('separa la barra del contenido con un borde en <main> (no en el header), para que el drawer abierto lo tape en vez de superponerse', () => {
    renderShellAt('/');

    const toggle = screen.getByRole('button', { name: /abrir navegación/i });
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

    await user.click(screen.getByRole('button', { name: /abrir navegación/i }));

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('vuelve a colapsar el sidebar (sin etiquetas) al ensanchar la ventana a tamaño desktop', async () => {
    localStorage.setItem('sidebar-collapsed', 'true');
    window.innerWidth = 375;
    window.dispatchEvent(new Event('resize'));

    const user = userEvent.setup();
    renderShellAt('/');

    await user.click(screen.getByRole('button', { name: /abrir navegación/i }));
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    window.innerWidth = 1280;
    window.dispatchEvent(new Event('resize'));

    await waitFor(() => {
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });
  });
});
