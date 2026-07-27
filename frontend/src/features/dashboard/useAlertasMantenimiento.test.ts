import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { useAlertasMantenimiento } from './useAlertasMantenimiento';

// tasks.md 5.4: lee VehiculoRepository.list() con su propio estado de carga/error
// independiente. Hook de SOLO LECTURA — no expone crear/actualizar (design.md Non-Goals).

const vehiculo: Vehiculo = {
  id: 'v1',
  patente: 'AB123CD',
  modelo: 'Sprinter',
  tipo: 'combi',
  capacidad: 6,
  accesoriosCompatibles: [],
  estado: 'habilitado',
  kilometraje: 1000,
  kilometrajeUltimoService: 0,
  fechaUltimoService: '2026-01-01',
  habilitaciones: [],
  gastos: [],
};

function buildRepository(overrides: Partial<VehiculoRepository> = {}): VehiculoRepository {
  return { list: vi.fn().mockResolvedValue([vehiculo]), getById: vi.fn(), create: vi.fn(), update: vi.fn(), ...overrides };
}

describe('useAlertasMantenimiento', () => {
  it('expone los vehículos una vez que list() resuelve', async () => {
    const repository = buildRepository();
    const { result } = renderHook(() => useAlertasMantenimiento(repository));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.vehiculos).toEqual([vehiculo]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando falla la lectura', async () => {
    const repository = buildRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });
    const { result } = renderHook(() => useAlertasMantenimiento(repository));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.vehiculos).toEqual([]);
  });

  it('no expone ningún método de escritura', () => {
    const repository = buildRepository();
    const { result } = renderHook(() => useAlertasMantenimiento(repository));

    expect(result.current).not.toHaveProperty('crear');
    expect(result.current).not.toHaveProperty('actualizar');
  });
});
