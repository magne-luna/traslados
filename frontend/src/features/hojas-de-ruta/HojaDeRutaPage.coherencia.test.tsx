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

// Coherencia con /pacientes — REESCRITO por permisos-modulos-granulares (tasks.md, hallazgo
// durante 5.7): `/hojas-de-ruta` y `/pacientes` resolvían el mismo módulo del backend
// (`pacientes`) hasta este change (gateo-hojas-de-ruta, design.md D8, ya archivado). Desde la
// migración `20260730140000_split_modulos_permisos.sql` y el `APP_ROUTES` nuevo, `/hojas-de-ruta`
// resuelve su propio módulo `hojas_de_ruta` — las dos pantallas ya NO comparten permiso (spec de
// este change, escenario "Permiso sobre pacientes ya no habilita esta pantalla").
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
  mantenimientos: [],
};

const conductor: Conductor = {
  id: 'c-1',
  apellido: 'González',
  nombre: 'Marcos',
  documento: '1',
  domicilio: 'x',
  cuil: '20-1-1',
  estado: 'operando',
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
  numeroAfiliado: { valor: '45123456' },
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
    // paginacion-listados, Fase 2: este fake también se usa para montar PacientesPage en la ruta
    // /pacientes de este archivo (renderAmbasRutas) — necesita un resultado real, no solo el
    // stub vacío que alcanza para el resto de los repositories de este archivo.
    listPage: vi.fn().mockResolvedValue({ items: [martina], total: 1, pagina: 1, tamanio: 20 }),
    getById: vi.fn().mockResolvedValue(martina),
    create: vi.fn(),
    update: vi.fn().mockResolvedValue(martina),
  };
}
function buildFakeObraSocialRepo(): ObraSocialRepository {
  return { list: vi.fn().mockResolvedValue([]), getById: vi.fn(), create: vi.fn(), update: vi.fn() };
}
function buildFakeDocumentoRepo(): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    transferirAgrupacion: vi.fn(),
  };
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

describe('HojaDeRutaPage — resuelve su propio módulo "hojas_de_ruta", independiente de "pacientes"', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key');
  });

  it('con solo read sobre hojas_de_ruta: la pantalla queda en modo solo lectura', async () => {
    renderAmbasRutas({ hojas_de_ruta: 'read' }, '/hojas-de-ruta');
    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    const notas = screen.getAllByRole('note').map((n) => n.textContent ?? '');
    expect(notas.some((t) => /modo solo lectura/i.test(t))).toBe(true);
  });

  it('con write sobre hojas_de_ruta (sin ningún permiso sobre pacientes): la pantalla queda habilitada y sin aviso', async () => {
    renderAmbasRutas({ hojas_de_ruta: 'write' }, '/hojas-de-ruta');
    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();
  });

  // Spec (permisos-modulo-frontend, escenario "Permiso sobre pacientes ya no habilita esta
  // pantalla"): desde este change, pacientes y hojas_de_ruta son módulos independientes.
  it('con write sobre pacientes y solo read sobre hojas_de_ruta: /hojas-de-ruta queda en solo lectura (ya no comparten permiso)', async () => {
    renderAmbasRutas({ pacientes: 'write' }, '/pacientes');
    await screen.findByText(/gómez, martina/i);
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();

    renderAmbasRutas({ pacientes: 'write', hojas_de_ruta: 'read' }, '/hojas-de-ruta');
    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    const notas = screen.getAllByRole('note').map((n) => n.textContent ?? '');
    expect(notas.some((t) => /modo solo lectura/i.test(t))).toBe(true);
  });
});

// Permiso de otro módulo no habilita esta pantalla (gateo-hojas-de-ruta, design.md corolario,
// tasks.md 8.2, spec "Permiso de escritura sobre conductores no habilita esta pantalla" /
// "Permiso de escritura sobre hojas de ruta habilita esta pantalla sin permiso sobre
// conductores") — reescrito con `hojas_de_ruta` como el módulo propio de la ruta.
describe('HojaDeRutaPage — el permiso de otro módulo no habilita esta pantalla', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key');
  });

  it('con write en conductores y solo read en hojas_de_ruta: /hojas-de-ruta queda en solo lectura', async () => {
    renderAmbasRutas({ conductores: 'write', hojas_de_ruta: 'read' }, '/hojas-de-ruta');

    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    const notas = screen.getAllByRole('note').map((n) => n.textContent ?? '');
    expect(notas.some((t) => /modo solo lectura/i.test(t))).toBe(true);
  });

  it('triangulación: con write en hojas_de_ruta y solo read en conductores, /hojas-de-ruta queda habilitada', async () => {
    renderAmbasRutas({ hojas_de_ruta: 'write', conductores: 'read' }, '/hojas-de-ruta');

    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();
  });
});
