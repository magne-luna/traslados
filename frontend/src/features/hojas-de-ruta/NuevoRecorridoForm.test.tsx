import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { Recorrido } from '../../shared/types/hojaDeRuta';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { NuevoRecorridoForm } from './NuevoRecorridoForm';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

// RN-VE-02 (tasks.md 5.2, 7.3): solo vehículos habilitados y conductores operando aparecen como
// opciones; permite marcar el recorrido como manual (RN-HR-03).
//
// Feedback de usuario: "Nuevo recorrido" y "Agregar pasajero" (AsignacionPanel) eran dos
// formularios distintos para la misma acción real — acá el paciente se elige por SELECT (no
// checkboxes, más práctico con muchos pacientes), igual que AsignacionPanel; al elegirlo aparecen
// sus accesorios (coloreados según compatibilidad con el vehículo elegido) y el selector de
// vehículo se limita a los que le entran (capacidad + RN-VE-01). El paciente es opcional — se
// puede crear el recorrido vacío y sumar pasajeros después vía AsignacionPanel.

function buildVehiculo(overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id: 'v-1',
    patente: 'AA111AA',
    modelo: 'Etios',
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
    ...overrides,
  };
}

function buildConductor(overrides: Partial<Conductor> = {}): Conductor {
  return {
    id: 'c-1',
    apellido: 'González',
    nombre: 'Marcos',
    documento: '1',
    domicilio: 'x',
    cuil: '20-1-1',
    estado: 'operando',
    asignaciones: [],
    ...overrides,
  };
}

function buildRecorrido(overrides: Partial<Recorrido> = {}): Recorrido {
  return {
    id: 'r-1',
    vehiculoId: 'v-1',
    conductorId: 'c-1',
    manual: false,
    paradas: [],
    ...overrides,
  };
}

