import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
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
  asignaciones: [],
};

function buildFakeRepository(): ConductorRepository {
  return {
    list: vi.fn().mockResolvedValue([perez]),
    listPage: vi.fn().mockResolvedValue({ items: [perez], total: 1, pagina: 1, tamanio: 20 }),
    getById: vi.fn().mockResolvedValue(perez),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(perez),
  };
}

function buildFakeDocumentoRepository(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
}

function buildFakeVehiculoRepository(): VehiculoRepository {
  return { list: vi.fn().mockResolvedValue([]), getById: vi.fn().mockResolvedValue(null), create: vi.fn(), update: vi.fn() };
}

function renderPage(repository: ConductorRepository) {
  return renderConQuery(
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
  return renderConQuery(
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

// Coherencia del permiso entre rutas — REESCRITO por permisos-modulos-granulares (tasks.md,
// hallazgo durante 5.7): hasta este change (gateo-conductores, design.md D2, ya archivado)
// `/conductores` y `/vehiculos` resolvían el mismo módulo del backend (`conductores`). Desde la
// migración `20260730140000_split_modulos_permisos.sql` y el `APP_ROUTES` nuevo, `/vehiculos`
// resuelve su propio módulo `vehiculos` — las dos pantallas ya NO comparten permiso (spec de este
// change, escenario "Permiso sobre conductores no habilita vehículos"). Monta ConductoresPage y
// VehiculosPage detrás de RequireAuth real, en sus rutas reales, para probar de punta a punta que
// el permiso se resuelve contra el módulo de la ruta activa — no contra el mecanismo compartido
// stubeado.
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

describe('/conductores y /vehiculos resuelven módulos propios e independientes (permisos-modulos-granulares)', () => {
  it('con write en conductores: escritura habilitada en /conductores', async () => {
    renderRutasConductoresYVehiculosProtegidas({ conductores: 'write' }, buildFakeRepository(), buildFakeVehiculoRepository(), '/conductores');

    await screen.findByText('Pérez');
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo conductor/i })).toBeEnabled();
  });

  it('con solo read en conductores: /conductores queda en modo solo lectura', async () => {
    renderRutasConductoresYVehiculosProtegidas({ conductores: 'read' }, buildFakeRepository(), buildFakeVehiculoRepository(), '/conductores');

    await screen.findByText('Pérez');
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo conductor/i })).toBeDisabled();
  });

  it('con write en vehiculos: escritura habilitada en /vehiculos', async () => {
    renderRutasConductoresYVehiculosProtegidas({ vehiculos: 'write' }, buildFakeRepository(), buildFakeVehiculoRepository(), '/vehiculos');

    await screen.findByRole('button', { name: /nuevo vehículo/i });
    expect(screen.queryByText(/solo lectura/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo vehículo/i })).toBeEnabled();
  });

  // Spec (permisos-modulo-frontend, escenario "Permiso sobre conductores no habilita vehículos" /
  // "Permiso sobre vehículos no habilita conductores"): desde este change son módulos
  // independientes — write en uno no habilita el otro.
  it('write en conductores no habilita /vehiculos: sigue en modo solo lectura (triangulación)', async () => {
    renderRutasConductoresYVehiculosProtegidas(
      { conductores: 'write', vehiculos: 'read' },
      buildFakeRepository(),
      buildFakeVehiculoRepository(),
      '/vehiculos',
    );

    await screen.findByRole('button', { name: /nuevo vehículo/i });
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo vehículo/i })).toBeDisabled();
  });

  it('write en otro módulo (facturacion) no habilita conductores ni vehículos (triangulación)', async () => {
    renderRutasConductoresYVehiculosProtegidas(
      { facturacion: 'write', vehiculos: 'read' },
      buildFakeRepository(),
      buildFakeVehiculoRepository(),
      '/vehiculos',
    );

    await screen.findByRole('button', { name: /nuevo vehículo/i });
    expect(screen.getByText(/solo lectura/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /nuevo vehículo/i })).toBeDisabled();
  });
});

// -------------------------------------------------------------------------------------------------
// migracion-react-query, tasks.md 3.3 — el caso concreto que originó el change.
//
// `ConductoresList` y `AsignacionSemanalTabla` son hermanos dentro de `ConductoresPage` y cada uno
// llamaba a `useVehiculos` por su cuenta: dos SELECT idénticos y concurrentes contra la misma tabla.
// Comparten caché aunque reciban el repository por caminos distintos (uno por Context, el otro por
// prop), porque la clave es del DOMINIO, no de la instancia del repository (design.md §D5).
// -------------------------------------------------------------------------------------------------
describe('ConductoresPage — deduplicación de la flota entre componentes hermanos (tasks.md 3.3)', () => {
  it('monta listado y detalle pidiendo la flota UNA sola vez, no dos', async () => {
    const user = userEvent.setup();
    const vehiculoRepository = buildFakeVehiculoRepository();

    renderConQuery(
      <ConductorRepositoryProvider repository={buildFakeRepository()}>
        <VehiculoRepositoryProvider repository={vehiculoRepository}>
          <ConductoresPage documentoRepository={buildFakeDocumentoRepository()} />
        </VehiculoRepositoryProvider>
      </ConductorRepositoryProvider>,
    );

    // El listado ya montó y pidió la flota.
    await screen.findByText('Pérez');
    // Abrir el detalle monta AsignacionSemanalTabla, el segundo consumidor de la flota.
    await user.click(screen.getByText('Pérez'));
    await screen.findByRole('button', { name: /editar datos/i });

    expect(vehiculoRepository.list).toHaveBeenCalledTimes(1);
  });
});
