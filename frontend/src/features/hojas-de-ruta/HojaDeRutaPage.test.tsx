import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

// Lo que NO se gatea (gateo-hojas-de-ruta, design.md D1/D2, tasks.md 6.1-6.6): el riesgo más
// costoso de todo el split de gateo — encerrar a una cuenta de solo `read` en la vista de armado
// o en la hoja de hoy, sin poder ver datos que su permiso SÍ la autoriza a ver.
describe('HojaDeRutaPage — lo que NO se gatea (D1/D2)', () => {
  const hojaConRecorrido: HojaDeRuta = {
    id: 'hoja-1',
    fecha: HOY,
    franjaInicio: '08:00',
    franjaFin: '20:00',
    recorridos: [{ id: 'r-1', vehiculoId: 'v-1', conductorId: 'c-1', manual: false, paradas: [] }],
  };

  it('sin permiso de escritura: los tres conmutadores de vista son activables y las tres vistas se renderizan completas', async () => {
    const user = userEvent.setup();
    renderPageConPermiso(false, buildFakeHojaRepo({ list: vi.fn().mockResolvedValue([hojaConRecorrido]) }));

    const botonArmado = await screen.findByRole('button', { name: /^armado$/i });
    const botonGlobal = screen.getByRole('button', { name: /vista global/i });
    const botonImprimir = screen.getByRole('button', { name: /imprimir/i });
    expect(botonArmado).toBeEnabled();
    expect(botonGlobal).toBeEnabled();
    expect(botonImprimir).toBeEnabled();

    await user.click(botonGlobal);
    expect(screen.getByText(/sin conflictos/i)).toBeInTheDocument();

    await user.click(botonImprimir);
    expect(screen.getByRole('heading', { name: new RegExp(`hoja de ruta — ${HOY}`, 'i') })).toBeInTheDocument();

    await user.click(botonArmado);
    expect(screen.getByText(/recorridos del día/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: los tres conmutadores de vista funcionan igual', async () => {
    const user = userEvent.setup();
    renderPageConPermiso(true, buildFakeHojaRepo({ list: vi.fn().mockResolvedValue([hojaConRecorrido]) }));

    await user.click(await screen.findByRole('button', { name: /vista global/i }));
    expect(screen.getByText(/sin conflictos/i)).toBeInTheDocument();
  });

  it('sin permiso de escritura: el selector de fecha acepta el cambio y la pantalla muestra la hoja (o el estado vacío) de ese día', async () => {
    renderPageConPermiso(false, buildFakeHojaRepo({ list: vi.fn().mockResolvedValue([hojaConRecorrido]) }));

    const inputFecha = await screen.findByLabelText(/fecha/i);
    expect(inputFecha).toBeEnabled();

    fireEvent.change(inputFecha, { target: { value: '2020-01-01' } });

    expect(await screen.findByText(/no hay hoja de ruta cargada para el 2020-01-01/i)).toBeInTheDocument();
  });

  it('el encabezado de la pantalla (fecha + conmutadores) no queda dentro de ningún envoltorio de solo lectura', async () => {
    renderPageConPermiso(false, buildFakeHojaRepo({ list: vi.fn().mockResolvedValue([hojaConRecorrido]) }));

    const inputFecha = await screen.findByLabelText(/fecha/i);
    // Un <fieldset disabled> ancestro deshabilitaría también este input — si esto pasa, prueba
    // que el encabezado quedó envuelto por error (design.md D2).
    expect(inputFecha.closest('fieldset[disabled]')).toBeNull();
  });
});

// Vistas de solo lectura (gateo-hojas-de-ruta, design.md D6/riesgos, tasks.md 6.3/6.4): la vista
// imprimible y los tres archivos NO tocados (RecorridoMapa, RecorridoStat, RequisitosPaciente) no
// cambian ni una línea — ya verificado por `git diff --stat` al cierre de esta sección; acá solo
// se confirma que se renderizan completos con solo `read`.
describe('HojaDeRutaPage — vistas de solo lectura no se bloquean', () => {
  it('sin permiso de escritura: la vista imprimible se renderiza completa y es utilizable', async () => {
    const user = userEvent.setup();
    const hoja: HojaDeRuta = {
      id: 'hoja-1',
      fecha: HOY,
      franjaInicio: '08:00',
      franjaFin: '20:00',
      recorridos: [{ id: 'r-1', vehiculoId: 'v-1', conductorId: 'c-1', manual: false, paradas: [] }],
    };
    renderPageConPermiso(false, buildFakeHojaRepo({ list: vi.fn().mockResolvedValue([hoja]) }));

    await user.click(await screen.findByRole('button', { name: /imprimir/i }));

    expect(screen.getByRole('heading', { name: new RegExp(`hoja de ruta — ${HOY}`, 'i') })).toBeInTheDocument();
    expect(screen.getByText(/franja horaria 08:00 a 20:00/i)).toBeInTheDocument();
  });
});

// Aviso de modo solo lectura (gateo-hojas-de-ruta, design.md D7, tasks.md 7.1-7.2): una sola
// inserción de AvisoSoloLectura, arriba del switch de vistas, para que sobreviva al conmutar
// entre armado, global e imprimir — mismo patrón que ObraSocialesPage/PacientesPage.
describe('HojaDeRutaPage — aviso de modo solo lectura', () => {
  const hojaConRecorrido: HojaDeRuta = {
    id: 'hoja-1',
    fecha: HOY,
    franjaInicio: '08:00',
    franjaFin: '20:00',
    recorridos: [{ id: 'r-1', vehiculoId: 'v-1', conductorId: 'c-1', manual: false, paradas: [] }],
  };

  it('sin permiso de escritura: la pantalla informa el modo solo lectura', async () => {
    renderPageConPermiso(false, buildFakeHojaRepo());

    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    const notas = screen.getAllByRole('note').map((nota) => nota.textContent ?? '');
    expect(notas.some((texto) => /modo solo lectura/i.test(texto))).toBe(true);
  });

  it('con permiso de escritura: no aparece ningún aviso', async () => {
    renderPageConPermiso(true, buildFakeHojaRepo());

    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();
  });

  it('rol admin sin filas (puedeEscribir=true): no aparece ningún aviso', async () => {
    renderPageConPermiso(true, buildFakeHojaRepo());

    await screen.findByRole('heading', { name: /hoja de ruta del día/i });
    expect(screen.queryByText(/modo solo lectura/i)).not.toBeInTheDocument();
  });

  it('sin permiso de escritura: el aviso sigue visible al conmutar entre armado, global e imprimir', async () => {
    const user = userEvent.setup();
    renderPageConPermiso(false, buildFakeHojaRepo({ list: vi.fn().mockResolvedValue([hojaConRecorrido]) }));

    function avisoVisible(): boolean {
      return screen.getAllByRole('note').some((nota) => /modo solo lectura/i.test(nota.textContent ?? ''));
    }

    await screen.findByRole('button', { name: /vista global/i });
    expect(avisoVisible()).toBe(true);

    await user.click(screen.getByRole('button', { name: /vista global/i }));
    expect(avisoVisible()).toBe(true);

    await user.click(screen.getByRole('button', { name: /imprimir/i }));
    expect(avisoVisible()).toBe(true);

    await user.click(screen.getByRole('button', { name: /^armado$/i }));
    expect(avisoVisible()).toBe(true);
  });
});
