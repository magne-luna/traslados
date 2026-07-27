import { describe, expect, it } from 'vitest';
import type { Vehiculo } from '../../types/vehiculo';
import type { Recorrido } from '../../types/hojaDeRuta';
import { capacidadDisponible } from './capacidadDisponible';

// Función pura (tasks.md 2.3, design.md Decisión 7): hay lugar si la cantidad de pasajeros del
// recorrido es MENOR que la capacidad del vehículo. Sin efectos de red ni localStorage.

function buildVehiculo(capacidad: number): Vehiculo {
  return {
    id: 'vehiculo-1',
    patente: 'AA111AA',
    modelo: 'Test',
    tipo: 'sedan',
    capacidad,
    accesoriosCompatibles: [],
    estado: 'habilitado',
    kilometraje: 0,
    kilometrajeUltimoService: 0,
    fechaUltimoService: '2026-01-01',
    habilitaciones: [],
    gastos: [],
  };
}

function buildRecorrido(cantidadPasajeros: number): Recorrido {
  return {
    id: 'recorrido-1',
    vehiculoId: 'vehiculo-1',
    conductorId: 'conductor-1',
    manual: false,
    paradas: Array.from({ length: cantidadPasajeros }, (_, i) => ({
      id: `parada-${i}`,
      pacienteId: `paciente-${i}`,
      tramo: 'ida' as const,
      direccionOrigenId: `dir-origen-${i}`,
      direccionDestinoId: `dir-destino-${i}`,
      orden: i,
    })),
  };
}

describe('capacidadDisponible', () => {
  it('devuelve false cuando el recorrido ya tiene tantos pasajeros como la capacidad del vehículo (vehículo lleno)', () => {
    const vehiculo = buildVehiculo(2);
    const recorrido = buildRecorrido(2);

    expect(capacidadDisponible(vehiculo, recorrido)).toBe(false);
  });

  it('devuelve true cuando la cantidad de pasajeros es menor que la capacidad (triangulación)', () => {
    const vehiculo = buildVehiculo(4);
    const recorrido = buildRecorrido(1);

    expect(capacidadDisponible(vehiculo, recorrido)).toBe(true);
  });

  it('devuelve true cuando el recorrido no tiene pasajeros todavía (borde)', () => {
    const vehiculo = buildVehiculo(3);
    const recorrido = buildRecorrido(0);

    expect(capacidadDisponible(vehiculo, recorrido)).toBe(true);
  });
});
