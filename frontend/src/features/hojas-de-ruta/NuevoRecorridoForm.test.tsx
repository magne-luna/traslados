import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Conductor } from '../../shared/types/conductor';
import type { Paciente } from '../../shared/types/paciente';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { NuevoRecorridoForm } from './NuevoRecorridoForm';

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
    restricciones: [],
    asignaciones: [],
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
    numeroAfiliado: { formato: 'numero-documento', valor: '1' },
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
