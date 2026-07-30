import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { Conductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import type { Usuario, MapaPermisos } from '../../shared/types/usuario';
import { ConductorRepositoryProvider } from './ConductorRepositoryContext';
import { VehiculoRepositoryProvider } from '../vehiculos/VehiculoRepositoryContext';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { RequireAuth } from '../../shared/auth/RequireAuth';
import { renderConSesion } from '../../shared/test/renderConSesion';
import { VehiculosPage } from '../vehiculos/VehiculosPage';
import { ConductoresPage } from './ConductoresPage';

const perez: Conductor = {
  id: 'conductor-perez',
  apellido: 'Pérez',
  nombre: 'Carlos',
  documento: '15789456',
  domicilio: 'Calle 50 N° 1234, La Plata',
  cuil: '20-15789456-9',
  estado: 'operando',
  restricciones: [],
  asignaciones: [],
};

function buildFakeRepository(): ConductorRepository {
  return {
    list: vi.fn().mockResolvedValue([perez]),
    getById: vi.fn().mockResolvedValue(perez),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(perez),
  };
}

function buildFakeDocumentoRepository(): DocumentoRepository {
  return { listByEntity: vi.fn().mockResolvedValue([]), upload: vi.fn(), remove: vi.fn() };
}

function buildFakeVehiculoRepository(): VehiculoRepository {
  return { list: vi.fn().mockResolvedValue([]), getById: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() };
}

function renderPage(repository: ConductorRepository) {
  return render(
    <ConductorRepositoryProvider repository={repository}>
      <VehiculoRepositoryProvider repository={buildFakeVehiculoRepository()}>
        <ConductoresPage documentoRepository={buildFakeDocumentoRepository()} />
      </VehiculoRepositoryProvider>
    </ConductorRepositoryProvider>,
  );
}

// Composición raíz de la feature (tasks.md 4.2, 5.7): resuelve el ConductorRepository del
// context, wire de useConductores, y decide qué pantalla mostrar (listado o detalle) — mismo
// patrón que VehiculosPage.

describe('ConductoresPage', () => {
  it('carga y muestra el listado usando el repository inyectado por context', async () => {
    renderPage(buildFakeRepository());

    expect(await screen.findByText('Pérez')).toBeInTheDocument();
  });

  it('navega al detalle de alta al hacer click en "Nuevo conductor"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await screen.findByText('Pérez');
    await user.click(screen.getByRole('button', { name: /nuevo conductor/i }));

    expect(screen.getByText('Nuevo conductor')).toBeInTheDocument();
  });

  it('navega al detalle de edición precargado al hacer click en "Editar"', async () => {
    const user = userEvent.setup();
    renderPage(buildFakeRepository());

    await screen.findByText('Pérez');
    await user.click(screen.getByRole('button', { name: /editar pérez/i }));
    await user.click(screen.getByRole('button', { name: /editar datos/i }));

    expect(screen.getByLabelText(/apellido/i)).toHaveValue('Pérez');
  });
});

// Gateo de escritura — aviso de solo lectura (gateo-conductores, design.md D6, tasks.md 2.7):
// se monta en las dos vistas (listado y detalle), sin permiso de escritura, replicando el patrón
// de ObraSocialesPage/PacientesPage.
function renderPageConPermiso(puedeEscribir: boolean, repository: ConductorRepository) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <ConductorRepositoryProvider repository={repository}>
        <VehiculoRepositoryProvider repository={buildFakeVehiculoRepository()}>
          <ConductoresPage documentoRepository={buildFakeDocumentoRepository()} />
        </VehiculoRepositoryProvider>
      </ConductorRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

