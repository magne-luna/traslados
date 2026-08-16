import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Vehiculo } from '../../shared/types/vehiculo';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
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
    mantenimientos: [],
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

  // D3-B (tasks.md 2B.3): el estado vacío deja de decir "Sin habilitaciones registradas" a secas
  // y pasa a explicar de dónde salen — se cargan como intervención preventiva VTV/RTO en el
  // historial de abajo, no en un alta propia.
  it('el estado vacío de habilitaciones explica que se cargan como intervención preventiva del historial', () => {
    const vehiculo = buildVehiculo({ habilitaciones: [] });

    render(<VehiculoMantenimiento vehiculo={vehiculo} ahora={ahora} />);

    expect(screen.getByText(/se registran como intervención preventiva/i)).toBeInTheDocument();
    expect(screen.queryByText(/^sin habilitaciones registradas\.?$/i)).not.toBeInTheDocument();
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

// Gateo de escritura (gateo-conductores, design.md D5, tasks.md 4.2): VehiculoMantenimiento es
// puramente de consulta hoy — no tiene ninguna acción ni campo interactivo en el código actual
// (a diferencia de lo que da a entender el nombre "mantenimiento"). No hay nada que gatear; el
// requisito "sigue siendo legible sin permiso de escritura" se cumple trivialmente y se verifica
// acá con ambos valores de permiso, para dejar constancia explícita (no asumida) de que no hay
// ninguna regresión de lectura al introducir el contexto de permisos en el árbol.
describe('VehiculoMantenimiento — gateo de escritura (sin acciones que gatear)', () => {
  it('sin permiso de escritura: la información de mantenimiento sigue completamente legible', () => {
    const vehiculo = buildVehiculo({ kilometraje: 25_000, kilometrajeUltimoService: 10_000 });

    render(
      <PuedeEscribirContext.Provider value={false}>
        <VehiculoMantenimiento vehiculo={vehiculo} ahora={ahora} />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/vencido/i)).toBeInTheDocument();
    expect(screen.getByText(/cambio de aceite/i)).toBeInTheDocument();
  });

  it('con permiso de escritura: la información se muestra igual (triangulación, no hay diferencia de comportamiento)', () => {
    const vehiculo = buildVehiculo({ kilometraje: 25_000, kilometrajeUltimoService: 10_000 });

    render(
      <PuedeEscribirContext.Provider value={true}>
        <VehiculoMantenimiento vehiculo={vehiculo} ahora={ahora} />
      </PuedeEscribirContext.Provider>,
    );

    expect(screen.getByText(/vencido/i)).toBeInTheDocument();
  });
});
