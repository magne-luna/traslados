import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { FacturaRepository } from '../../shared/lib/facturacion/FacturaRepository';
import { FacturaRepositoryProvider, useFacturaRepository } from './FacturaRepositoryContext';

function buildFakeRepository(): FacturaRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    listByPaciente: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function Consumer() {
  const repository = useFacturaRepository();
  return <div>{typeof repository.list}</div>;
}

describe('FacturaRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    render(
      <FacturaRepositoryProvider repository={buildFakeRepository()}>
        <Consumer />
      </FacturaRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/FacturaRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
