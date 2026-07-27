import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import { ConductorRepositoryProvider, useConductorRepository } from './ConductorRepositoryContext';

function buildFakeRepository(): ConductorRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function Consumer() {
  const repository = useConductorRepository();
  return <div>{typeof repository.list}</div>;
}

describe('ConductorRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    const repository = buildFakeRepository();

    render(
      <ConductorRepositoryProvider repository={repository}>
        <Consumer />
      </ConductorRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/ConductorRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
