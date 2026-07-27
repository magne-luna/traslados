import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { VehiculoMantenimiento } from './VehiculoMantenimiento';

function buildVehiculo(overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id: 'v1',
    patente: 'AC123DE',
    modelo: 'Toyota Etios',
    tipo: 'sedan',
    capacidad: 4,
    accesoriosCompatibles: [],
    estado: 'habilitado',
    kilometraje: 10_000,
    kilometrajeUltimoService: 10_000,
    fechaUltimoService: '2026-07-01',
    habilitaciones: [],
    gastos: [],
    ...overrides,
  };
}

const ahora = new Date('2026-07-24');

describe('VehiculoMantenimiento', () => {
  it('muestra la alerta de service vencido con texto e ícono cuando el estado es "vencido"', () => {
    const vehiculo = buildVehiculo({ kilometraje: 25_000, kilometrajeUltimoService: 10_000 });

    render(<VehiculoMantenimiento vehiculo={vehiculo} ahora={ahora} />);

    expect(screen.getByText(/vencido/i)).toBeInTheDocument();
    expect(screen.getByText(/cambio de aceite/i)).toBeInTheDocument();
  });

  it('muestra la alerta de service "ok" cuando está al día', () => {
    const vehiculo = buildVehiculo({ kilometraje: 10_500, kilometrajeUltimoService: 10_000 });

    render(<VehiculoMantenimiento vehiculo={vehiculo} ahora={ahora} />);

    expect(screen.getByText(/al día/i)).toBeInTheDocument();
  });

  it('muestra las alertas de VTV y RTO identificando cuál habilitación y su estado', () => {
    const vehiculo = buildVehiculo({
      habilitaciones: [
        { tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2027-01-01' },
        { tipo: 'rto', fechaEmision: '2025-01-01', fechaVencimiento: '2026-01-01' },
      ],
    });

    render(<VehiculoMantenimiento vehiculo={vehiculo} ahora={ahora} />);

    expect(screen.getByText(/vtv/i)).toBeInTheDocument();
    expect(screen.getByText(/rto/i)).toBeInTheDocument();
    expect(screen.getByText(/vigente/i)).toBeInTheDocument();
    expect(screen.getByText(/vencida/i)).toBeInTheDocument();
  });

  it('VTV y RTO se muestran de forma independiente aunque una esté vencida y la otra vigente', () => {
    const vehiculo = buildVehiculo({
      habilitaciones: [
        { tipo: 'vtv', fechaEmision: '2026-01-01', fechaVencimiento: '2026-08-01' },
        { tipo: 'rto', fechaEmision: '2025-01-01', fechaVencimiento: '2026-01-01' },
      ],
    });

    render(<VehiculoMantenimiento vehiculo={vehiculo} ahora={ahora} />);

    expect(screen.getAllByText(/vencida|por vencer|vigente/i).length).toBeGreaterThanOrEqual(2);
  });
});
