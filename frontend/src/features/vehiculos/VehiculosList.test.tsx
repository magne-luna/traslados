import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { VehiculosList } from './VehiculosList';

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
