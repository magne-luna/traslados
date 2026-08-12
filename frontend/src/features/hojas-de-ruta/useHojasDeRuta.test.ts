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

  // Regresión (fix "Sugerir orden no hace nada, se recarga la página", 2026-08-11): actualizar()
  // y crear() reusaban cargar() para el refetch posterior, tildando `loading` también ahí. Eso
  // desmontaba toda la vista de armado (incluida la tarjeta en modo "Editar") mientras el refetch
  // seguía pendiente. Este test deja el refetch colgado a propósito (list() sin resolver) para
  // observar `loading` en ese punto intermedio.
  it('actualizar() no vuelve a poner loading en true mientras el refetch está pendiente', async () => {
    let resolveList: (hojas: HojaDeRuta[]) => void = () => {};
    const refetchPendiente = new Promise<HojaDeRuta[]>((resolve) => {
      resolveList = resolve;
    });
    const repository = buildFakeRepository({
      list: vi.fn().mockResolvedValueOnce([hojaDeHoy]).mockReturnValueOnce(refetchPendiente),
    });
    const { result } = renderHook(() => useHojasDeRuta(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let actualizarPromise!: Promise<HojaDeRuta>;
    act(() => {
      actualizarPromise = result.current.actualizar('hoja-de-ruta-hoy', { notas: 'nota' });
    });

    await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveList([hojaDeHoy]);
      await actualizarPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('crear() no vuelve a poner loading en true mientras el refetch está pendiente', async () => {
    let resolveList: (hojas: HojaDeRuta[]) => void = () => {};
    const refetchPendiente = new Promise<HojaDeRuta[]>((resolve) => {
      resolveList = resolve;
    });
    const repository = buildFakeRepository({
      list: vi.fn().mockResolvedValueOnce([hojaDeHoy]).mockReturnValueOnce(refetchPendiente),
    });
    const { result } = renderHook(() => useHojasDeRuta(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let crearPromise!: Promise<HojaDeRuta>;
    act(() => {
      crearPromise = result.current.crear({ fecha: '2026-08-01', franjaInicio: '08:00', franjaFin: '20:00', recorridos: [] });
    });

    await waitFor(() => expect(repository.create).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveList([hojaDeHoy]);
      await crearPromise;
    });

    expect(result.current.loading).toBe(false);
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