describe('ConductoresPage — aviso de solo lectura', () => {
  it('sin permiso de escritura: muestra el aviso de modo solo lectura en el listado', async () => {
    renderPageConPermiso(false, buildFakeRepository());

    await screen.findByText('Pérez');
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('sin permiso de escritura: muestra el aviso también en el detalle (triangulación)', async () => {
    const user = userEvent.setup();
    renderPageConPermiso(false, buildFakeRepository());

    await screen.findByText('Pérez');
    await user.click(screen.getByText('Pérez'));

    expect(await screen.findByRole('button', { name: /editar datos/i })).toBeInTheDocument();
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: no muestra ningún aviso', async () => {
    renderPageConPermiso(true, buildFakeRepository());

    await screen.findByText('Pérez');
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
  });
});

// Rol admin sin filas de permisos (design.md D5): mismo criterio ya usado en
// PacientesPage.test.tsx — el contexto ya resolvió el short-circuit de admin.
describe('ConductoresPage — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): no muestra ningún aviso', async () => {
    renderPageConPermiso(true, buildFakeRepository());

    await screen.findByText('Pérez');
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo conductor/i })).toBeEnabled();
  });
});

// Coherencia del permiso entre rutas (gateo-conductores, design.md D2, tasks.md 7.1). Monta
// ConductoresPage y VehiculosPage detrás de RequireAuth real, en sus rutas reales, para probar
// de punta a punta que el permiso se resuelve contra el módulo de la ruta activa — no contra el
// mecanismo compartido stubeado.
//
// ⚠️ ALCANCE REDUCIDO (hallazgo de tasks.md 1.5): esta suite cubre únicamente /conductores y
// /vehiculos, que `moduloDeRuta()` resuelve correctamente contra 'conductores' (app/routes.ts).
// NO incluye /hojas-de-ruta: esa ruta resuelve 'pacientes', no 'conductores' (corrección
// deliberada y ya documentada en app/routes.ts, verificada contra la RLS real de
// pacientes.recorridos/historial_recorridos) — la premisa de este change de que "las tres rutas
// comparten módulo" es incorrecta para /hojas-de-ruta. Afirmar coherencia allí con una sesión de
// permiso 'conductores' sería codificar una aserción falsa en la suite. Ver reporte de cierre de
// sdd-apply para el detalle completo y la recomendación de decisión humana.
function renderRutasConductoresYVehiculosProtegidas(
  permisos: MapaPermisos,
  conductorRepository: ConductorRepository,
  vehiculoRepository: VehiculoRepository,
  rutaInicial: '/conductores' | '/vehiculos',
) {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/conductores',
            element: (
              <ConductorRepositoryProvider repository={conductorRepository}>
                <VehiculoRepositoryProvider repository={vehiculoRepository}>
                  <ConductoresPage documentoRepository={buildFakeDocumentoRepository()} />
                </VehiculoRepositoryProvider>
              </ConductorRepositoryProvider>
            ),
          },
          {
            path: '/vehiculos',
            element: (
              <VehiculoRepositoryProvider repository={vehiculoRepository}>
                <VehiculosPage documentoRepository={buildFakeDocumentoRepository()} />
              </VehiculoRepositoryProvider>
            ),
          },
        ],
      },
      { path: '/login', element: <div>Login mock</div> },
    ],
    { initialEntries: [rutaInicial] },
  );

  return renderConSesion(<RouterProvider router={router} />, { usuario: EMPLEADO, permisos });
}

const EMPLEADO: Usuario = { id: 'u-empleado', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

describe('Coherencia del permiso "conductores" entre /conductores y /vehiculos', () => {
  it('con write en conductores: escritura habilitada en ambas rutas, sin aviso de solo lectura', async () => {
    renderRutasConductoresYVehiculosProtegidas({ conductores: 'write' }, buildFakeRepository(), buildFakeVehiculoRepository(), '/conductores');

    await screen.findByText('Pérez');
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo conductor/i })).toBeEnabled();
  });

  it('con solo read en conductores: ambas rutas quedan en modo solo lectura', async () => {
    renderRutasConductoresYVehiculosProtegidas({ conductores: 'read' }, buildFakeRepository(), buildFakeVehiculoRepository(), '/conductores');

    await screen.findByText('Pérez');
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo conductor/i })).toBeDisabled();
  });

  it('write en otro módulo (facturacion) no habilita conductores: ambas rutas siguen en solo lectura (triangulación)', async () => {
    renderRutasConductoresYVehiculosProtegidas(
      { facturacion: 'write', conductores: 'read' },
      buildFakeRepository(),
      buildFakeVehiculoRepository(),
      '/vehiculos',
    );

    await screen.findByRole('button', { name: /nuevo vehículo/i });
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo vehículo/i })).toBeDisabled();
  });
});
