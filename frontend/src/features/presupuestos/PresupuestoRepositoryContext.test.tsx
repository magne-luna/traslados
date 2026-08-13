import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import { PresupuestoRepositoryProvider, usePresupuestoRepository } from './PresupuestoRepositoryContext';

function buildFakeRepository(): PresupuestoRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    createLote: vi.fn(),
    update: vi.fn(),
  };
}

function Consumer() {
  const repository = usePresupuestoRepository();
  return <div>{typeof repository.list}</div>;
}

describe('PresupuestoRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    const repository = buildFakeRepository();

    render(
      <PresupuestoRepositoryProvider repository={repository}>
        <Consumer />
      </PresupuestoRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/PresupuestoRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
