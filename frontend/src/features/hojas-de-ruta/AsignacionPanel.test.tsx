import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Paciente } from '../../shared/types/paciente';
import type { Recorrido } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { AsignacionPanel } from './AsignacionPanel';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// RN-VE-01 (accesorio incompatible) y capacidad de vehículo (tasks.md 5.3, 9.2): la asignación
// se bloquea en la UI con un mensaje visible y nunca llega a `onAgregar` (no se persiste).

const vehiculoConSillaPlegable: Vehiculo = {
  id: 'vehiculo-1',
  patente: 'AA111AA',
  modelo: 'Test',
  tipo: 'sedan',
  capacidad: 2,
  accesoriosCompatibles: ['silla-plegable'],
  estado: 'habilitado',
  kilometraje: 0,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '2026-01-01',
  habilitaciones: [],
  gastos: [],
  mantenimientos: [],
};

function buildPaciente(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: 'paciente-1',
    apellido: 'Gómez',
    nombre: 'Martina',
    fechaNacimiento: '2015-01-01',
    dni: '1',
    cuilTitular: '20-1-1',
    diagnostico: 'Test',
    accesorioMovilidad: [],
    obraSocialId: null,
    numeroAfiliado: { valor: '1' },
    cud: null,
    direcciones: [
      { id: 'dir-ida', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' },
      { id: 'dir-vuelta', tipo: 'escuela', calle: 'Calle 2', localidad: 'CABA' },
    ],
    personasACargo: [],
    amparoJudicial: false,
    ...overrides,
  };
}

function buildRecorrido(overrides: Partial<Recorrido> = {}): Recorrido {
  return {
    id: 'recorrido-1',
    vehiculoId: 'vehiculo-1',
    conductorId: 'conductor-1',
    manual: false,
    paradas: [],
    ...overrides,
  };
}

describe('AsignacionPanel', () => {
  it('bloquea la asignación cuando el paciente requiere un accesorio incompatible con el vehículo (RN-VE-01)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const pacienteIncompatible = buildPaciente({
      id: 'paciente-incompatible',
      apellido: 'Pereyra',
      accesorioMovilidad: ['silla-rigida'],
    });

    render(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[pacienteIncompatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-incompatible');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/silla-rigida/i);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('bloquea la asignación cuando el vehículo no tiene lugar disponible (capacidad)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    // Vehículo con capacidad 2 ya con 2 paradas: lleno.
    const recorridoLleno = buildRecorrido({
      paradas: [
        { id: 'p1', pacienteId: 'x', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 0 },
        { id: 'p2', pacienteId: 'y', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 1 },
      ],
    });

    render(
      <AsignacionPanel
        recorrido={recorridoLleno}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/lugar|capacidad/i);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('agrega la parada cuando el paciente es compatible y hay lugar disponible', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

    render(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.selectOptions(screen.getByLabelText(/dirección de origen/i), 'dir-ida');
    await user.selectOptions(screen.getByLabelText(/dirección de destino/i), 'dir-vuelta');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
    const parada = onAgregar.mock.calls[0]?.[0];
    expect(parada).toMatchObject({
      pacienteId: 'paciente-1',
      direccionOrigenId: 'dir-ida',
      direccionDestinoId: 'dir-vuelta',
      orden: 0,
    });
  });

  it('al elegir un paciente con accesorios, los muestra como chips (feedback de usuario: mismo formulario que Nuevo recorrido)', async () => {
    const conAccesorio = buildPaciente({ id: 'paciente-acc', apellido: 'Ledesma', accesorioMovilidad: ['silla-plegable'] });

    render(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[conAccesorio]}
        onAgregar={vi.fn()}
      />,
    );

    expect(screen.getAllByText(/silla plegable/i).length).toBeGreaterThan(0);
  });

  it('permite cargar la hora estimada del tramo y la incluye en la parada creada', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

    render(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.type(screen.getByLabelText(/hora/i), '08:30');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    const parada = onAgregar.mock.calls[0]?.[0];
    expect(parada).toMatchObject({ horaEstimada: '08:30' });
  });

  it('sin hora cargada, la parada no lleva horaEstimada (borde)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

    render(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    const parada = onAgregar.mock.calls[0]?.[0];
    expect(parada.horaEstimada).toBeUndefined();
  });

  it('paciente sin accesorios de movilidad se acepta en cualquier vehículo (borde)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const sinAccesorios = buildPaciente({ accesorioMovilidad: [] });

    render(
      <AsignacionPanel
        recorrido={buildRecorrido()}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[sinAccesorios]}
        onAgregar={onAgregar}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
  });

  // RN-HR-02 (feedback de usuario): ida y vuelta del mismo paciente conviven en el mismo
  // recorrido (ver dashboard-recorridos-del-dia spec y resumenDelDia.test.ts) — el bloqueo debe
  // ser SOLO el duplicado exacto (mismo paciente + mismo tramo ya cargado), nunca el paciente
  // entero.
  it('preselecciona el tramo que le falta al paciente elegido cuando ya tiene una parada en este recorrido', async () => {
    const user = userEvent.setup();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const recorridoConIdaCargada = buildRecorrido({
      paradas: [{ id: 'p-ida', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 0 }],
    });

    render(
      <AsignacionPanel
        recorrido={recorridoConIdaCargada}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={vi.fn()}
      />,
    );

    // pacientes[0] ya viene preseleccionado (comportamiento previo) — el tramo debe arrancar en
    // "vuelta", no en "ida" (que ya está tomado).
    expect(screen.getByLabelText(/tramo/i)).toHaveValue('vuelta');

    // Reafirmar la misma elección disparando el onChange (mismo paciente ya seleccionado)
    // también debe mantener "vuelta" (triangulación del mismo camino, no solo el mount inicial).
    await user.selectOptions(screen.getByLabelText(/paciente/i), 'paciente-1');
    expect(screen.getByLabelText(/tramo/i)).toHaveValue('vuelta');
  });

  it('sugiere origen/destino invertidos (la vuelta natural) cuando el paciente ya tiene una parada en este recorrido', () => {
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const recorridoConIdaCargada = buildRecorrido({
      // buildPaciente() usa 'dir-ida' y 'dir-vuelta' como ids de direcciones reales del paciente.
      paradas: [
        { id: 'p-ida', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'dir-ida', direccionDestinoId: 'dir-vuelta', orden: 0 },
      ],
    });

    render(
      <AsignacionPanel
        recorrido={recorridoConIdaCargada}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/dirección de origen/i)).toHaveValue('dir-vuelta');
    expect(screen.getByLabelText(/dirección de destino/i)).toHaveValue('dir-ida');
  });

  it('sin ninguna parada previa del paciente, origen/destino arrancan vacíos (borde, comportamiento previo)', async () => {
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

    render(
      <AsignacionPanel recorrido={buildRecorrido()} vehiculo={vehiculoConSillaPlegable} pacientes={[compatible]} onAgregar={vi.fn()} />,
    );

    expect(screen.getByLabelText(/dirección de origen/i)).toHaveValue('');
    expect(screen.getByLabelText(/dirección de destino/i)).toHaveValue('');
  });

  it('bloquea agregar una parada con el mismo tramo que el paciente ya tiene en este recorrido (RN-HR-02)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const recorridoConIdaCargada = buildRecorrido({
      paradas: [{ id: 'p-ida', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 0 }],
    });

    render(
      <AsignacionPanel
        recorrido={recorridoConIdaCargada}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    // Fuerza el duplicado exacto: el tramo se preseleccionó en "vuelta", lo volvemos a "ida" a mano.
    await user.selectOptions(screen.getByLabelText(/tramo/i), 'ida');
    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/ya tiene una parada de ida/i);
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('permite agregar la vuelta a un paciente que ya tiene la ida cargada en el mismo recorrido (RN-HR-02)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();
    const compatible = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });
    const recorridoConIdaCargada = buildRecorrido({
      paradas: [{ id: 'p-ida', pacienteId: 'paciente-1', tramo: 'ida', direccionOrigenId: 'a', direccionDestinoId: 'b', orden: 0 }],
    });

    render(
      <AsignacionPanel
        recorrido={recorridoConIdaCargada}
        vehiculo={vehiculoConSillaPlegable}
        pacientes={[compatible]}
        onAgregar={onAgregar}
      />,
    );

    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));

    expect(onAgregar).toHaveBeenCalledTimes(1);
    expect(onAgregar.mock.calls[0]?.[0]).toMatchObject({ pacienteId: 'paciente-1', tramo: 'vuelta' });
  });
});

