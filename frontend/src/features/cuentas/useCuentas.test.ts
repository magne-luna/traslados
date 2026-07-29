import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Cuenta, CuentaRepository } from '../../shared/lib/cuentas/CuentaRepository';
import { useCuentas } from './useCuentas';

const ADMIN: Cuenta = {
  id: 'u1',
  email: 'andrea@x.com',
  nombre: 'Andrea',
  apellido: 'Pastor',
  rol: 'admin',
  permisos: { pacientes: 'admin' },
};

function buildFakeRepository(overrides: Partial<CuentaRepository> = {}): CuentaRepository {
  return {
    listarCuentas: vi.fn().mockResolvedValue([ADMIN]),
    crearCuenta: vi.fn().mockResolvedValue(undefined),
    actualizarPermisos: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('useCuentas', () => {
  it('arranca en loading y expone el listado una vez que listarCuentas() resuelve', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useCuentas(repository));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.cuentas).toEqual([ADMIN]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando listarCuentas() rechaza (triangulación)', async () => {
    const repository = buildFakeRepository({ listarCuentas: vi.fn().mockRejectedValue(new Error('caído')) });
    const { result } = renderHook(() => useCuentas(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.cuentas).toEqual([]);
  });

  it('crearCuenta() llama a repository.crearCuenta() y recarga el listado', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useCuentas(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crearCuenta({ email: 'x@x.com', password: 'password-12', nombre: 'X', apellido: 'Y', permisos: [] });
    });

    expect(repository.crearCuenta).toHaveBeenCalledTimes(1);
    expect(repository.listarCuentas).toHaveBeenCalledTimes(2); // carga inicial + recarga tras crear
  });

  it('actualizarPermisos() llama a repository.actualizarPermisos() y recarga el listado', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useCuentas(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizarPermisos('u1', [{ modulo: 'pacientes', nivelAcceso: 'read' }]);
    });

    expect(repository.actualizarPermisos).toHaveBeenCalledWith('u1', [{ modulo: 'pacientes', nivelAcceso: 'read' }]);
    expect(repository.listarCuentas).toHaveBeenCalledTimes(2);
  });

  it('crearCuenta() propaga el error del repository sin recargar el listado ni dejar loading colgado', async () => {
    const repository = buildFakeRepository({ crearCuenta: vi.fn().mockRejectedValue(new Error('email duplicado')) });
    const { result } = renderHook(() => useCuentas(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.crearCuenta({ email: 'x@x.com', password: 'password-12', nombre: 'X', apellido: 'Y' }),
      ).rejects.toThrow('email duplicado');
    });

    expect(repository.listarCuentas).toHaveBeenCalledTimes(1); // no recargó tras el fallo
    expect(result.current.loading).toBe(false);
  });

  it('actualizarPermisos() propaga el error sin recargar el listado (para que la UI lo muestre en la matriz)', async () => {
    const repository = buildFakeRepository({ actualizarPermisos: vi.fn().mockRejectedValue(new Error('La cuenta ya no existe.')) });
    const { result } = renderHook(() => useCuentas(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(result.current.actualizarPermisos('u1', [])).rejects.toThrow('La cuenta ya no existe.');
    });

    expect(repository.listarCuentas).toHaveBeenCalledTimes(1);
  });
});
