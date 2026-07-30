import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { Conductor } from '../../shared/types/conductor';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { HojaDeRutaRepositoryProvider } from './HojaDeRutaRepositoryContext';
import { HojaDeRutaPage } from './HojaDeRutaPage';

// Pantalla de armado del día (tasks.md 5.1/5.2, 9.1): selector de fecha, estados de
// carga/vacío/error, agrupa recorridos por vehículo/conductor, y muestra siempre el cartel
// AvisoModeloDatos (design.md Decisión 8, Discrepancias 1/2 del docx).
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: () => <div />,
}));

const HOY = new Date().toISOString().slice(0, 10);

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

function buildFakeHojaRepo(overrides: Partial<HojaDeRutaRepository> = {}): HojaDeRutaRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    getByFecha: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function buildFakeVehiculoRepo(): VehiculoRepository {
  return { list: vi.fn().mockResolvedValue([vehiculo]), getById: vi.fn(), create: vi.fn(), update: vi.fn() };
}

function buildFakeConductorRepo(): ConductorRepository {
  return { list: vi.fn().mockResolvedValue([conductor]), getById: vi.fn(), create: vi.fn(), update: vi.fn() };
}

function buildFakePacienteRepo(): PacienteRepository {
  return { list: vi.fn().mockResolvedValue([]), getById: vi.fn(), create: vi.fn(), update: vi.fn() };
}

function renderPage(hojaRepo: HojaDeRutaRepository) {
  return render(
    <HojaDeRutaRepositoryProvider repository={hojaRepo}>
      <HojaDeRutaPage
        pacienteRepository={buildFakePacienteRepo()}
        vehiculoRepository={buildFakeVehiculoRepo()}
        conductorRepository={buildFakeConductorRepo()}
      />
    </HojaDeRutaRepositoryProvider>,
  );
}

function renderPageConPermiso(puedeEscribir: boolean, hojaRepo: HojaDeRutaRepository) {
  return render(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <HojaDeRutaRepositoryProvider repository={hojaRepo}>
        <HojaDeRutaPage
          pacienteRepository={buildFakePacienteRepo()}
          vehiculoRepository={buildFakeVehiculoRepo()}
          conductorRepository={buildFakeConductorRepo()}
        />
      </HojaDeRutaRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

describe('HojaDeRutaPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('muestra el cartel de discrepancia del modelo de datos (design.md Decisión 8)', async () => {
    renderPage(buildFakeHojaRepo());

    expect(await screen.findByRole('heading', { name: /hoja de ruta del día/i })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(/conductor/i);
  });

  it('muestra un estado vacío explícito cuando el día no tiene hoja de ruta cargada', async () => {
    renderPage(buildFakeHojaRepo());

    expect(await screen.findByText(/no hay recorridos|crear hoja de ruta/i)).toBeInTheDocument();
  });

  it('crea la hoja de ruta del día al confirmar el estado vacío', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue({
      id: 'hoja-nueva',
      fecha: HOY,
      franjaInicio: '08:00',
      franjaFin: '20:00',
      recorridos: [],
    } satisfies HojaDeRuta);
    const repo = buildFakeHojaRepo({ create });

    renderPage(repo);

    await user.click(await screen.findByRole('button', { name: /crear hoja de ruta/i }));

    expect(create).toHaveBeenCalledWith(expect.objectContaining({ fecha: HOY }));
  });

  it('muestra un mensaje de error visible cuando falla la carga', async () => {
    const repo = buildFakeHojaRepo({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    renderPage(repo);

    expect(await screen.findByRole('alert')).toHaveTextContent('caído');
  });

  it('muestra el recorrido del día ya cargado, agrupado por vehículo/conductor', async () => {
    const hoja: HojaDeRuta = {
      id: 'hoja-1',
      fecha: HOY,
      franjaInicio: '08:00',
      franjaFin: '20:00',
      recorridos: [{ id: 'r-1', vehiculoId: 'v-1', conductorId: 'c-1', manual: false, paradas: [] }],
    };
    const repo = buildFakeHojaRepo({ list: vi.fn().mockResolvedValue([hoja]) });

    renderPage(repo);

    await waitFor(() => expect(screen.getAllByText(/ac123de/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/gonzález/i).length).toBeGreaterThan(0);
  });
});

// Gateo de escritura — alta de la hoja del día (gateo-hojas-de-ruta, tasks.md 2.1, design.md
// D8/D9): "Crear hoja de ruta para este día" es la única acción de escritura del estado vacío.
// Mismo criterio que ObraSocialesPage/PacientesPage: visible pero deshabilitada sin permiso,
// sin ocultar el mensaje de estado vacío.
describe('HojaDeRutaPage — gateo de escritura (alta de la hoja del día)', () => {
  it('sin permiso de escritura: el botón de crear la hoja del día queda visible y deshabilitado, y no llama al repositorio', async () => {
    const user = userEvent.setup();
    const create = vi.fn();
    renderPageConPermiso(false, buildFakeHojaRepo({ create }));

    const boton = await screen.findByRole('button', { name: /crear hoja de ruta/i });
    expect(boton).toBeDisabled();
    expect(screen.getByText(new RegExp(`no hay hoja de ruta cargada para el ${HOY}`, 'i'))).toBeInTheDocument();

    await user.click(boton);
    expect(create).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: el botón crea la hoja del día con normalidad', async () => {
    const user = userEvent.setup();
    const create = vi.fn().mockResolvedValue({
      id: 'hoja-nueva',
      fecha: HOY,
      franjaInicio: '08:00',
      franjaFin: '20:00',
      recorridos: [],
    } satisfies HojaDeRuta);
    renderPageConPermiso(true, buildFakeHojaRepo({ create }));

    const boton = await screen.findByRole('button', { name: /crear hoja de ruta/i });
    expect(boton).toBeEnabled();
    expect(screen.getByText(new RegExp(`no hay hoja de ruta cargada para el ${HOY}`, 'i'))).toBeInTheDocument();

    await user.click(boton);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ fecha: HOY }));
  });

  it('rol admin sin filas en la matriz (puedeEscribir=true equivalente al short-circuit del servidor): el botón es activable', async () => {
    renderPageConPermiso(true, buildFakeHojaRepo());

    expect(await screen.findByRole('button', { name: /crear hoja de ruta/i })).toBeEnabled();
  });
});
