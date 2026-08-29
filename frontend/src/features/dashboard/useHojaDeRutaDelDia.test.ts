import { waitFor } from '@testing-library/react';
import { renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { HojaDeRuta } from '../../shared/types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../../shared/lib/hojas-de-ruta/HojaDeRutaRepository';
import { useHojaDeRutaDelDia } from './useHojaDeRutaDelDia';

// tasks.md 5.3, spec dashboard-recorridos-del-dia: expone loading/error, y el caso `null` (sin
// hoja de ruta cargada para el día) como estado propio, no como error.

const hoja: HojaDeRuta = { id: 'h1', fecha: '2026-07-24', franjaInicio: '08:00', franjaFin: '20:00', recorridos: [] };

function buildRepository(overrides: Partial<HojaDeRutaRepository> = {}): HojaDeRutaRepository {
  return {
    list: vi.fn(),
    getById: vi.fn(),
    getByFecha: vi.fn().mockResolvedValue(hoja),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

describe('useHojaDeRutaDelDia', () => {
  it('expone la hoja de ruta del día una vez que getByFecha resuelve', async () => {
    const repository = buildRepository();
    const { result } = renderHookConQuery(() => useHojaDeRutaDelDia(repository, '2026-07-24'));

    expect(result.current.cargando).toBe(true);
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.hojaDeRuta).toEqual(hoja);
    expect(result.current.error).toBeNull();
    expect(repository.getByFecha).toHaveBeenCalledWith('2026-07-24');
  });

  it('expone hojaDeRuta: null como estado propio (no error) cuando no hay hoja cargada', async () => {
    const repository = buildRepository({ getByFecha: vi.fn().mockResolvedValue(null) });
    const { result } = renderHookConQuery(() => useHojaDeRutaDelDia(repository, '2026-07-24'));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.hojaDeRuta).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible y acotado cuando falla la lectura', async () => {
    const repository = buildRepository({ getByFecha: vi.fn().mockRejectedValue(new Error('caído')) });
    const { result } = renderHookConQuery(() => useHojaDeRutaDelDia(repository, '2026-07-24'));
    await waitFor(() => expect(result.current.cargando).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.hojaDeRuta).toBeNull();
  });
});
