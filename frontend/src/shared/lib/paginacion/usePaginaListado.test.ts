import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePaginaListado } from './usePaginaListado';
import type { Pagina } from '../../types/paginacion';

interface ItemFalso {
  id: string;
}

interface FiltrosFalsos {
  busqueda: string;
}

function paginaFalsa(items: ItemFalso[], total: number, pagina: number, tamanio: number): Pagina<ItemFalso> {
  return { items, total, pagina, tamanio };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('usePaginaListado', () => {
  it('al montar, invoca listPage con { pagina: 1, tamanio } y expone items y total', async () => {
    const listPage = vi.fn().mockResolvedValue(paginaFalsa([{ id: '1' }, { id: '2' }], 2, 1, 20));

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(listPage).toHaveBeenCalledTimes(1);
    expect(listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    expect(result.current.items).toEqual([{ id: '1' }, { id: '2' }]);
    expect(result.current.total).toBe(2);
  });

  it('irAPagina(3) re-invoca listPage con pagina: 3 (navegación, 4.3)', async () => {
    const listPage = vi.fn().mockResolvedValue(paginaFalsa([], 50, 1, 20));

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    listPage.mockClear();

    act(() => {
      result.current.irAPagina(3);
    });

    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(1));
    expect(listPage).toHaveBeenCalledWith({ pagina: 3, tamanio: 20, filtros: { busqueda: '' } });
    expect(result.current.pagina).toBe(3);
  });

  it('reset de página al filtrar: en página 5, cambiar el término vuelve a pagina: 1 (4.4)', async () => {
    vi.useFakeTimers();
    const listPage = vi.fn().mockResolvedValue(paginaFalsa([], 3, 1, 20));

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(result.current.loading).toBe(false);

    act(() => {
      result.current.irAPagina(5);
    });
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(result.current.pagina).toBe(5);

    listPage.mockClear();
    act(() => {
      result.current.setBusqueda('juan');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.pagina).toBe(1);
    expect(listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: 'juan' } });
  });

  it('debounce: varias escrituras dentro de la ventana → una sola invocación con el término final (4.5)', async () => {
    vi.useFakeTimers();
    const listPage = vi.fn().mockResolvedValue(paginaFalsa([], 0, 1, 20));

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
        debounceMs: 300,
      }),
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    listPage.mockClear();

    act(() => {
      result.current.setBusqueda('j');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    act(() => {
      result.current.setBusqueda('ju');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    act(() => {
      result.current.setBusqueda('juan');
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(listPage).toHaveBeenCalledTimes(1);
    expect(listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: 'juan' } });
  });

  it('el input no se retrasa: el valor crudo se refleja de inmediato aunque la consulta se difiera (4.6)', async () => {
    vi.useFakeTimers();
    const listPage = vi.fn().mockResolvedValue(paginaFalsa([], 0, 1, 20));

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });

    act(() => {
      result.current.setBusqueda('j');
    });

    // Sin avanzar el timer del debounce: el valor crudo ya cambió, la query todavía no.
    expect(result.current.busqueda).toBe('j');
    expect(listPage).not.toHaveBeenCalledWith(expect.objectContaining({ filtros: { busqueda: 'j' } }));
  });

  it('error: listPage rechaza → mensaje en castellano y loading en false (4.7)', async () => {
    const listPage = vi.fn().mockRejectedValue(new Error('Error de red al listar.'));

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Error de red al listar.');
  });

  it('error sin instancia de Error (rechazo con un valor no-Error) → mensaje genérico en castellano', async () => {
    const listPage = vi.fn().mockRejectedValue('boom');

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Ocurrió un error inesperado.');
  });

  it('respuesta fuera de orden: la respuesta de una consulta vieja no pisa el resultado vigente (4.8)', async () => {
    let resolverPrimera: ((pagina: Pagina<ItemFalso>) => void) | undefined;
    let resolverSegunda: ((pagina: Pagina<ItemFalso>) => void) | undefined;

    const listPage = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Pagina<ItemFalso>>((resolve) => {
            resolverPrimera = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<Pagina<ItemFalso>>((resolve) => {
            resolverSegunda = resolve;
          }),
      );

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    // Dispara una segunda consulta (navegar a la página 2) antes de que la primera (mount) resuelva.
    act(() => {
      result.current.irAPagina(2);
    });

    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(2));

    // La segunda consulta (la vigente) resuelve primero...
    await act(async () => {
      resolverSegunda?.(paginaFalsa([{ id: 'pagina-2' }], 40, 2, 20));
    });
    // ...y la primera (vieja) resuelve después: no debe pisar el resultado de la página 2.
    await act(async () => {
      resolverPrimera?.(paginaFalsa([{ id: 'pagina-1-vieja' }], 40, 1, 20));
    });

    expect(result.current.items).toEqual([{ id: 'pagina-2' }]);
    expect(result.current.pagina).toBe(2);
  });

  // paginacion-listados, Fase 2, tasks.md 13.7: tras crear/editar un registro desde una pantalla
  // que usa este hook, el listado debe poder "recargar la página vigente" — ni saltar a la
  // página 1 (eso ya lo cubre 4.4, pero solo dispara con un cambio de término) ni quedarse
  // desactualizado mostrando datos viejos hasta que la usuaria toque algo.
  it('recargar() vuelve a invocar listPage con la MISMA página y término (13.7)', async () => {
    const listPage = vi.fn().mockResolvedValue(paginaFalsa([{ id: '1' }], 1, 1, 20));

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    listPage.mockClear();
    listPage.mockResolvedValue(paginaFalsa([{ id: '1-actualizado' }], 1, 1, 20));

    act(() => {
      result.current.recargar();
    });

    await waitFor(() => expect(listPage).toHaveBeenCalledTimes(1));
    expect(listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    await waitFor(() => expect(result.current.items).toEqual([{ id: '1-actualizado' }]));
  });

  it('recargar() no resetea la página a 1 (a diferencia de cambiar el término, 4.4)', async () => {
    const listPage = vi.fn().mockResolvedValue(paginaFalsa([], 50, 1, 20));

    const { result } = renderHook(() =>
      usePaginaListado<ItemFalso, FiltrosFalsos>({
        listPage,
        tamanio: 20,
        construirFiltros: (busqueda) => ({ busqueda }),
      }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => {
      result.current.irAPagina(3);
    });
    await waitFor(() => expect(result.current.pagina).toBe(3));

    act(() => {
      result.current.recargar();
    });

    await waitFor(() => expect(listPage).toHaveBeenCalledWith({ pagina: 3, tamanio: 20, filtros: { busqueda: '' } }));
    expect(result.current.pagina).toBe(3);
  });
});
