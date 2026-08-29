import { act, waitFor } from '@testing-library/react';
import { crearQueryClientDeTest, renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { Autorizacion } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import { useAutorizaciones } from './useAutorizaciones';

const autorizacionFacundo: Autorizacion = {
  id: 'autorizacion-facundo-1',
  presupuestoId: 'presupuesto-facundo-1',
  estado: 'autorizada',
  montoAutorizado: 90_000,
};

function buildFakeRepository(overrides: Partial<AutorizacionRepository> = {}): AutorizacionRepository {
  return {
    list: vi.fn().mockResolvedValue([autorizacionFacundo]),
    getById: vi.fn().mockResolvedValue(autorizacionFacundo),
    listByPresupuestoId: vi.fn().mockResolvedValue([autorizacionFacundo]),
    create: vi.fn().mockResolvedValue(autorizacionFacundo),
    update: vi.fn().mockResolvedValue(autorizacionFacundo),
    uploadArchivo: vi.fn().mockResolvedValue(autorizacionFacundo),
    removeArchivo: vi.fn().mockResolvedValue(autorizacionFacundo),
    getUrlArchivo: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe('useAutorizaciones', () => {
  it('arranca en loading y expone la lista una vez que list() resuelve', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHookConQuery(() => useAutorizaciones(repository));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.autorizaciones).toEqual([autorizacionFacundo]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa (triangulación)', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHookConQuery(() => useAutorizaciones(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.autorizaciones).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useAutorizaciones(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({ presupuestoId: 'presupuesto-martina-1', estado: 'pendiente' });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('actualizar() llama a repository.update() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useAutorizaciones(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('autorizacion-facundo-1', { estado: 'judicializada' });
    });

    expect(repository.update).toHaveBeenCalledWith('autorizacion-facundo-1', { estado: 'judicializada' });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('actualizar() propaga el error del repository sin dejar loading colgado', async () => {
    const repository = buildFakeRepository({ update: vi.fn().mockRejectedValue(new Error('monto excede el presupuesto')) });
    const { result } = renderHookConQuery(() => useAutorizaciones(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.actualizar('autorizacion-facundo-1', { montoAutorizado: 999_999 })).rejects.toThrow(
        'monto excede el presupuesto',
      );
    });

    expect(result.current.error).toBe('monto excede el presupuesto');
    expect(result.current.loading).toBe(false);
  });

  // migracion-react-query, tasks.md 4.2/4.3 — REGLA DURA de la Fase 4 (riesgo R2).
  it('es TRANSACCIONAL: dos montajes sucesivos consultan al servidor las DOS veces', async () => {
    const repository = buildFakeRepository();
    const client = crearQueryClientDeTest();

    const primero = renderHookConQuery(() => useAutorizaciones(repository), { client });
    await waitFor(() => expect(primero.result.current.loading).toBe(false));
    primero.unmount();

    const segundo = renderHookConQuery(() => useAutorizaciones(repository), { client });
    await waitFor(() => expect(segundo.result.current.loading).toBe(false));

    // Si esto llegara a dar 1, alguien le puso FRESCURA.referencia a un dominio que es dinero.
    expect(repository.list).toHaveBeenCalledTimes(2);
  });
});