function buildPaciente(overrides: Partial<Paciente> = {}): Paciente {
  return {
    id: 'p-1',
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
    direcciones: [{ id: 'dir-1', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' }],
    personasACargo: [],
    amparoJudicial: false,
    ...overrides,
  };
}

describe('NuevoRecorridoForm', () => {
  it('excluye vehículos fuera de servicio del selector (RN-VE-02)', () => {
    const habilitado = buildVehiculo({ id: 'v-hab', patente: 'HAB111' });
    const fueraDeServicio = buildVehiculo({ id: 'v-fds', patente: 'FDS111', estado: 'fuera-de-servicio' });

    render(
      <NuevoRecorridoForm
        vehiculos={[habilitado, fueraDeServicio]}
        conductores={[buildConductor()]}
        pacientes={[]}
        onCrear={vi.fn()}
      />,
    );

    expect(screen.getByRole('option', { name: /hab111/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /fds111/i })).not.toBeInTheDocument();
  });

  it('excluye conductores fuera de servicio del selector (RN-VE-02)', () => {
    const operando = buildConductor({ id: 'c-op', apellido: 'González' });
    const fueraDeServicio = buildConductor({ id: 'c-fds', apellido: 'Díaz', estado: 'fuera-de-servicio' });

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo()]}
        conductores={[operando, fueraDeServicio]}
        pacientes={[]}
        onCrear={vi.fn()}
      />,
    );

    expect(screen.getByRole('option', { name: /gonzález/i })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /díaz/i })).not.toBeInTheDocument();
  });

  it('crea el recorrido sin pasajero, con manual=false por defecto (borde: nadie elegido todavía)', async () => {
    const user = userEvent.setup();
    const onCrear = vi.fn();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo()]}
        conductores={[buildConductor()]}
        pacientes={[]}
        onCrear={onCrear}
      />,
    );

    await user.click(screen.getByRole('button', { name: /crear recorrido/i }));

    expect(onCrear).toHaveBeenCalledWith({ vehiculoId: 'v-1', conductorId: 'c-1', manual: false, paradas: [] });
  });

  it('permite marcar el recorrido como manual (RN-HR-03, triangulación)', async () => {
    const user = userEvent.setup();
    const onCrear = vi.fn();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo()]}
        conductores={[buildConductor()]}
        pacientes={[]}
        onCrear={onCrear}
      />,
    );

    await user.click(screen.getByLabelText(/manual/i));
    await user.click(screen.getByRole('button', { name: /crear recorrido/i }));

    expect(onCrear).toHaveBeenCalledWith({ vehiculoId: 'v-1', conductorId: 'c-1', manual: true, paradas: [] });
  });

  it('no muestra el botón de crear si no hay vehículos o conductores disponibles (borde)', () => {
    render(<NuevoRecorridoForm vehiculos={[]} conductores={[buildConductor()]} pacientes={[]} onCrear={vi.fn()} />);

    expect(screen.getByText(/no hay vehículos habilitados/i)).toBeInTheDocument();
  });

  it('al elegir un paciente con accesorios, los muestra como chips', async () => {
    const user = userEvent.setup();
    const conAccesorio = buildPaciente({ id: 'p-acc', apellido: 'Ledesma', accesorioMovilidad: ['andador'] });

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo({ accesoriosCompatibles: ['andador'] })]}
        conductores={[buildConductor()]}
        pacientes={[conAccesorio]}
        onCrear={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'p-acc');

    expect(screen.getAllByText(/andador/i).length).toBeGreaterThan(0);
  });

  it('el selector de vehículo se limita a los que tienen accesorios compatibles con el paciente elegido', async () => {
    const user = userEvent.setup();
    const sinAccesorio = buildVehiculo({ id: 'v-sin', patente: 'SIN111', accesoriosCompatibles: [] });
    const conAccesorio = buildVehiculo({ id: 'v-con', patente: 'CON111', accesoriosCompatibles: ['silla-rigida'] });
    const pacienteConAccesorio = buildPaciente({ id: 'p-acc', accesorioMovilidad: ['silla-rigida'] });

    render(
      <NuevoRecorridoForm
        vehiculos={[sinAccesorio, conAccesorio]}
        conductores={[buildConductor()]}
        pacientes={[pacienteConAccesorio]}
        onCrear={vi.fn()}
      />,
    );

    // Antes de elegir paciente, ambos vehículos son candidatos.
    expect(screen.getByRole('option', { name: /sin111/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /con111/i })).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'p-acc');

    expect(screen.queryByRole('option', { name: /sin111/i })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /con111/i })).toBeInTheDocument();
  });

  it('vuelve a incluir un vehículo descartado si se vuelve a elegir "sin pasajero"', async () => {
    const user = userEvent.setup();
    const sinAccesorio = buildVehiculo({ id: 'v-sin', patente: 'SIN111', accesoriosCompatibles: [] });
    const pacienteConAccesorio = buildPaciente({ id: 'p-acc', accesorioMovilidad: ['silla-rigida'] });

    render(
      <NuevoRecorridoForm
        vehiculos={[sinAccesorio]}
        conductores={[buildConductor()]}
        pacientes={[pacienteConAccesorio]}
        onCrear={vi.fn()}
      />,
    );

    const selectPaciente = screen.getByLabelText(/paciente/i);
    await user.selectOptions(selectPaciente, 'p-acc');
    expect(screen.getByText(/ningún vehículo disponible/i)).toBeInTheDocument();

    await user.selectOptions(selectPaciente, '');
    expect(screen.queryByText(/ningún vehículo disponible/i)).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /sin111/i })).toBeInTheDocument();
  });

  it('muestra un aviso y oculta el botón de crear cuando ningún vehículo disponible sirve para el paciente elegido', async () => {
    const user = userEvent.setup();
    const chico = buildVehiculo({ id: 'v-chico', accesoriosCompatibles: [] });
    const pacienteConAccesorio = buildPaciente({ id: 'p-acc', accesorioMovilidad: ['silla-rigida'] });

    render(
      <NuevoRecorridoForm vehiculos={[chico]} conductores={[buildConductor()]} pacientes={[pacienteConAccesorio]} onCrear={vi.fn()} />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'p-acc');

    expect(screen.getByText(/ningún vehículo disponible/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /crear recorrido/i })).not.toBeInTheDocument();
  });

  it('permite cargar notas del recorrido y las incluye en el alta', async () => {
    const user = userEvent.setup();
    const onCrear = vi.fn();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo()]}
        conductores={[buildConductor()]}
        pacientes={[]}
        onCrear={onCrear}
      />,
    );

    await user.type(screen.getByLabelText(/notas/i), 'Coordinar horario con la escuela');
    await user.click(screen.getByRole('button', { name: /crear recorrido/i }));

    expect(onCrear).toHaveBeenCalledWith(
      expect.objectContaining({ notas: 'Coordinar horario con la escuela' }),
    );
  });

  it('sin notas cargadas, el alta no lleva el campo notas (borde)', async () => {
    const user = userEvent.setup();
    const onCrear = vi.fn();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo()]}
        conductores={[buildConductor()]}
        pacientes={[]}
        onCrear={onCrear}
      />,
    );

    await user.click(screen.getByRole('button', { name: /crear recorrido/i }));

    expect(onCrear.mock.calls[0]?.[0]?.notas).toBeUndefined();
  });

  it('arma la parada del paciente elegido con tramo, dirección y hora cargados', async () => {
    const user = userEvent.setup();
    const onCrear = vi.fn();
    const paciente = buildPaciente({
      id: 'p-a',
      apellido: 'Gómez',
      direcciones: [
        { id: 'dir-ida', tipo: 'domicilio', calle: 'Calle A', localidad: 'CABA' },
        { id: 'dir-vuelta', tipo: 'escuela', calle: 'Calle B', localidad: 'CABA' },
      ],
    });

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo()]}
        conductores={[buildConductor()]}
        pacientes={[paciente]}
        onCrear={onCrear}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/paciente/i), 'p-a');
    await user.type(screen.getByLabelText(/hora/i), '08:30');
    await user.selectOptions(screen.getByLabelText(/dirección de origen/i), 'dir-ida');
    await user.selectOptions(screen.getByLabelText(/dirección de destino/i), 'dir-vuelta');
    await user.click(screen.getByRole('button', { name: /crear recorrido/i }));

    expect(onCrear).toHaveBeenCalledWith({
      vehiculoId: 'v-1',
      conductorId: 'c-1',
      manual: false,
      paradas: [
        { pacienteId: 'p-a', tramo: 'ida', direccionOrigenId: 'dir-ida', direccionDestinoId: 'dir-vuelta', orden: 0, horaEstimada: '08:30' },
      ],
    });
  });
});

