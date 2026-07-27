import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import { useHojasDeRuta } from './useHojasDeRuta';

const hojaDeHoy: HojaDeRuta = {
  id: 'hoja-de-ruta-hoy',
  fecha: '2026-07-24',
  franjaInicio: '08:00',
  franjaFin: '20:00',
  recorridos: [],
};

function buildFakeRepository(overrides: Partial<HojaDeRutaRepository> = {}): HojaDeRutaRepository {
  return {
    list: vi.fn().mockResolvedValue([hojaDeHoy]),
    getById: vi.fn().mockResolvedValue(hojaDeHoy),
    getByFecha: vi.fn().mockResolvedValue(hojaDeHoy),
    create: vi.fn().mockResolvedValue(hojaDeHoy),
    update: vi.fn().mockResolvedValue(hojaDeHoy),
    ...overrides,
  };
}

// Hook de wiring (tasks.md 4.1, patrón useVehiculos): expone datos/loading/error y recarga la
// lista tras cada mutación (crear/actualizar).
describe('useHojasDeRuta', () => {
  it('arranca en loading y expone la lista una vez que list() resuelve', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHook(() => useHojasDeRuta(repository));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hojasDeRuta).toEqual([hojaDeHoy]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa (triangulación)', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHook(() => useHojasDeRuta(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.hojasDeRuta).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useHojasDeRuta(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({ fecha: '2026-08-01', franjaInicio: '08:00', franjaFin: '20:00', recorridos: [] });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.list).toHaveBeenCalledTimes(2); // carga inicial + recarga tras crear
  });

  it('actualizar() llama a repository.update() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useHojasDeRuta(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('hoja-de-ruta-hoy', { notas: 'nota' });
    });

    expect(repository.update).toHaveBeenCalledWith('hoja-de-ruta-hoy', { notas: 'nota' });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('crear() propaga el error del repository sin dejar loading colgado (borde)', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('falló create')) });
    const { result } = renderHook(() => useHojasDeRuta(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.crear({ fecha: '2026-08-01', franjaInicio: '08:00', franjaFin: '20:00', recorridos: [] }),
      ).rejects.toThrow('falló create');
    });

    expect(result.current.error).toBe('falló create');
    expect(result.current.loading).toBe(false);
  });
});
