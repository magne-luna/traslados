import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { ObraSocialRepositoryProvider, useObraSocialRepository } from './ObraSocialRepositoryContext';

function buildFakeRepository(): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    listPage: vi.fn().mockResolvedValue({ items: [], total: 0, pagina: 1, tamanio: 20 }),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function Consumer() {
  const repository = useObraSocialRepository();
  return <div>{typeof repository.list}</div>;
}

describe('ObraSocialRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    const repository = buildFakeRepository();

    render(
      <ObraSocialRepositoryProvider repository={repository}>
        <Consumer />
      </ObraSocialRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    // Silencia el console.error esperado que React emite al capturar la excepción de render.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/ObraSocialRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
