import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { VehiculosList } from './VehiculosList';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const etios: Vehiculo = {
  id: 'vehiculo-etios',
  patente: 'AC123DE',
  modelo: 'Toyota Etios',
  tipo: 'sedan',
  capacidad: 4,
  accesoriosCompatibles: ['silla-plegable'],
  estado: 'habilitado',
  kilometraje: 85_000,
  kilometrajeUltimoService: 82_000,
  fechaUltimoService: '2026-03-01',
  habilitaciones: [],
  gastos: [],
  mantenimientos: [],
};

const partner: Vehiculo = {
  ...etios,
  id: 'vehiculo-partner',
  patente: 'AE789HI',
  modelo: 'Peugeot Partner',
  estado: 'fuera-de-servicio',
};

describe('VehiculosList', () => {
  it('muestra un indicador de carga mientras loading es true', () => {
    render(<VehiculosList vehiculos={[]} loading error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />);

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('muestra un estado vacío con la acción de crear el primer vehículo cuando no hay datos', () => {
    render(<VehiculosList vehiculos={[]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />);

    expect(screen.getByText(/no hay vehículos/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /crear el primer vehículo/i })).toBeInTheDocument();
  });

  it('muestra el error visible sin ocultar el resto de la pantalla', () => {
    render(<VehiculosList vehiculos={[]} loading={false} error="caído" onSelect={vi.fn()} onCreateNew={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('caído');
  });

  it('lista patente, modelo, capacidad y estado de cada vehículo', () => {
    render(
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByText('AC123DE')).toBeInTheDocument();
    expect(screen.getByText('Toyota Etios')).toBeInTheDocument();
    expect(screen.getByText('Peugeot Partner')).toBeInTheDocument();
  });

  it('distingue el estado fuera de servicio con texto además de color (no solo color)', () => {
    render(
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByText(/fuera de servicio/i)).toBeInTheDocument();
  });

  it('dispara onSelect al hacer click en cualquier parte de la fila, no solo en el botón Editar', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    await user.click(screen.getByText('Toyota Etios'));
    expect(onSelect).toHaveBeenCalledWith(etios);
  });

  it('no duplica la llamada a onSelect cuando el click viene del botón Editar', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: /editar ac123de/i }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(etios);
  });
});

// Gateo de escritura (gateo-conductores, tasks.md 3.1/3.2). "+ Nuevo vehículo"/"Crear el primer
// vehículo" nunca se ocultan (decisión 1) — solo quedan deshabilitados. El módulo real es
// `conductores`, no un módulo `vehiculos` (que no existe en el backend).
describe('VehiculosList — gateo de escritura', () => {
  it('sin permiso de escritura: "+ Nuevo vehículo" queda visible y no se puede activar', () => {
    renderConPermiso(
      false,
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    const crear = screen.getByRole('button', { name: /\+ nuevo vehículo/i });
    expect(crear).toBeVisible();
    expect(crear).toBeDisabled();
  });

  it('sin permiso de escritura: "Crear el primer vehículo" (estado vacío) queda deshabilitado (triangulación)', () => {
    renderConPermiso(
      false,
      <VehiculosList vehiculos={[]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /crear el primer vehículo/i })).toBeDisabled();
  });

  it('con permiso de escritura: "+ Nuevo vehículo" está activable (triangulación)', () => {
    renderConPermiso(
      true,
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /\+ nuevo vehículo/i })).toBeEnabled();
  });

  it('sin permiso de escritura: "Editar" por fila queda visible y no se puede activar, y la fila sigue navegando al detalle', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    renderConPermiso(
      false,
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={onSelect} onCreateNew={vi.fn()} />,
    );

    const editar = screen.getByRole('button', { name: /editar ac123de/i });
    expect(editar).toBeVisible();
    expect(editar).toBeDisabled();

    await user.click(screen.getByText('Toyota Etios'));
    expect(onSelect).toHaveBeenCalledWith(etios);
  });

  it('con permiso de escritura: "Editar" por fila está activable (triangulación)', () => {
    renderConPermiso(
      true,
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /editar ac123de/i })).toBeEnabled();
  });

  it('sin permiso de escritura: el <button> nativo "Ver detalle" queda deshabilitado por el envoltorio', () => {
    renderConPermiso(
      false,
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getAllByRole('button', { name: /^ver detalle$/i })[0]).toBeDisabled();
  });

  it('con permiso de escritura: el <button> nativo "Ver detalle" está activable (triangulación)', () => {
    renderConPermiso(
      true,
      <VehiculosList vehiculos={[etios, partner]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />,
    );

    expect(screen.getAllByRole('button', { name: /^ver detalle$/i })[0]).toBeEnabled();
  });
});

// Rol admin sin filas de permisos (design.md D5).
describe('VehiculosList — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): la acción de alta está activable', () => {
    renderConPermiso(true, <VehiculosList vehiculos={[]} loading={false} error={null} onSelect={vi.fn()} onCreateNew={vi.fn()} />);
    expect(screen.getByRole('button', { name: /crear el primer vehículo/i })).toBeEnabled();
  });
});
