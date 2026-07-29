import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CuentaRepository } from '../../shared/lib/cuentas/CuentaRepository';
import { CuentaRepositoryProvider, useCuentaRepository } from './CuentaRepositoryContext';

function buildFakeRepository(): CuentaRepository {
  return {
    listarCuentas: vi.fn().mockResolvedValue([]),
    crearCuenta: vi.fn(),
    actualizarPermisos: vi.fn(),
  };
}

function Consumer() {
  const repository = useCuentaRepository();
  return <div>{typeof repository.listarCuentas}</div>;
}

describe('CuentaRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    const repository = buildFakeRepository();

    render(
      <CuentaRepositoryProvider repository={repository}>
        <Consumer />
      </CuentaRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/CuentaRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
