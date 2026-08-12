import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Presupuesto } from '../../shared/types/presupuesto';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import { usePresupuestos } from './usePresupuestos';

const presupuestoMartina: Presupuesto = {
  id: 'presupuesto-martina-1',
  pacienteId: 'paciente-martina',
  obraSocialId: 'osecac',
  monto: 150_000,
  fechaEmision: '2026-06-01',
};

function buildFakeRepository(overrides: Partial<PresupuestoRepository> = {}): PresupuestoRepository {
  return {
    list: vi.fn().mockResolvedValue([presupuestoMartina]),
    getById: vi.fn().mockResolvedValue(presupuestoMartina),
    create: vi.fn().mockResolvedValue(presupuestoMartina),
    createLote: vi.fn().mockResolvedValue([presupuestoMartina]),
    update: vi.fn().mockResolvedValue(presupuestoMartina),
    ...overrides,
  };
}

describe('usePresupuestos', () => {
  it('arranca en loading y expone la lista una vez que list() resuelve', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHook(() => usePresupuestos(repository));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.presupuestos).toEqual([presupuestoMartina]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa (triangulación)', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHook(() => usePresupuestos(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.presupuestos).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => usePresupuestos(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({
        pacienteId: 'paciente-facundo',
        obraSocialId: 'osecac',
        monto: 50_000,
        fechaEmision: '2026-07-01',
      });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('actualizar() llama a repository.update() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => usePresupuestos(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('presupuesto-martina-1', { monto: 200_000 });
    });

    expect(repository.update).toHaveBeenCalledWith('presupuesto-martina-1', { monto: 200_000 });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('crear() propaga el error del repository sin dejar loading colgado', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('paciente inválido')) });
    const { result } = renderHook(() => usePresupuestos(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.crear({
          pacienteId: 'paciente-facundo',
          obraSocialId: 'osecac',
          monto: 50_000,
          fechaEmision: '2026-07-01',
        }),
      ).rejects.toThrow('paciente inválido');
    });

    expect(result.current.error).toBe('paciente inválido');
    expect(result.current.loading).toBe(false);
  });
});
