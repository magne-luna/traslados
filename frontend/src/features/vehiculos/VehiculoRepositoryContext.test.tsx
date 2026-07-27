import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { VehiculoRepository } from '../../shared/lib/vehiculos/VehiculoRepository';
import { VehiculoRepositoryProvider, useVehiculoRepository } from './VehiculoRepositoryContext';

function buildFakeRepository(): VehiculoRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function Consumer() {
  const repository = useVehiculoRepository();
  return <div>{typeof repository.list}</div>;
}

describe('VehiculoRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    const repository = buildFakeRepository();

    render(
      <VehiculoRepositoryProvider repository={repository}>
        <Consumer />
      </VehiculoRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/VehiculoRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
