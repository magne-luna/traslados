import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CobroRepository } from '../../shared/lib/facturacion/CobroRepository';
import { CobroRepositoryProvider, useCobroRepository } from './CobroRepositoryContext';

function buildFakeRepository(): CobroRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    listByFactura: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    remove: vi.fn(),
  };
}

function Consumer() {
  const repository = useCobroRepository();
  return <div>{typeof repository.listByFactura}</div>;
}

describe('CobroRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    render(
      <CobroRepositoryProvider repository={buildFakeRepository()}>
        <Consumer />
      </CobroRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/CobroRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
