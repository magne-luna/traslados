import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import { HojaDeRutaRepositoryProvider, useHojaDeRutaRepository } from './HojaDeRutaRepositoryContext';

function buildFakeRepository(): HojaDeRutaRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(null),
    getByFecha: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
  };
}

function Consumer() {
  const repository = useHojaDeRutaRepository();
  return <div>{typeof repository.list}</div>;
}

describe('HojaDeRutaRepositoryContext', () => {
  it('expone el repository inyectado a los descendientes dentro del Provider', () => {
    const repository = buildFakeRepository();

    render(
      <HojaDeRutaRepositoryProvider repository={repository}>
        <Consumer />
      </HojaDeRutaRepositoryProvider>,
    );

    expect(screen.getByText('function')).toBeInTheDocument();
  });

  it('lanza un error explícito si se usa fuera del Provider (borde)', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Consumer />)).toThrow(/HojaDeRutaRepositoryProvider/);

    consoleSpy.mockRestore();
  });
});
