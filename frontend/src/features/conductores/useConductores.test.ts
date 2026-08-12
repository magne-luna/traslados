import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Conductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import { useConductores } from './useConductores';

const perez: Conductor = {
  id: 'conductor-perez',
  apellido: 'Pérez',
  nombre: 'Carlos',
  documento: '15789456',
  domicilio: 'Calle 50 N° 1234, La Plata',
  cuil: '20-15789456-9',
  estado: 'operando',
  asignaciones: [],
};

function buildFakeRepository(overrides: Partial<ConductorRepository> = {}): ConductorRepository {
  return {
    list: vi.fn().mockResolvedValue([perez]),
    listPage: vi.fn().mockResolvedValue({ items: [perez], total: 1, pagina: 1, tamanio: 20 }),
    getById: vi.fn().mockResolvedValue(perez),
    create: vi.fn().mockResolvedValue(perez),
    update: vi.fn().mockResolvedValue(perez),
    ...overrides,
  };
}

describe('useConductores', () => {
  it('arranca en loading y expone la lista una vez que list() resuelve', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHook(() => useConductores(repository));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.conductores).toEqual([perez]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa (triangulación)', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHook(() => useConductores(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.conductores).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useConductores(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({
        apellido: 'Fernández',
        nombre: 'Ana',
        documento: '99887766',
        domicilio: 'Belgrano 200, Quilmes',
        cuil: '27-99887766-1',
        estado: 'operando',
        asignaciones: [],
      });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.list).toHaveBeenCalledTimes(2); // carga inicial + recarga tras crear
  });

  it('actualizar() llama a repository.update() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useConductores(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('conductor-perez', { telefono: '11-0000-1111' });
    });

    expect(repository.update).toHaveBeenCalledWith('conductor-perez', { telefono: '11-0000-1111' });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('crear() propaga el error del repository sin dejar loading colgado', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('documento duplicado')) });
    const { result } = renderHook(() => useConductores(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.crear({
          apellido: 'Pérez',
          nombre: 'Carlos',
          documento: '15789456',
          domicilio: 'Calle 50 N° 1234, La Plata',
          cuil: '20-15789456-9',
          estado: 'operando',
          asignaciones: [],
        }),
      ).rejects.toThrow('documento duplicado');
    });

    expect(result.current.error).toBe('documento duplicado');
    expect(result.current.loading).toBe(false);
  });
});
