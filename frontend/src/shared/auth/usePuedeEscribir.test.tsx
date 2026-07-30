import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { RequireAuth } from './RequireAuth';
import { renderConSesion } from '../test/renderConSesion';
import { usePuedeEscribir } from './usePuedeEscribir';
import type { MockAuthRepositoryOptions } from '../lib/auth/mockAuthRepository';
import type { Usuario } from '../types/usuario';

// Tests del mecanismo compartido de gateo de escritura (tasks.md 2.1-2.4, design.md D1/D2).
// Sonda mínima: renderiza el valor del hook como texto para poder afirmar sobre él sin acoplarse
// a la presencia de una clase CSS ni al valor crudo del contexto (D7 — comportamiento observable).
function SondaPuedeEscribir() {
  const puedeEscribir = usePuedeEscribir();
  return <span>puedeEscribir:{String(puedeEscribir)}</span>;
}

const EMPLEADO_SIN_FILAS: Usuario = {
  id: 'u-empleado',
  nombre: 'Juan',
  apellido: 'Pérez',
  email: 'juan@x.com',
  rol: 'empleado',
};

const ADMIN_SIN_FILAS: Usuario = {
  id: 'u-admin',
  nombre: 'Ana',
  apellido: 'Admin',
  email: 'ana@x.com',
  rol: 'admin',
};

function renderRutaProtegida(path: string, opciones?: MockAuthRepositoryOptions) {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          { path: '/', element: <SondaPuedeEscribir /> },
          { path: '/obras-sociales', element: <SondaPuedeEscribir /> },
          { path: '/cuentas', element: <SondaPuedeEscribir /> },
          { path: '/design-system', element: <SondaPuedeEscribir /> },
        ],
      },
      { path: '/login', element: <div>Login mock</div> },
    ],
    { initialEntries: [path] },
  );

  return renderConSesion(<RouterProvider router={router} />, opciones);
}

describe('usePuedeEscribir — resolución desde el módulo de la ruta (tasks.md 2.1)', () => {
  it('cuenta con write sobre el módulo de la ruta -> true', async () => {
    renderRutaProtegida('/obras-sociales', {
      usuario: EMPLEADO_SIN_FILAS,
      permisos: { obra_social: 'write' },
    });

    expect(await screen.findByText('puedeEscribir:true')).toBeInTheDocument();
  });

  it('cuenta con solo read sobre el módulo -> false', async () => {
    renderRutaProtegida('/obras-sociales', {
      usuario: EMPLEADO_SIN_FILAS,
      permisos: { obra_social: 'read' },
    });

    expect(await screen.findByText('puedeEscribir:false')).toBeInTheDocument();
  });

  it('rol admin con nivel admin sobre el módulo -> true', async () => {
    renderRutaProtegida('/obras-sociales', {
      usuario: ADMIN_SIN_FILAS,
      permisos: { obra_social: 'admin' },
    });

    expect(await screen.findByText('puedeEscribir:true')).toBeInTheDocument();
  });
});

describe('usePuedeEscribir — short-circuit del rol admin sin filas de permisos (tasks.md 2.2)', () => {
  it('rol admin sin ninguna fila en la matriz -> true', async () => {
    renderRutaProtegida('/obras-sociales', {
      usuario: ADMIN_SIN_FILAS,
      permisos: {},
    });

    expect(await screen.findByText('puedeEscribir:true')).toBeInTheDocument();
  });

  it('rol empleado sin ninguna fila en la matriz -> queda sin acceso de lectura, no llega a resolver escritura', async () => {
    renderRutaProtegida('/obras-sociales', {
      usuario: EMPLEADO_SIN_FILAS,
      permisos: {},
    });

    expect(await screen.findByRole('heading', { name: /acceso denegado/i })).toBeInTheDocument();
    expect(screen.queryByText('puedeEscribir:true')).not.toBeInTheDocument();
  });
});

describe('usePuedeEscribir — rutas sin módulo propio (tasks.md 2.3)', () => {
  it('Dashboard ("/") resuelve escritura permitida sin consultar la matriz', async () => {
    renderRutaProtegida('/', { usuario: EMPLEADO_SIN_FILAS, permisos: {} });

    expect(await screen.findByText('puedeEscribir:true')).toBeInTheDocument();
  });

  it('/design-system resuelve escritura permitida sin consultar la matriz', async () => {
    renderRutaProtegida('/design-system', { usuario: EMPLEADO_SIN_FILAS, permisos: {} });

    expect(await screen.findByText('puedeEscribir:true')).toBeInTheDocument();
  });

  it('/cuentas (rol admin) resuelve escritura permitida sin consultar la matriz', async () => {
    renderRutaProtegida('/cuentas', { usuario: ADMIN_SIN_FILAS, permisos: {} });

    expect(await screen.findByText('puedeEscribir:true')).toBeInTheDocument();
  });

  it('contraste: la misma cuenta sin ninguna fila queda sin acceso en una ruta con módulo propio', async () => {
    renderRutaProtegida('/obras-sociales', { usuario: EMPLEADO_SIN_FILAS, permisos: {} });

    expect(await screen.findByRole('heading', { name: /acceso denegado/i })).toBeInTheDocument();
    expect(screen.queryByText('puedeEscribir:true')).not.toBeInTheDocument();
  });
});

describe('usePuedeEscribir — sin proveedor por encima (tasks.md 2.4)', () => {
  it('montado sin ningún RequireAuth por encima -> true', () => {
    render(<SondaPuedeEscribir />);

    expect(screen.getByText('puedeEscribir:true')).toBeInTheDocument();
  });
});

describe('usePuedeEscribir — punto de inyección en RequireAuth (tasks.md 2.5)', () => {
  function NietoConsumidor() {
    return (
      <div>
        <HijoIntermedio />
      </div>
    );
  }

  function HijoIntermedio() {
    return <SondaPuedeEscribir />;
  }

  it('un componente hijo profundo recibe el permiso correcto sin recibirlo por props', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [{ path: '/obras-sociales', element: <NietoConsumidor /> }],
        },
      ],
      { initialEntries: ['/obras-sociales'] },
    );

    renderConSesion(<RouterProvider router={router} />, {
      usuario: EMPLEADO_SIN_FILAS,
      permisos: { obra_social: 'read' },
    });

    expect(await screen.findByText('puedeEscribir:false')).toBeInTheDocument();
  });

  it('dos rutas de módulos distintos en la misma sesión resuelven cada una su propio permiso', async () => {
    const router = createMemoryRouter(
      [
        {
          element: <RequireAuth />,
          children: [
            { path: '/obras-sociales', element: <SondaPuedeEscribir /> },
            { path: '/pacientes', element: <SondaPuedeEscribir /> },
          ],
        },
      ],
      { initialEntries: ['/pacientes'] },
    );

    renderConSesion(<RouterProvider router={router} />, {
      usuario: EMPLEADO_SIN_FILAS,
      permisos: { obra_social: 'read', pacientes: 'write' },
    });

    expect(await screen.findByText('puedeEscribir:true')).toBeInTheDocument();
  });
});
