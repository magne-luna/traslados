import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import userEvent from '@testing-library/user-event';
import type { AsignacionSemanal } from '../../shared/types/conductor';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { VehiculoRepositoryProvider } from '../vehiculos/VehiculoRepositoryContext';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { AsignacionSemanalTabla } from './AsignacionSemanalTabla';

const etios: Vehiculo = {
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

const kangoo: Vehiculo = { ...etios, id: 'vehiculo-kangoo', patente: 'AD456FG', modelo: 'Renault Kangoo' };

function buildFakeVehiculoRepository(vehiculos: Vehiculo[] = [etios, kangoo]): VehiculoRepository {
  return {
    list: vi.fn().mockResolvedValue(vehiculos),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function renderTabla(props: {
  asignaciones?: AsignacionSemanal[];
  ahora?: Date;
  onAgregar?: (a: { vehiculoId: string; semana: string }) => void;
  vehiculoRepository?: VehiculoRepository;
}) {
  return renderConQuery(
    <VehiculoRepositoryProvider repository={props.vehiculoRepository ?? buildFakeVehiculoRepository()}>
      <AsignacionSemanalTabla
        asignaciones={props.asignaciones ?? []}
        ahora={props.ahora ?? new Date(2026, 6, 24)}
        onAgregar={props.onAgregar ?? vi.fn()}
      />
    </VehiculoRepositoryProvider>,
  );
}

function renderTablaConPermiso(
  puedeEscribir: boolean,
  props: {
    asignaciones?: AsignacionSemanal[];
    ahora?: Date;
    onAgregar?: (a: { vehiculoId: string; semana: string }) => void;
    vehiculoRepository?: VehiculoRepository;
  },
) {
  return renderConQuery(
    <PuedeEscribirContext.Provider value={puedeEscribir}>
      <VehiculoRepositoryProvider repository={props.vehiculoRepository ?? buildFakeVehiculoRepository()}>
        <AsignacionSemanalTabla
          asignaciones={props.asignaciones ?? []}
          ahora={props.ahora ?? new Date(2026, 6, 24)}
          onAgregar={props.onAgregar ?? vi.fn()}
        />
      </VehiculoRepositoryProvider>
    </PuedeEscribirContext.Provider>,
  );
}

// Tabla de asignación semanal (tasks.md 6.1 a 6.3, 9.2): selector de vehículo alimentado por
// VehiculoRepository, semana por defecto derivada de `ahora`, y bloqueo de colisión vía
// validarAsignacionSemanal salvo override explícito (design.md Decisión 6 y 7).

describe('AsignacionSemanalTabla', () => {
  it('muestra un estado vacío cuando el conductor no tiene asignaciones', () => {
    renderTabla({ asignaciones: [] });

    expect(screen.getByText(/no hay asignaciones/i)).toBeInTheDocument();
  });

  it('resuelve patente/modelo del vehículo asignado contra la lista de flota', async () => {
    renderTabla({
      asignaciones: [{ id: 'asig-1', vehiculoId: 'vehiculo-etios', semana: '2026-W30' }],
    });

    expect(await screen.findByText('AC123DE')).toBeInTheDocument();
    expect(screen.getByText('Toyota Etios')).toBeInTheDocument();
    expect(screen.getByText('2026-W30')).toBeInTheDocument();
  });

  it('ofrece los vehículos del VehiculoRepository en el selector', async () => {
    renderTabla({});

    expect(await screen.findByRole('option', { name: /AC123DE/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /AD456FG/i })).toBeInTheDocument();
  });

  it('agrega una asignación válida llamando a onAgregar con vehiculoId y semana por defecto', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderTabla({ onAgregar, ahora: new Date(2026, 6, 24) });

    await screen.findByRole('option', { name: /AC123DE/i });
    await user.selectOptions(screen.getByLabelText(/vehículo/i), 'vehiculo-etios');
    await user.click(screen.getByRole('button', { name: /asignar/i }));

    expect(onAgregar).toHaveBeenCalledWith({ vehiculoId: 'vehiculo-etios', semana: '2026-W30' });
  });

  it('bloquea el guardado por colisión y no llama a onAgregar (triangulación)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderTabla({
      asignaciones: [{ id: 'asig-1', vehiculoId: 'vehiculo-etios', semana: '2026-W30' }],
      onAgregar,
      ahora: new Date(2026, 6, 24),
    });

    await screen.findByRole('option', { name: /AD456FG/i });
    await user.selectOptions(screen.getByLabelText(/vehículo/i), 'vehiculo-kangoo');
    await user.click(screen.getByRole('button', { name: /asignar/i }));

    expect(onAgregar).not.toHaveBeenCalled();
    expect(screen.getByText(/ya tiene una asignación a otro vehículo/i)).toBeInTheDocument();
  });

  // D7 §Colisión (2026-07-31): el override `permitirMultiple` se elimina — no existe ningún
  // control para habilitar la doble asignación, la colisión se bloquea siempre. Este test
  // reemplaza al que antes afirmaba la excepción explícita (no se borra: se invierte la
  // aserción, documentando la decisión).
  it('no existe ningún control para habilitar la doble asignación — la colisión se bloquea igual', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderTabla({
      asignaciones: [{ id: 'asig-1', vehiculoId: 'vehiculo-etios', semana: '2026-W30' }],
      onAgregar,
      ahora: new Date(2026, 6, 24),
    });

    await screen.findByRole('option', { name: /AD456FG/i });
    expect(screen.queryByLabelText(/permitir m.ltiple/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/vehículo/i), 'vehiculo-kangoo');
    await user.click(screen.getByRole('button', { name: /asignar/i }));

    expect(onAgregar).not.toHaveBeenCalled();
    expect(screen.getByText(/ya tiene una asignación a otro vehículo/i)).toBeInTheDocument();
  });

  it('no muestra ningún cartel presentando la doble asignación como pregunta abierta (ya está cerrada)', () => {
    renderTabla({});

    const avisos = screen.queryAllByRole('note');
    expect(
      avisos.some((aviso) => /confirmar si un conductor puede tener dos vehículos la misma semana/i.test(aviso.textContent ?? '')),
    ).toBe(false);
  });

  it('muestra los títulos de las subsecciones de historial y alta', () => {
    renderTabla({});

    expect(screen.getByText('Historial de asignaciones')).toBeInTheDocument();
    expect(screen.getByText('Nueva asignación')).toBeInTheDocument();
  });

  it('el estado vacío del historial invita a usar el formulario de abajo', () => {
    renderTabla({ asignaciones: [] });

    expect(screen.getByText(/usá el formulario de abajo para crear la primera asignación/i)).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-conductores, tasks.md 2.5): sin permiso de escritura, el envío de la
// asignación y sus campos quedan inertes; con permiso, operativo; sin permiso, el historial
// sigue siendo legible.
describe('AsignacionSemanalTabla — gateo de escritura', () => {
  it('sin permiso de escritura: el selector de vehículo, la semana y "Asignar" quedan inertes, y el historial sigue legible', async () => {
    renderTablaConPermiso(false, {
      asignaciones: [{ id: 'asig-1', vehiculoId: 'vehiculo-etios', semana: '2026-W30' }],
    });

    expect(await screen.findByText('AC123DE')).toBeInTheDocument();
    expect(screen.getByLabelText(/vehículo/i)).toBeDisabled();
    expect(screen.getByLabelText(/semana \(iso\)/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /asignar/i })).toBeDisabled();
  });

  it('sin permiso de escritura: no se dispara onAgregar', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderTablaConPermiso(false, { onAgregar });

    await user.click(screen.getByRole('button', { name: /asignar/i }));
    expect(onAgregar).not.toHaveBeenCalled();
  });

  it('con permiso de escritura: el formulario de asignación queda operativo (triangulación)', async () => {
    const user = userEvent.setup();
    const onAgregar = vi.fn();

    renderTablaConPermiso(true, { onAgregar, ahora: new Date(2026, 6, 24) });

    await screen.findByRole('option', { name: /AC123DE/i });
    await user.selectOptions(screen.getByLabelText(/vehículo/i), 'vehiculo-etios');
    await user.click(screen.getByRole('button', { name: /asignar/i }));

    expect(onAgregar).toHaveBeenCalledWith({ vehiculoId: 'vehiculo-etios', semana: '2026-W30' });
  });
});

// Rol admin sin filas de permisos (design.md D5): el short-circuit ya está probado de punta a
// punta en usePuedeEscribir.test.tsx — acá solo se confirma el consumo del resultado.
describe('AsignacionSemanalTabla — rol admin sin filas de permisos', () => {
  it('puedeEscribir true (equivalente al short-circuit de admin sin filas): el formulario queda operativo', () => {
    renderTablaConPermiso(true, {});
    expect(screen.getByLabelText(/vehículo/i)).toBeEnabled();
  });
});
