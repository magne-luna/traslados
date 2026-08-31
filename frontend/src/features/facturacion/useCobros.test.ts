import { act, waitFor } from '@testing-library/react';
import { renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { Cobro } from '../../shared/types/factura';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import { useCobros } from './useCobros';

const cobro1: Cobro = { id: 'cobro-1', facturaId: 'factura-1', fecha: '2026-08-01', montoPagado: 500 };

function buildFakeRepository(overrides: Partial<CobroRepository> = {}): CobroRepository {
  return {
    list: vi.fn().mockResolvedValue([cobro1]),
    listByFactura: vi.fn().mockResolvedValue([cobro1]),
    create: vi.fn().mockResolvedValue(cobro1),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useCobros', () => {
  it('arranca en loading y expone los cobros de la factura una vez que listByFactura() resuelve', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHookConQuery(() => useCobros(repository, 'factura-1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.cobros).toEqual([cobro1]);
    expect(repository.listByFactura).toHaveBeenCalledWith('factura-1');
  });

  it('expone un error legible cuando listByFactura() rechaza la promesa', async () => {
    const repository = buildFakeRepository({ listByFactura: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHookConQuery(() => useCobros(repository, 'factura-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.cobros).toEqual([]);
  });

  it('registrar() llama a repository.create() y recarga los cobros de la factura', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useCobros(repository, 'factura-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.registrar({ facturaId: 'factura-1', fecha: '2026-08-10', montoPagado: 300 });
    });

    expect(repository.create).toHaveBeenCalledWith({ facturaId: 'factura-1', fecha: '2026-08-10', montoPagado: 300 });
    expect(repository.listByFactura).toHaveBeenCalledTimes(2);
  });

  it('eliminar() llama a repository.remove() y recarga los cobros de la factura', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useCobros(repository, 'factura-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.eliminar('cobro-1');
    });

    expect(repository.remove).toHaveBeenCalledWith('cobro-1');
    expect(repository.listByFactura).toHaveBeenCalledTimes(2);
  });

  it('no consulta cobros cuando la factura todavía no tiene id (alta nueva) — evita el 400 de PostgREST', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useCobros(repository, ''));

    // ni siquiera arranca la consulta: sin id no hay cobros que traer
    expect(repository.listByFactura).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.cobros).toEqual([]);
  });
});
