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

// Hook de wiring (tasks.md 4.1/8.x, patrón useVehiculos): expone la hoja de UN día concreto y
// recarga por esa misma fecha tras cada mutación (crear/actualizar). paginacion-listados Fase 1
// (design.md §D7): reemplaza `list()` + `.find(h => h.fecha === fecha)` por `getByFecha(fecha)` —
// la pantalla nunca necesitó la historia completa, solo el día seleccionado.
describe('useHojasDeRuta', () => {
  it('arranca en loading, invoca getByFecha(fecha) — nunca list() — y expone la hoja del día una vez que resuelve (tasks.md 8.1/8.7)', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHook(() => useHojasDeRuta(repository, '2026-07-24'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(repository.getByFecha).toHaveBeenCalledWith('2026-07-24');
    expect(repository.list).not.toHaveBeenCalled();
    expect(result.current.hojaDeRuta).toEqual(hojaDeHoy);
    expect(result.current.error).toBeNull();
  });

  // Triangulación 8.3: un día sin hoja de ruta cargada es un estado propio (`null`), no un error.
  it('expone null cuando getByFecha() resuelve sin hoja para ese día (triangulación 8.3)', async () => {
    const repository = buildFakeRepository({ getByFecha: vi.fn().mockResolvedValue(null) });

    const { result } = renderHook(() => useHojasDeRuta(repository, '2026-07-25'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hojaDeRuta).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // Triangulación 8.4: cambiar de fecha vuelve a consultar la fecha nueva y descarta la anterior
  // — nunca se acumulan días en memoria (el estado guarda una sola hoja, no un array).
  it('cambiar de fecha vuelve a invocar getByFecha con la fecha nueva y descarta la anterior (triangulación 8.4)', async () => {
    const hojaDelDia25: HojaDeRuta = { ...hojaDeHoy, id: 'hoja-de-ruta-25', fecha: '2026-07-25' };
    const getByFecha = vi
      .fn()
      .mockResolvedValueOnce(hojaDeHoy)
      .mockResolvedValueOnce(hojaDelDia25);
    const repository = buildFakeRepository({ getByFecha });

    const { result, rerender } = renderHook(({ fecha }) => useHojasDeRuta(repository, fecha), {
      initialProps: { fecha: '2026-07-24' },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.hojaDeRuta).toEqual(hojaDeHoy);

    rerender({ fecha: '2026-07-25' });

    await waitFor(() => expect(result.current.hojaDeRuta).toEqual(hojaDelDia25));
    expect(getByFecha).toHaveBeenNthCalledWith(1, '2026-07-24');
    expect(getByFecha).toHaveBeenNthCalledWith(2, '2026-07-25');
  });

  // Triangulación 8.5: un error del repository queda visible y no deja loading colgado.
  it('expone un error legible cuando getByFecha() rechaza la promesa (triangulación 8.5)', async () => {
    const repository = buildFakeRepository({ getByFecha: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHook(() => useHojasDeRuta(repository, '2026-07-24'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.hojaDeRuta).toBeNull();
  });

  it('crear() llama a repository.create() y recarga por fecha (getByFecha, nunca list)', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useHojasDeRuta(repository, '2026-07-24'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({ fecha: '2026-07-24', franjaInicio: '08:00', franjaFin: '20:00', recorridos: [] });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.getByFecha).toHaveBeenCalledTimes(2); // carga inicial + recarga tras crear
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('actualizar() llama a repository.update() y recarga por fecha (getByFecha, nunca list)', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useHojasDeRuta(repository, '2026-07-24'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('hoja-de-ruta-hoy', { notas: 'nota' });
    });

    expect(repository.update).toHaveBeenCalledWith('hoja-de-ruta-hoy', { notas: 'nota' });
    expect(repository.getByFecha).toHaveBeenCalledTimes(2);
    expect(repository.list).not.toHaveBeenCalled();
  });

  // ⚠️ Regresión obligatoria (design.md §D7 "Cuidado en el apply", tasks.md 8.6; fix original
  // "Sugerir orden no hace nada, se recarga la página", 2026-08-11): actualizar()/crear() reusaban
  // cargar() para el refetch posterior, tildando `loading` también ahí. Eso desmontaba toda la
  // vista de armado (incluida la tarjeta en modo "Editar") mientras el refetch seguía pendiente.
  // Este test deja el refetch colgado a propósito (getByFecha() sin resolver la segunda vez) para
  // observar `loading` en ese punto intermedio — el mismo riesgo que reintroduciría cambiar `list()`
  // por `getByFecha()` sin preservar `{ silencioso: true }`.
  it('actualizar() no vuelve a poner loading en true mientras el refetch está pendiente (regresión obligatoria 8.6)', async () => {
    let resolveGetByFecha: (hoja: HojaDeRuta | null) => void = () => {};
    const refetchPendiente = new Promise<HojaDeRuta | null>((resolve) => {
      resolveGetByFecha = resolve;
    });
    const repository = buildFakeRepository({
      getByFecha: vi.fn().mockResolvedValueOnce(hojaDeHoy).mockReturnValueOnce(refetchPendiente),
    });
    const { result } = renderHook(() => useHojasDeRuta(repository, '2026-07-24'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let actualizarPromise!: Promise<HojaDeRuta>;
    act(() => {
      actualizarPromise = result.current.actualizar('hoja-de-ruta-hoy', { notas: 'nota' });
    });

    await waitFor(() => expect(repository.update).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveGetByFecha(hojaDeHoy);
      await actualizarPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('crear() no vuelve a poner loading en true mientras el refetch está pendiente (regresión obligatoria 8.6)', async () => {
    let resolveGetByFecha: (hoja: HojaDeRuta | null) => void = () => {};
    const refetchPendiente = new Promise<HojaDeRuta | null>((resolve) => {
      resolveGetByFecha = resolve;
    });
    const repository = buildFakeRepository({
      getByFecha: vi.fn().mockResolvedValueOnce(hojaDeHoy).mockReturnValueOnce(refetchPendiente),
    });
    const { result } = renderHook(() => useHojasDeRuta(repository, '2026-07-24'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let crearPromise!: Promise<HojaDeRuta>;
    act(() => {
      crearPromise = result.current.crear({ fecha: '2026-08-01', franjaInicio: '08:00', franjaFin: '20:00', recorridos: [] });
    });

    await waitFor(() => expect(repository.create).toHaveBeenCalledTimes(1));
    expect(result.current.loading).toBe(false);

    await act(async () => {
      resolveGetByFecha(hojaDeHoy);
      await crearPromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it('crear() propaga el error del repository sin dejar loading colgado (borde)', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('falló create')) });
    const { result } = renderHook(() => useHojasDeRuta(repository, '2026-07-24'));
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