// Sugerencia de recorrido existente (feedback de usuario, RN-HR-01/RN-VE-01/RN-VE-02): antes de
// forzar a crear un recorrido nuevo, si hay uno de hoy compatible (vehículo con lugar/accesorios,
// horario dentro de la ventana de sugerirRecorridoExistente.ts) se ofrece sumarse a ese en vez de
// arrancar de cero. Nunca automático — "Crear recorrido" sigue funcionando igual si se ignora.
describe('NuevoRecorridoForm — sugerencia de recorrido existente', () => {
  function setupConCandidato() {
    const vehiculoExistente = buildVehiculo({ id: 'v-existente', patente: 'EXI111' });
    const recorridoExistente = buildRecorrido({
      id: 'r-existente',
      vehiculoId: 'v-existente',
      conductorId: 'c-1',
      paradas: [
        {
          id: 'parada-otro',
          pacienteId: 'otro-paciente',
          tramo: 'ida',
          direccionOrigenId: 'x',
          direccionDestinoId: 'y',
          orden: 0,
          horaEstimada: '09:00',
        },
      ],
    });
    return { vehiculoExistente, recorridoExistente };
  }

  it('sin recorridos hoy, no muestra ninguna sugerencia', async () => {
    const user = userEvent.setup();
    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo()]}
        conductores={[buildConductor()]}
        pacientes={[buildPaciente()]}
        recorridos={[]}
        onCrear={vi.fn()}
        onAgregarAExistente={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'p-1');
    await user.type(screen.getByLabelText(/hora/i), '09:10');

    expect(screen.queryByRole('button', { name: /agregar a este recorrido/i })).not.toBeInTheDocument();
  });

  it('sin hora estimada cargada, no muestra ninguna sugerencia (sin señal temporal)', async () => {
    const user = userEvent.setup();
    const { recorridoExistente, vehiculoExistente } = setupConCandidato();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo(), vehiculoExistente]}
        conductores={[buildConductor()]}
        pacientes={[buildPaciente()]}
        recorridos={[recorridoExistente]}
        onCrear={vi.fn()}
        onAgregarAExistente={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'p-1');

    expect(screen.queryByRole('button', { name: /agregar a este recorrido/i })).not.toBeInTheDocument();
  });

  it('con un recorrido compatible dentro de la ventana horaria, muestra la sugerencia con vehículo y ocupación', async () => {
    const user = userEvent.setup();
    const { recorridoExistente, vehiculoExistente } = setupConCandidato();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo(), vehiculoExistente]}
        conductores={[buildConductor()]}
        pacientes={[buildPaciente()]}
        recorridos={[recorridoExistente]}
        onCrear={vi.fn()}
        onAgregarAExistente={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'p-1');
    await user.type(screen.getByLabelText(/hora/i), '09:10');

    // /exi111/i solo por getByText matchea también el <option> del selector de Vehículo (mismo
    // vehículo, ambos candidatos legítimos) — se busca el texto de ocupación, único del cartel.
    // "1/4" porque el recorrido existente ya tiene 1 parada cargada (otro-paciente, setupConCandidato).
    expect(screen.getByText(/1\/4 pasajeros/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar a este recorrido/i })).toBeInTheDocument();
  });

  it('al hacer click en "Agregar a este recorrido" llama a onAgregarAExistente con la parada armada y NO llama a onCrear', async () => {
    const user = userEvent.setup();
    const { recorridoExistente, vehiculoExistente } = setupConCandidato();
    const onCrear = vi.fn();
    const onAgregarAExistente = vi.fn();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo(), vehiculoExistente]}
        conductores={[buildConductor()]}
        pacientes={[buildPaciente()]}
        recorridos={[recorridoExistente]}
        onCrear={onCrear}
        onAgregarAExistente={onAgregarAExistente}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'p-1');
    await user.type(screen.getByLabelText(/hora/i), '09:10');
    await user.click(screen.getByRole('button', { name: /agregar a este recorrido/i }));

    expect(onAgregarAExistente).toHaveBeenCalledWith('r-existente', {
      pacienteId: 'p-1',
      tramo: 'ida',
      direccionOrigenId: 'dir-1',
      direccionDestinoId: 'dir-1',
      orden: 0,
      horaEstimada: '09:10',
    });
    expect(onCrear).not.toHaveBeenCalled();
  });

  it('usa la dirección de origen/destino ya elegida en el formulario, igual que "Crear recorrido"', async () => {
    const user = userEvent.setup();
    const { recorridoExistente, vehiculoExistente } = setupConCandidato();
    const onAgregarAExistente = vi.fn();
    const paciente = buildPaciente({
      direcciones: [
        { id: 'dir-ida', tipo: 'domicilio', calle: 'Calle A', localidad: 'CABA' },
        { id: 'dir-vuelta', tipo: 'escuela', calle: 'Calle B', localidad: 'CABA' },
      ],
    });

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo(), vehiculoExistente]}
        conductores={[buildConductor()]}
        pacientes={[paciente]}
        recorridos={[recorridoExistente]}
        onCrear={vi.fn()}
        onAgregarAExistente={onAgregarAExistente}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'p-1');
    await user.type(screen.getByLabelText(/hora/i), '09:10');
    await user.selectOptions(screen.getByLabelText(/dirección de origen/i), 'dir-ida');
    await user.selectOptions(screen.getByLabelText(/dirección de destino/i), 'dir-vuelta');
    await user.click(screen.getByRole('button', { name: /agregar a este recorrido/i }));

    expect(onAgregarAExistente).toHaveBeenCalledWith(
      'r-existente',
      expect.objectContaining({ direccionOrigenId: 'dir-ida', direccionDestinoId: 'dir-vuelta' }),
    );
  });

  it('ignorar la sugerencia y usar "Crear recorrido" sigue funcionando igual, sin llamar a onAgregarAExistente', async () => {
    const user = userEvent.setup();
    const { recorridoExistente, vehiculoExistente } = setupConCandidato();
    const onCrear = vi.fn();
    const onAgregarAExistente = vi.fn();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo(), vehiculoExistente]}
        conductores={[buildConductor()]}
        pacientes={[buildPaciente()]}
        recorridos={[recorridoExistente]}
        onCrear={onCrear}
        onAgregarAExistente={onAgregarAExistente}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'p-1');
    await user.type(screen.getByLabelText(/hora/i), '09:10');
    await user.click(screen.getByRole('button', { name: /^crear recorrido$/i }));

    expect(onCrear).toHaveBeenCalled();
    expect(onAgregarAExistente).not.toHaveBeenCalled();
  });

  it('si la hora elegida queda fuera de la ventana de todos los candidatos, la sugerencia desaparece', async () => {
    const user = userEvent.setup();
    const { recorridoExistente, vehiculoExistente } = setupConCandidato();

    render(
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo(), vehiculoExistente]}
        conductores={[buildConductor()]}
        pacientes={[buildPaciente()]}
        recorridos={[recorridoExistente]}
        onCrear={vi.fn()}
        onAgregarAExistente={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), 'p-1');
    await user.type(screen.getByLabelText(/hora/i), '09:10');
    expect(screen.getByRole('button', { name: /agregar a este recorrido/i })).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/hora/i));
    await user.type(screen.getByLabelText(/hora/i), '14:00');

    expect(screen.queryByRole('button', { name: /agregar a este recorrido/i })).not.toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-hojas-de-ruta, design.md D4/D9, tasks.md 3.1/3.2): una sola
