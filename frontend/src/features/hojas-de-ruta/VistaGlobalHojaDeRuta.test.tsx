import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { ParadaRecorrido, Recorrido } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { VistaGlobalHojaDeRuta } from './VistaGlobalHojaDeRuta';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// Vista global del día (tasks.md 7.5, RF-705): señala conflictos (vehículo/conductor fuera de
// servicio) y permite reasignar pasajeros a otro recorrido respetando RN-VE-01 (accesorio) y
// RN-VE-02/capacidad.

const vehiculoHabilitado: Vehiculo = {
  id: 'v-ok',
  patente: 'OK111OK',
  modelo: 'Etios',
  tipo: 'sedan',
  capacidad: 4,
  accesoriosCompatibles: ['silla-plegable'],
  estado: 'habilitado',
  kilometraje: 0,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '2026-01-01',
  habilitaciones: [],
  gastos: [],
  mantenimientos: [],
};

const vehiculoFueraDeServicio: Vehiculo = { ...vehiculoHabilitado, id: 'v-fds', patente: 'FDS111', estado: 'fuera-de-servicio' };

const conductorOperando: Conductor = {
  id: 'c-op',
  apellido: 'González',
  nombre: 'Marcos',
  documento: '1',
  domicilio: 'x',
  cuil: '20-1-1',
  estado: 'operando',
  asignaciones: [],
};

function buildPaciente(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: 'paciente-1',
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
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
    ...overrides,
  };
}

function buildParada(overrides: Partial<ParadaRecorrido> = {}): ParadaRecorrido {
  return {
    id: 'parada-1',
    pacienteId: 'paciente-1',
    tramo: 'ida',
    direccionOrigenId: 'a',
    direccionDestinoId: 'b',
    orden: 0,
    ...overrides,
  };
}

