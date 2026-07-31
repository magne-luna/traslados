import { describe, expect, it } from 'vitest';
import type { Vehiculo } from '../../types/vehiculo';
import type { Conductor } from '../../types/conductor';
import { vehiculosDisponibles, conductoresDisponibles } from './disponibilidad';

// Funciones puras (tasks.md 2.2, design.md Decisión 7): RN-VE-02 — solo vehículos 'habilitado' y
// conductores 'operando' están disponibles para armar la hoja de ruta. Sin efectos de red ni
// localStorage.

function buildVehiculo(overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id: 'vehiculo-1',
    patente: 'AA111AA',
    modelo: 'Test',
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
    id: 'conductor-1',
    apellido: 'Test',
    nombre: 'Test',
    documento: '1',
    domicilio: 'Test',
    cuil: '20-1-1',
    estado: 'operando',
    restricciones: [],
    asignaciones: [],
    ...overrides,
  };
}

describe('vehiculosDisponibles', () => {
  it('excluye vehículos fuera de servicio (RN-VE-02)', () => {
    const habilitado = buildVehiculo({ id: 'v-hab', estado: 'habilitado' });
    const fueraDeServicio = buildVehiculo({ id: 'v-fds', estado: 'fuera-de-servicio' });

    const resultado = vehiculosDisponibles([habilitado, fueraDeServicio]);

    expect(resultado).toEqual([habilitado]);
  });

  it('devuelve todos los vehículos cuando todos están habilitados (triangulación)', () => {
    const uno = buildVehiculo({ id: 'v-1' });
    const dos = buildVehiculo({ id: 'v-2' });

    expect(vehiculosDisponibles([uno, dos])).toEqual([uno, dos]);
  });

  it('devuelve un array vacío si no hay vehículos disponibles (borde)', () => {
    const fueraDeServicio = buildVehiculo({ estado: 'fuera-de-servicio' });

    expect(vehiculosDisponibles([fueraDeServicio])).toEqual([]);
  });
});

describe('conductoresDisponibles', () => {
  it('excluye conductores fuera de servicio (RN-VE-02)', () => {
    const operando = buildConductor({ id: 'c-op', estado: 'operando' });
    const fueraDeServicio = buildConductor({ id: 'c-fds', estado: 'fuera-de-servicio' });

    const resultado = conductoresDisponibles([operando, fueraDeServicio]);

    expect(resultado).toEqual([operando]);
  });

  it('devuelve todos los conductores cuando todos están operando (triangulación)', () => {
    const uno = buildConductor({ id: 'c-1' });
    const dos = buildConductor({ id: 'c-2' });

    expect(conductoresDisponibles([uno, dos])).toEqual([uno, dos]);
  });

  it('devuelve un array vacío si no hay conductores disponibles (borde)', () => {
    const fueraDeServicio = buildConductor({ estado: 'fuera-de-servicio' });

    expect(conductoresDisponibles([fueraDeServicio])).toEqual([]);
  });
});
