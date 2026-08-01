import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { Recorrido } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { RecorridoCard } from './RecorridoCard';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// RecorridoCard compone ParadasList/AsignacionPanel/RecorridoMapa (ya testeados por separado) y
// conecta sugerirOrdenPorCercania al botón "Sugerir orden" (tasks.md 6.3, RN-HR-01): aplica la
// PROPUESTA a `ParadaRecorrido.orden` como lista editable, nunca impone la ruta.
//
// Convención UI del proyecto (feedback de usuario): un recorrido ya armado arranca en modo
// SOLO-LECTURA (resumen) — sin controles de reorden/quitar/agregar pasajero ni notas editables —
// y un botón "Editar" habilita el modo edición completo, igual que VehiculoDetail/PacienteDetail.
// En edición también se puede cambiar vehículo/conductor (feedback de usuario), con el mismo
// filtro de compatibilidad (RN-VE-01/capacidad) que NuevoRecorridoForm aplica sobre el GRUPO de
// pacientes ya asignados a este recorrido.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: () => <div />,
}));

const vehiculo: Vehiculo = {
  id: 'vehiculo-etios',
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

const vehiculoAlternativo: Vehiculo = { ...vehiculo, id: 'vehiculo-kangoo', patente: 'AD456BC', modelo: 'Renault Kangoo' };
const vehiculoFueraDeServicio: Vehiculo = { ...vehiculo, id: 'vehiculo-baja', patente: 'ZZ999ZZ', estado: 'fuera-de-servicio' };

const conductor: Conductor = {
  id: 'conductor-gonzalez',
  apellido: 'González',
  nombre: 'Marcos',
  documento: '1',
  domicilio: 'x',
  cuil: '20-1-1',
  estado: 'operando',
  restricciones: [],
  asignaciones: [],
};

const conductorAlternativo: Conductor = { ...conductor, id: 'conductor-perez', apellido: 'Pérez', nombre: 'Carlos' };

const pacienteA: Paciente = {
  id: 'paciente-a',
  apellido: 'Gómez',
  nombre: 'Martina',
  fechaNacimiento: '2015-01-01',
  dni: '1',
  cuilTitular: '20-1-1',
  diagnostico: 'x',
  accesorioMovilidad: [],
  obraSocialId: null,
  numeroAfiliado: { valor: '1' },
  cud: null,
  direcciones: [{ id: 'dir-a', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' }],
  personasACargo: [],
  amparoJudicial: false,
};

const pacienteB: Paciente = { ...pacienteA, id: 'paciente-b', apellido: 'Pereyra', nombre: 'Facundo' };
// Sin parada propia en `buildRecorrido()` — queda disponible para AsignacionPanel en modo edición.
const pacienteC: Paciente = { ...pacienteA, id: 'paciente-c', apellido: 'Ledesma', nombre: 'Brisa' };

function buildRecorrido(overrides: Partial<Recorrido> = {}): Recorrido {
  return {
    id: 'recorrido-1',
    vehiculoId: 'vehiculo-etios',
    conductorId: 'conductor-gonzalez',
    manual: false,
    notas: 'Nota existente',
    paradas: [
      { id: 'p-a', pacienteId: 'paciente-a', tramo: 'ida', direccionOrigenId: 'x', direccionDestinoId: 'y', orden: 0, coordenadaOrigen: { lat: 0, lng: 5 } },
      { id: 'p-b', pacienteId: 'paciente-b', tramo: 'ida', direccionOrigenId: 'x', direccionDestinoId: 'y', orden: 1, coordenadaOrigen: { lat: 0, lng: 0.01 } },
    ],
    ...overrides,
  };
}

describe('RecorridoCard', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('muestra la patente del vehículo y el apellido del conductor en el encabezado', () => {
    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    expect(screen.getByText(/ac123de/i)).toBeInTheDocument();
    expect(screen.getByText(/gonzález/i)).toBeInTheDocument();
  });

  it('muestra un chip "Manual" cuando el recorrido es manual (RN-HR-03)', () => {
    render(
      <RecorridoCard
        recorrido={buildRecorrido({ manual: true })}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    expect(screen.getByText(/manual/i)).toBeInTheDocument();
  });

  it('arranca en modo solo-lectura: sin botones de reorden/quitar/agregar pasajero, notas como texto, vehículo/conductor como texto', () => {
    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo, vehiculoAlternativo]}
        conductores={[conductor, conductorAlternativo]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sugerir orden/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /quitar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar pasajero/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/notas del recorrido/i)).not.toBeInTheDocument();
    expect(screen.getByText('Nota existente')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /vehículo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: /conductor/i })).not.toBeInTheDocument();
  });

  it('"Editar" habilita reorden, quitar, agregar pasajero, notas editables y cambio de vehículo/conductor', async () => {
    const user = userEvent.setup();
    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo, vehiculoAlternativo]}
        conductores={[conductor, conductorAlternativo]}
        pacientes={[pacienteA, pacienteB, pacienteC]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));

    expect(screen.getByRole('button', { name: /sugerir orden/i })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /quitar/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /agregar pasajero/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/notas del recorrido/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vehículo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^conductor$/i)).toBeInTheDocument();
  });

  it('"Listo" vuelve al modo solo-lectura', async () => {
    const user = userEvent.setup();
    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    await user.click(screen.getByRole('button', { name: /listo/i }));

    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /agregar pasajero/i })).not.toBeInTheDocument();
  });

  it('permite cambiar el vehículo del recorrido a otro disponible (feedback de usuario)', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();
    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo, vehiculoAlternativo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    await user.selectOptions(screen.getByLabelText(/vehículo/i), 'vehiculo-kangoo');

    expect(onUpdateRecorrido).toHaveBeenCalledWith(expect.objectContaining({ vehiculoId: 'vehiculo-kangoo' }));
  });

  it('permite cambiar el conductor del recorrido a otro operando (feedback de usuario)', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();
    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor, conductorAlternativo]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    await user.selectOptions(screen.getByLabelText(/^conductor$/i), 'conductor-perez');

    expect(onUpdateRecorrido).toHaveBeenCalledWith(expect.objectContaining({ conductorId: 'conductor-perez' }));
  });

  it('excluye del selector de vehículo uno que no soporte el accesorio de un paciente ya asignado (RN-VE-01)', async () => {
    const user = userEvent.setup();
    const vehiculoIncompatible: Vehiculo = { ...vehiculoAlternativo, id: 'vehiculo-incompatible', patente: 'IN111CO', accesoriosCompatibles: [] };
    const vehiculoCompatible: Vehiculo = { ...vehiculoAlternativo, id: 'vehiculo-compatible', patente: 'CO222MP', accesoriosCompatibles: ['silla-rigida'] };
    const pacienteConAccesorio: Paciente = { ...pacienteA, accesorioMovilidad: ['silla-rigida'] };

    render(
      <RecorridoCard
        recorrido={buildRecorrido({ paradas: [buildRecorrido().paradas[0]!] })}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo, vehiculoIncompatible, vehiculoCompatible]}
        conductores={[conductor]}
        pacientes={[pacienteConAccesorio]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));

    expect(screen.queryByRole('option', { name: /in111co/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /co222mp/i })).toBeInTheDocument();
  });

  it('el selector de vehículo también se limita según el paciente que se está por agregar (todavía sin confirmar, feedback de usuario "mismo comportamiento que crear")', async () => {
    const user = userEvent.setup();
    const vehiculoSinAccesorio: Vehiculo = { ...vehiculo, accesoriosCompatibles: [] };
    const vehiculoConAccesorio: Vehiculo = { ...vehiculoAlternativo, accesoriosCompatibles: ['silla-rigida'] };
    const pacienteCConAccesorio: Paciente = { ...pacienteC, accesorioMovilidad: ['silla-rigida'] };

    render(
      <RecorridoCard
        // Recorrido sin paradas todavía: Gómez queda primera en la lista de disponibles (sin
        // accesorios, no acota nada) — Ledesma (con accesorio) se elige explícitamente después.
        recorrido={buildRecorrido({ paradas: [] })}
        vehiculo={vehiculoSinAccesorio}
        conductor={conductor}
        vehiculos={[vehiculoSinAccesorio, vehiculoConAccesorio]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB, pacienteCConAccesorio]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));

    // Antes de elegir a Ledesma en "Agregar pasajero" (Gómez es la elegida por defecto, sin
    // accesorios), ambos vehículos son candidatos.
    expect(screen.getByRole('option', { name: /ac123de/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ad456bc/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-c');

    expect(screen.queryByRole('option', { name: /ac123de/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /ad456bc/i })).toBeInTheDocument();
  });

  it('muestra un aviso en vez de un select vacío cuando ningún vehículo sirve para el paciente que se está por agregar', async () => {
    const user = userEvent.setup();
    const vehiculoSinAccesorio: Vehiculo = { ...vehiculo, accesoriosCompatibles: [] };
    const pacienteCConAccesorio: Paciente = { ...pacienteC, accesorioMovilidad: ['silla-rigida'] };

    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculoSinAccesorio}
        conductor={conductor}
        vehiculos={[vehiculoSinAccesorio]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB, pacienteCConAccesorio]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'paciente-c');

    expect(screen.getByText(/ningún vehículo disponible/i)).toBeInTheDocument();
  });

  it('excluye vehículos y conductores fuera de servicio del selector de cambio (RN-VE-02)', async () => {
    const user = userEvent.setup();
    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo, vehiculoFueraDeServicio]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));

    expect(screen.queryByRole('option', { name: /zz999zz/i })).not.toBeInTheDocument();
  });

  it('"Sugerir orden" aplica sugerirOrdenPorCercania como propuesta editable (RN-HR-01)', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();

    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    await user.click(screen.getByRole('button', { name: /sugerir orden/i }));

    expect(onUpdateRecorrido).toHaveBeenCalledTimes(1);
    const actualizado = onUpdateRecorrido.mock.calls[0]?.[0] as Recorrido;
    // Sin origenReferencia, sugerirOrdenPorCercania parte de la primera parada del array (p-a,
    // lng 5) y de ahí elige el vecino más cercano restante (solo queda p-b) — mismo criterio
    // verificado en sugerirOrdenPorCercania.test.ts.
    expect(actualizado.paradas.map((p) => p.id)).toEqual(['p-a', 'p-b']);
  });

  it('guarda la nota al pie del recorrido al perder foco, en modo edición (RF-703)', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();

    render(
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    const textarea = screen.getByLabelText(/notas del recorrido/i);
    await user.clear(textarea);
    await user.type(textarea, 'Coordinar horario');
    await user.tab();

    expect(onUpdateRecorrido).toHaveBeenCalledWith(expect.objectContaining({ notas: 'Coordinar horario' }));
  });

  it('sin notas cargadas, el modo solo-lectura muestra un texto por defecto (borde)', () => {
    render(
      <RecorridoCard
        recorrido={buildRecorrido({ notas: undefined })}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    expect(screen.getByText(/sin notas/i)).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-hojas-de-ruta, design.md D3/D5, tasks.md 4.1-4.6): "Sugerir orden" y
// "Editar" se gatean con Button.requiereEscritura; "Listo" NO se gatea (no persiste, análogo de
// "Cancelar" en gateo-pacientes); notas (onBlur) y vehículo/conductor (onChange) son los caminos
// de escritura silenciosa que la prop opt-in de Button no alcanza — los cubre CamposSoloLectura.
describe('RecorridoCard — gateo de escritura', () => {
  it('sin permiso de escritura: "Sugerir orden" y "Editar" quedan visibles y deshabilitados, y el resumen sigue legible', () => {
    renderConPermiso(
      false,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    // El resumen (modo solo-lectura) no muestra "Sugerir orden" — solo aparece en modo edición
    // (baseline ya verificado). Acá solo hay "Editar" visible en el resumen.
    expect(screen.getByRole('button', { name: /editar/i })).toBeDisabled();
    expect(screen.getByText(/ac123de/i)).toBeInTheDocument();
    expect(screen.getByText(/gonzález/i)).toBeInTheDocument();
    expect(screen.getByText('Nota existente')).toBeInTheDocument();
  });

  it('con permiso de escritura: "Editar" habilita el modo edición y "Sugerir orden" reordena', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();
    renderConPermiso(
      true,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    expect(screen.getByRole('button', { name: /sugerir orden/i })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /sugerir orden/i }));
    expect(onUpdateRecorrido).toHaveBeenCalledTimes(1);
  });

  it('rol admin sin filas (puedeEscribir=true): "Editar" es activable', () => {
    renderConPermiso(
      true,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /editar/i })).toBeEnabled();
  });

  it('con la tarjeta forzada al modo de edición y sin permiso de escritura, "Listo" es activable y vuelve al resumen (D3 — no persiste, mismo criterio que "Cancelar")', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();
    const { rerender } = renderConPermiso(
      true,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));

    rerender(
      <PuedeEscribirContext.Provider value={false}>
        <RecorridoCard
          recorrido={buildRecorrido()}
          vehiculo={vehiculo}
          conductor={conductor}
          vehiculos={[vehiculo]}
          conductores={[conductor]}
          pacientes={[pacienteA, pacienteB]}
          onUpdateRecorrido={onUpdateRecorrido}
        />
      </PuedeEscribirContext.Provider>,
    );

    const botonListo = screen.getByRole('button', { name: /listo/i });
    expect(botonListo).toBeEnabled();

    await user.click(botonListo);
    expect(screen.getByRole('button', { name: /editar/i })).toBeInTheDocument();
    expect(onUpdateRecorrido).not.toHaveBeenCalled();
  });

  it('con la tarjeta forzada al modo de edición y sin permiso de escritura, la textarea de notas no acepta entrada y el repositorio no recibe ninguna escritura al perder foco', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();
    const { rerender } = renderConPermiso(
      true,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));

    rerender(
      <PuedeEscribirContext.Provider value={false}>
        <RecorridoCard
          recorrido={buildRecorrido()}
          vehiculo={vehiculo}
          conductor={conductor}
          vehiculos={[vehiculo]}
          conductores={[conductor]}
          pacientes={[pacienteA, pacienteB]}
          onUpdateRecorrido={onUpdateRecorrido}
        />
      </PuedeEscribirContext.Provider>,
    );

    const textarea = screen.getByLabelText(/notas del recorrido/i);
    expect(textarea).toBeDisabled();

    await user.type(textarea, 'Intento de nota sin permiso');
    await user.tab();

    expect(onUpdateRecorrido).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: la nota se escribe y persiste al perder el foco (baseline ya cubre este caso, se re-declara acá para simetría del ciclo)', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();
    renderConPermiso(
      true,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    const textarea = screen.getByLabelText(/notas del recorrido/i);
    await user.clear(textarea);
    await user.type(textarea, 'Nota con permiso');
    await user.tab();

    expect(onUpdateRecorrido).toHaveBeenCalledWith(expect.objectContaining({ notas: 'Nota con permiso' }));
  });

  it('con la tarjeta forzada al modo de edición y sin permiso de escritura, los selects de vehículo y conductor no aceptan cambios y el repositorio no recibe ninguna llamada', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();
    const { rerender } = renderConPermiso(
      true,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo, vehiculoAlternativo]}
        conductores={[conductor, conductorAlternativo]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));

    rerender(
      <PuedeEscribirContext.Provider value={false}>
        <RecorridoCard
          recorrido={buildRecorrido()}
          vehiculo={vehiculo}
          conductor={conductor}
          vehiculos={[vehiculo, vehiculoAlternativo]}
          conductores={[conductor, conductorAlternativo]}
          pacientes={[pacienteA, pacienteB]}
          onUpdateRecorrido={onUpdateRecorrido}
        />
      </PuedeEscribirContext.Provider>,
    );

    const selectVehiculo = screen.getByLabelText(/vehículo/i);
    const selectConductor = screen.getByLabelText(/^conductor$/i);
    expect(selectVehiculo).toBeDisabled();
    expect(selectConductor).toBeDisabled();

    expect(onUpdateRecorrido).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: vehículo y conductor cambian y persisten (baseline ya cubre este caso, se re-declara acá para simetría del ciclo)', async () => {
    const user = userEvent.setup();
    const onUpdateRecorrido = vi.fn();
    renderConPermiso(
      true,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo, vehiculoAlternativo]}
        conductores={[conductor, conductorAlternativo]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={onUpdateRecorrido}
      />,
    );

    await user.click(screen.getByRole('button', { name: /editar/i }));
    await user.selectOptions(screen.getByLabelText(/vehículo/i), 'vehiculo-kangoo');

    expect(onUpdateRecorrido).toHaveBeenCalledWith(expect.objectContaining({ vehiculoId: 'vehiculo-kangoo' }));
  });

  it('la rama de solo lectura de vehículo/conductor no sufre regresión: con read y con write muestra texto plano', () => {
    const { unmount } = renderConPermiso(
      false,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );
    expect(screen.getByText(/ac123de/i)).toBeInTheDocument();
    expect(screen.getByText(/gonzález/i)).toBeInTheDocument();
    unmount();

    renderConPermiso(
      true,
      <RecorridoCard
        recorrido={buildRecorrido()}
        vehiculo={vehiculo}
        conductor={conductor}
        vehiculos={[vehiculo]}
        conductores={[conductor]}
        pacientes={[pacienteA, pacienteB]}
        onUpdateRecorrido={vi.fn()}
      />,
    );
    expect(screen.getByText(/ac123de/i)).toBeInTheDocument();
    expect(screen.getByText(/gonzález/i)).toBeInTheDocument();
  });
});
