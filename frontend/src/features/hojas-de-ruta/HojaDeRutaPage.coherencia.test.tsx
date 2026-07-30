import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { MapaPermisos, Usuario } from '../../shared/types/usuario';
import { RequireAuth } from '../../shared/auth/RequireAuth';
import { renderConSesion } from '../../shared/test/renderConSesion';
import { PacienteRepositoryProvider } from '../pacientes/PacienteRepositoryContext';
import { PacientesPage } from '../pacientes/PacientesPage';
import { HojaDeRutaRepositoryProvider } from './HojaDeRutaRepositoryContext';
import { HojaDeRutaPage } from './HojaDeRutaPage';

// Coherencia con /pacientes (gateo-hojas-de-ruta, design.md D8, tasks.md 8.1/8.2): las dos rutas
// resuelven el mismo módulo del backend (`pacientes`) — una cuenta con `read` debe quedar en
// solo lectura en las DOS pantallas con la misma sesión, contra RequireAuth real (no el
// mecanismo compartido stubeado). Mismo patrón que gateo-facturacion (dos rutas) y
// gateo-conductores (/conductores + /vehiculos).
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: () => <div />,
}));

const vehiculo: Vehiculo = {
  id: 'v-1',
  patente: 'AC123DE',
  modelo: 'Toyota Etios',
  tipo: 'sedan',
  capacidad: 4,
  accesoriosCompatibles: [],
  estado: 'habilitado',
  kilometraje: 0,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '2026-01-01',
  habilitaciones: [],
  gastos: [],
};

const conductor: Conductor = {
  id: 'c-1',
  apellido: 'González',
  nombre: 'Marcos',
  documento: '1',
  domicilio: 'x',
  cuil: '20-1-1',
  estado: 'operando',
  restricciones: [],
  asignaciones: [],
};

const martina: Paciente = {
  id: 'paciente-martina',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-03-12',
  dni: '45123456',
  cuilTitular: '27-30111222-4',
  diagnostico: 'Parálisis cerebral',
  accesorioMovilidad: [],
  obraSocialId: null,
  numeroAfiliado: { formato: 'numero-documento', valor: '45123456' },
  cud: null,
  direcciones: [],
  personasACargo: [],
  amparoJudicial: false,
};

function buildFakeHojaRepo(): HojaDeRutaRepository {
  return { list: vi.fn().mockResolvedValue([]), getById: vi.fn(), getByFecha: vi.fn(), create: vi.fn(), update: vi.fn() };
}
function buildFakeVehiculoRepo(): VehiculoRepository {
  return { list: vi.fn().mockResolvedValue([vehiculo]), getById: vi.fn(), create: vi.fn(), update: vi.fn() };
}
function buildFakeConductorRepo(): ConductorRepository {
  return { list: vi.fn().mockResolvedValue([conductor]), getById: vi.fn(), create: vi.fn(), update: vi.fn() };
}
function buildFakePacienteRepo(): PacienteRepository {
  return {
    list: vi.fn().mockResolvedValue([martina]),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(martina),
  };
}
function buildFakeObraSocialRepo(): ObraSocialRepository {
  return { list: vi.fn().mockResolvedValue([]), getById: vi.fn(), create: vi.fn(), update: vi.fn() };
}
function buildFakeDocumentoRepo(): DocumentoRepository {
  return { listByEntity: vi.fn().mockResolvedValue([]), upload: vi.fn(), remove: vi.fn() };
}

const EMPLEADO: Usuario = { id: 'u-empleado', nombre: 'Juan', apellido: 'Pérez', email: 'juan@x.com', rol: 'empleado' };

function renderAmbasRutas(permisos: MapaPermisos, entrada: '/pacientes' | '/hojas-de-ruta') {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/pacientes',
            element: (
              <PacienteRepositoryProvider repository={buildFakePacienteRepo()}>
                <PacientesPage obraSocialRepository={buildFakeObraSocialRepo()} documentoRepository={buildFakeDocumentoRepo()} />
              </PacienteRepositoryProvider>
            ),
          },
          {
            path: '/hojas-de-ruta',
            element: (
              <HojaDeRutaRepositoryProvider repository={buildFakeHojaRepo()}>
                <HojaDeRutaPage
                  pacienteRepository={buildFakePacienteRepo()}
                  vehiculoRepository={buildFakeVehiculoRepo()}
                  conductorRepository={buildFakeConductorRepo()}
                />
              </HojaDeRutaRepositoryProvider>
            ),
          },
        ],
      },
      { path: '/login', element: <div>Login mock</div> },
    ],
    { initialEntries: [entrada] },
  );

  return renderConSesion(<RouterProvider router={router} />, { usuario: EMPLEADO, permisos });
}

describe('HojaDeRutaPage — coherencia con /pacientes (D8)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key');
  });

  it('con solo read sobre pacientes: las dos pantallas quedan en modo solo lectura con la misma sesión', async () => {
    renderAmbasRutas({ pacientes: 'read' }, '/pacientes');
    await screen.findByText(/gómez, martina/i);
    const notasPacientes = screen.getAllByRole('note').map((n) => n.textContent ?? '');
    expect(notasPacientes.some((t) => /modo solo lectura/i.test(t))).toBe(true);

    renderAmbasRutas({ pacientes: 'read' }, '/hojas-de-ruta');
    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    const notasHojas = screen.getAllByRole('note').map((n) => n.textContent ?? '');
    expect(notasHojas.some((t) => /modo solo lectura/i.test(t))).toBe(true);
  });

  it('con write sobre pacientes: las dos pantallas quedan habilitadas y sin aviso', async () => {
    renderAmbasRutas({ pacientes: 'write' }, '/pacientes');
    await screen.findByText(/gómez, martina/i);
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();

    renderAmbasRutas({ pacientes: 'write' }, '/hojas-de-ruta');
    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();
  });
});

// Permiso de otro módulo no habilita esta pantalla (gateo-hojas-de-ruta, design.md corolario,
// tasks.md 8.2, spec "Permiso de escritura sobre conductores no habilita esta pantalla" /
// "Permiso de escritura sobre pacientes habilita esta pantalla sin permiso sobre conductores").
describe('HojaDeRutaPage — el permiso de otro módulo no habilita esta pantalla', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key');
  });

  it('con write en conductores y solo read en pacientes: /hojas-de-ruta queda en solo lectura', async () => {
    renderAmbasRutas({ conductores: 'write', pacientes: 'read' }, '/hojas-de-ruta');

    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    const notas = screen.getAllByRole('note').map((n) => n.textContent ?? '');
    expect(notas.some((t) => /modo solo lectura/i.test(t))).toBe(true);
  });

  it('triangulación: con write en pacientes y solo read en conductores, /hojas-de-ruta queda habilitada', async () => {
    renderAmbasRutas({ pacientes: 'write', conductores: 'read' }, '/hojas-de-ruta');

    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();
  });
});