// inserción de CamposSoloLectura cubre SelectorPaciente + PacienteTramoCampos + los selects de
// vehículo/conductor + el checkbox "manual" + la textarea de notas; "Crear recorrido" queda
// deshabilitado por el mismo envoltorio (mismo criterio que AsignacionSemanalTabla). El caso de
// PacienteTramoCampos no se prueba con un paciente ya elegido porque, con SelectorPaciente
// deshabilitado, la cuenta de solo lectura no puede llegar a elegir uno — queda cubierto
// estructuralmente por el mismo <fieldset disabled>, no por una aserción redundante por campo.
describe('NuevoRecorridoForm — gateo de escritura', () => {
  const paciente = buildPaciente({ id: 'p-1' });

  it('sin permiso de escritura: ningún campo acepta entrada, "Crear recorrido" queda deshabilitado, y no se emite ninguna escritura', async () => {
    const user = userEvent.setup();
    const onCrear = vi.fn();

    renderConPermiso(
      false,
      <NuevoRecorridoForm vehiculos={[buildVehiculo()]} conductores={[buildConductor()]} pacientes={[paciente]} onCrear={onCrear} />,
    );

    expect(screen.getByLabelText(/^paciente$/i)).toBeDisabled();
    expect(screen.getByLabelText(/vehículo/i)).toBeDisabled();
    expect(screen.getByLabelText(/^conductor$/i)).toBeDisabled();
    expect(screen.getByLabelText(/manual/i)).toBeDisabled();
    expect(screen.getByLabelText(/notas/i)).toBeDisabled();

    const boton = screen.getByRole('button', { name: /crear recorrido/i });
    expect(boton).toBeDisabled();

    await user.click(boton);
    expect(onCrear).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: todos los campos operativos y "Crear recorrido" da de alta el recorrido', async () => {
    const user = userEvent.setup();
    const onCrear = vi.fn();

    renderConPermiso(
      true,
      <NuevoRecorridoForm vehiculos={[buildVehiculo()]} conductores={[buildConductor()]} pacientes={[paciente]} onCrear={onCrear} />,
    );

    expect(screen.getByLabelText(/^paciente$/i)).toBeEnabled();
    expect(screen.getByLabelText(/vehículo/i)).toBeEnabled();
    expect(screen.getByLabelText(/^conductor$/i)).toBeEnabled();
    expect(screen.getByLabelText(/manual/i)).toBeEnabled();
    expect(screen.getByLabelText(/notas/i)).toBeEnabled();

    await user.click(screen.getByRole('button', { name: /crear recorrido/i }));
    expect(onCrear).toHaveBeenCalledTimes(1);
  });

  it('rol admin sin filas en la matriz (puedeEscribir=true): "Crear recorrido" es activable', () => {
    renderConPermiso(
      true,
      <NuevoRecorridoForm vehiculos={[buildVehiculo()]} conductores={[buildConductor()]} pacientes={[paciente]} onCrear={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /crear recorrido/i })).toBeEnabled();
  });

  // "Agregar a este recorrido" vive dentro del mismo <CamposSoloLectura> que el resto del
  // formulario (design.md D4/D9) — sin permiso de escritura, el fieldset deshabilitado bloquea
  // llegar a elegir paciente+hora, así que el botón ni siquiera renderiza. Mismo caso que
  // PacienteTramoCampos más arriba: cobertura estructural por el fieldset, no una aserción
  // redundante por campo. Solo se prueba el caso CON permiso, donde sí se puede interactuar.
  it('con permiso de escritura: "Agregar a este recorrido" respeta requiereEscritura (está habilitado)', async () => {
    const user = userEvent.setup();
    const vehiculoExistente = buildVehiculo({ id: 'v-existente', patente: 'EXI111' });
    const recorridoExistente = buildRecorrido({
      id: 'r-existente',
      vehiculoId: 'v-existente',
      paradas: [{ id: 'p-x', pacienteId: 'otro', tramo: 'ida', direccionOrigenId: 'x', direccionDestinoId: 'y', orden: 0, horaEstimada: '09:00' }],
    });

    renderConPermiso(
      true,
      <NuevoRecorridoForm
        vehiculos={[buildVehiculo(), vehiculoExistente]}
        conductores={[buildConductor()]}
        pacientes={[paciente]}
        recorridos={[recorridoExistente]}
        onCrear={vi.fn()}
        onAgregarAExistente={vi.fn()}
      />,
    );

    await user.selectOptions(screen.getByLabelText(/^paciente$/i), paciente.id);
    await user.type(screen.getByLabelText(/hora/i), '09:10');

    expect(screen.getByRole('button', { name: /agregar a este recorrido/i })).toBeEnabled();
  });
});