describe('VistaGlobalHojaDeRuta', () => {
  it('muestra un estado explícito cuando no hay conflictos (borde)', () => {
    const recorrido: Recorrido = { id: 'r-1', vehiculoId: 'v-ok', conductorId: 'c-op', manual: false, paradas: [] };

    render(
      <VistaGlobalHojaDeRuta
        recorridos={[recorrido]}
        vehiculos={[vehiculoHabilitado]}
        conductores={[conductorOperando]}
        pacientes={[]}
        onReasignar={vi.fn()}
      />,
    );

    expect(screen.getByText(/sin conflictos/i)).toBeInTheDocument();
  });

  it('señala un recorrido con vehículo fuera de servicio', () => {
    const conflictivo: Recorrido = { id: 'r-fds', vehiculoId: 'v-fds', conductorId: 'c-op', manual: false, paradas: [] };

    render(
      <VistaGlobalHojaDeRuta
        recorridos={[conflictivo]}
        vehiculos={[vehiculoFueraDeServicio]}
        conductores={[conductorOperando]}
        pacientes={[]}
        onReasignar={vi.fn()}
      />,
    );

    expect(screen.getByText(/vehículo fuera de servicio/i)).toBeInTheDocument();
  });

  it('reasigna un pasajero a un recorrido disponible compatible', async () => {
    const user = userEvent.setup();
    const onReasignar = vi.fn();
    const paciente = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const conflictivo: Recorrido = {
      id: 'r-fds',
      vehiculoId: 'v-fds',
      conductorId: 'c-op',
      manual: false,
      paradas: [buildParada()],
    };
    const destino: Recorrido = { id: 'r-ok', vehiculoId: 'v-ok', conductorId: 'c-op', manual: false, paradas: [] };

    render(
      <VistaGlobalHojaDeRuta
        recorridos={[conflictivo, destino]}
        vehiculos={[vehiculoFueraDeServicio, vehiculoHabilitado]}
        conductores={[conductorOperando]}
        pacientes={[paciente]}
        onReasignar={onReasignar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/reasignar gómez, martina a/i), 'r-ok');
    await user.click(screen.getByRole('button', { name: /mover/i }));

    expect(onReasignar).toHaveBeenCalledWith('parada-1', 'r-fds', 'r-ok');
  });

  it('bloquea la reasignación si el paciente es incompatible con el vehículo destino (RN-VE-01)', async () => {
    const user = userEvent.setup();
    const onReasignar = vi.fn();
    const paciente = buildPaciente({ accesorioMovilidad: ['silla-rigida'] });
    const conflictivo: Recorrido = {
      id: 'r-fds',
      vehiculoId: 'v-fds',
      conductorId: 'c-op',
      manual: false,
      paradas: [buildParada()],
    };
    const destino: Recorrido = { id: 'r-ok', vehiculoId: 'v-ok', conductorId: 'c-op', manual: false, paradas: [] };

    render(
      <VistaGlobalHojaDeRuta
        recorridos={[conflictivo, destino]}
        vehiculos={[vehiculoFueraDeServicio, vehiculoHabilitado]}
        conductores={[conductorOperando]}
        pacientes={[paciente]}
        onReasignar={onReasignar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/reasignar gómez, martina a/i), 'r-ok');
    await user.click(screen.getByRole('button', { name: /mover/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/silla-rigida/i);
    expect(onReasignar).not.toHaveBeenCalled();
  });
});

// Gateo de escritura (gateo-hojas-de-ruta, design.md D4/D9, tasks.md 6.5): un envoltorio por
// bloque de conflicto cubre el <select> de destino y "Mover"; el resto (razón del conflicto,
// nombre del pasajero) queda fuera y sigue legible sin permiso de escritura.
describe('VistaGlobalHojaDeRuta — gateo de escritura', () => {
  const paciente = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
  const conflictivo: Recorrido = {
    id: 'r-fds',
    vehiculoId: 'v-fds',
    conductorId: 'c-op',
    manual: false,
    paradas: [buildParada()],
  };
  const destino: Recorrido = { id: 'r-ok', vehiculoId: 'v-ok', conductorId: 'c-op', manual: false, paradas: [] };

  it('sin permiso de escritura: no se puede elegir destino ni mover una fila, y el conflicto y el pasajero siguen legibles', async () => {
    const user = userEvent.setup();
    const onReasignar = vi.fn();

    renderConPermiso(
      false,
      <VistaGlobalHojaDeRuta
        recorridos={[conflictivo, destino]}
        vehiculos={[vehiculoFueraDeServicio, vehiculoHabilitado]}
        conductores={[conductorOperando]}
        pacientes={[paciente]}
        onReasignar={onReasignar}
      />,
    );

    expect(screen.getByText(/vehículo fuera de servicio/i)).toBeInTheDocument();
    expect(screen.getAllByText(/gómez, martina/i).length).toBeGreaterThan(0);

    const selectDestino = screen.getByLabelText(/reasignar gómez, martina a/i);
    const botonMover = screen.getByRole('button', { name: /mover/i });
    expect(selectDestino).toBeDisabled();
    expect(botonMover).toBeDisabled();

    await user.click(botonMover);
    expect(onReasignar).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: se puede elegir destino y mover la fila', async () => {
    const user = userEvent.setup();
    const onReasignar = vi.fn();

    renderConPermiso(
      true,
      <VistaGlobalHojaDeRuta
        recorridos={[conflictivo, destino]}
        vehiculos={[vehiculoFueraDeServicio, vehiculoHabilitado]}
        conductores={[conductorOperando]}
        pacientes={[paciente]}
        onReasignar={onReasignar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/reasignar gómez, martina a/i), 'r-ok');
    await user.click(screen.getByRole('button', { name: /mover/i }));

    expect(onReasignar).toHaveBeenCalledWith('parada-1', 'r-fds', 'r-ok');
  });

  it('rol admin sin filas (puedeEscribir=true): "Mover" es activable', () => {
    renderConPermiso(
      true,
      <VistaGlobalHojaDeRuta
        recorridos={[conflictivo, destino]}
        vehiculos={[vehiculoFueraDeServicio, vehiculoHabilitado]}
        conductores={[conductorOperando]}
        pacientes={[paciente]}
        onReasignar={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: /mover/i })).toBeEnabled();
  });
});