// Gateo de escritura (gateo-hojas-de-ruta, design.md D4/D9, tasks.md 5.3): una sola inserción de
// CamposSoloLectura cubre SelectorPaciente + PacienteTramoCampos + "Agregar pasajero" (mismo
// patrón que NuevoRecorridoForm). Acá, a diferencia de NuevoRecorridoForm, el primer paciente
// queda preseleccionado por defecto (`pacientes[0]`), así que PacienteTramoCampos SÍ se puede
// afirmar directamente sin necesitar seleccionar nada primero.
describe('AsignacionPanel — gateo de escritura', () => {
  const paciente = buildPaciente({ accesorioMovilidad: ['silla-plegable'] });

  it('sin permiso de escritura: ningún campo acepta entrada, "Agregar pasajero" queda deshabilitado, y RequisitosPaciente sigue legible', () => {
    renderConPermiso(
      false,
      <AsignacionPanel recorrido={buildRecorrido()} vehiculo={vehiculoConSillaPlegable} pacientes={[paciente]} onAgregar={vi.fn()} />,
    );

    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    expect(screen.getByLabelText(/hora/i)).toBeDisabled();
    expect(screen.getByLabelText(/tramo/i)).toBeDisabled();
    expect(screen.getByLabelText(/dirección de origen/i)).toBeDisabled();
    expect(screen.getByLabelText(/dirección de destino/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /agregar pasajero/i })).toBeDisabled();

    expect(screen.getAllByText(/silla plegable/i).length).toBeGreaterThan(0);
  });

  it('con permiso de escritura: todos los campos operativos y "Agregar pasajero" agrega la parada', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderConPermiso(
      true,
      <AsignacionPanel recorrido={buildRecorrido()} vehiculo={vehiculoConSillaPlegable} pacientes={[paciente]} onAgregar={onAgregar} />,
    );

    expect(screen.getByLabelText(/^paciente$/i)).toBeEnabled();
    expect(screen.getByLabelText(/hora/i)).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /agregar pasajero/i }));
    expect(onAgregar).toHaveBeenCalledTimes(1);
  });

  it('rol admin sin filas (puedeEscribir=true): "Agregar pasajero" es activable', () => {
    renderConPermiso(
      true,
      <AsignacionPanel recorrido={buildRecorrido()} vehiculo={vehiculoConSillaPlegable} pacientes={[paciente]} onAgregar={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /agregar pasajero/i })).toBeEnabled();
  });
});
