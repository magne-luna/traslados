import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import { AutorizacionRepositoryProvider, useAutorizacionRepository } from './AutorizacionRepositoryContext';

function buildFakeRepository(): AutorizacionRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    getByPresupuestoId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    uploadArchivo: vi.fn(),
    removeArchivo: vi.fn(),
    getUrlArchivo: vi.fn(),
  };
}

function Consumer() {
  const repository = useAutorizacionRepository();
  return <div>{typeof repository.list}</div>;
}

describe('AutorizacionRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    const repository = buildFakeRepository();

    render(
      <AutorizacionRepositoryProvider repository={repository}>
        <Consumer />
      </AutorizacionRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/AutorizacionRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
