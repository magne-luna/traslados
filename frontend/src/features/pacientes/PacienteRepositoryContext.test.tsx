import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PacienteRepository } from '../../shared/lib/pacientes/PacienteRepository';
import { PacienteRepositoryProvider, usePacienteRepository } from './PacienteRepositoryContext';

function buildFakeRepository(): PacienteRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function Consumer() {
  const repository = usePacienteRepository();
  return <div>{typeof repository.list}</div>;
}

describe('PacienteRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    const repository = buildFakeRepository();

    render(
      <PacienteRepositoryProvider repository={repository}>
        <Consumer />
      </PacienteRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/PacienteRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
