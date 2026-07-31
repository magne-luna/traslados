import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Vehiculo } from '../../shared/types/vehiculo';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { useVehiculos } from './useVehiculos';

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

function buildFakeRepository(overrides: Partial<VehiculoRepository> = {}): VehiculoRepository {
  return {
    list: vi.fn().mockResolvedValue([etios]),
    getById: vi.fn().mockResolvedValue(etios),
    create: vi.fn().mockResolvedValue(etios),
    update: vi.fn().mockResolvedValue(etios),
    ...overrides,
  };
}

describe('useVehiculos', () => {
  it('arranca en loading y expone la lista una vez que list() resuelve', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHook(() => useVehiculos(repository));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.vehiculos).toEqual([etios]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa (triangulación)', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHook(() => useVehiculos(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.vehiculos).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useVehiculos(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({
        patente: 'ZZ000ZZ',
        modelo: 'Fiat Fiorino',
        tipo: 'furgon',
        capacidad: 2,
        accesoriosCompatibles: [],
        estado: 'habilitado',
        kilometraje: 0,
        kilometrajeUltimoService: 0,
        fechaUltimoService: '2026-01-01',
        habilitaciones: [],
        gastos: [],
        mantenimientos: [],
      });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.list).toHaveBeenCalledTimes(2); // carga inicial + recarga tras crear
  });

  it('actualizar() llama a repository.update() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useVehiculos(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('vehiculo-etios', { kilometraje: 90_000 });
    });

    expect(repository.update).toHaveBeenCalledWith('vehiculo-etios', { kilometraje: 90_000 });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('crear() propaga el error del repository sin dejar loading colgado', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('patente duplicada')) });
    const { result } = renderHook(() => useVehiculos(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.crear({
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
        }),
      ).rejects.toThrow('patente duplicada');
    });

    expect(result.current.error).toBe('patente duplicada');
    expect(result.current.loading).toBe(false);
  });
});
