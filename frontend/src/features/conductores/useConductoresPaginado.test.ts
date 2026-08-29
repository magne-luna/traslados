import { act, waitFor } from '@testing-library/react';
import { renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { Conductor, NuevoConductor } from '../../shared/types/conductor';
import type { ConductorRepository } from '../../shared/lib/conductores/ConductorRepository';
import { useConductoresPaginado } from './useConductoresPaginado';

// paginacion-listados, Fase 3 (tasks.md 16.3): hook exclusivo de la pantalla de listado, distinto
// de `useConductores.ts` (sigue existiendo tal cual para HojaDeRutaPage y otros selectores). Mismo
// wiring que `usePacientesPaginado.ts` (Fase 2): `usePaginaListado` contra
// `ConductorRepository.listPage`, `crear`/`actualizar` recargan la página vigente.

const perez: Conductor = {
  id: 'conductor-perez',
  apellido: 'Pérez',
  nombre: 'Carlos',
  documento: '15789456',
  domicilio: 'Calle 50 N° 1234, La Plata',
  cuil: '20-15789456-9',
  estado: 'operando',
  asignaciones: [],
};

function buildFakeRepository(overrides: Partial<ConductorRepository> = {}): ConductorRepository {
  return {
    list: vi.fn().mockResolvedValue([perez]),
    listPage: vi.fn().mockResolvedValue({ items: [perez], total: 1, pagina: 1, tamanio: 20 }),
    getById: vi.fn().mockResolvedValue(perez),
    create: vi.fn().mockResolvedValue(perez),
    update: vi.fn().mockResolvedValue(perez),
    ...overrides,
  };
}

function buildNuevoConductor(): NuevoConductor {
  return {
    apellido: 'Fernández',
    nombre: 'Ana',
    documento: '99887766',
    domicilio: 'Belgrano 200, Quilmes',
    cuil: '27-99887766-1',
    estado: 'operando',
    asignaciones: [],
  };
}

describe('useConductoresPaginado', () => {
  it('al montar invoca listPage con tamanio 20 y expone items/total', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHookConQuery(() => useConductoresPaginado(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(repository.listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    expect(result.current.items).toEqual([perez]);
    expect(result.current.total).toBe(1);
  });

  it('crear() llama a repository.create y recarga la página vigente', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useConductoresPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await act(async () => {
      await result.current.crear(buildNuevoConductor());
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(repository.listPage).toHaveBeenCalledTimes(1));
  });

  it('actualizar() llama a repository.update y recarga la página vigente', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useConductoresPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await act(async () => {
      await result.current.actualizar('conductor-perez', { telefono: '11-0000-1111' });
    });

    expect(repository.update).toHaveBeenCalledWith('conductor-perez', { telefono: '11-0000-1111' });
    await waitFor(() => expect(repository.listPage).toHaveBeenCalledTimes(1));
  });

  it('recargar() tras actualizar() NO resetea la página a 1', async () => {
    const repository = buildFakeRepository({
      listPage: vi.fn().mockResolvedValue({ items: [], total: 50, pagina: 1, tamanio: 20 }),
    });
    const { result } = renderHookConQuery(() => useConductoresPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.irAPagina(3);
    });
    await waitFor(() => expect(result.current.pagina).toBe(3));

    await act(async () => {
      await result.current.actualizar('conductor-perez', { telefono: '11-0000-1111' });
    });

    expect(result.current.pagina).toBe(3);
  });

  it('crear() propaga el error sin recargar si repository.create rechaza', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('No se pudo guardar.')) });
    const { result } = renderHookConQuery(() => useConductoresPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await expect(result.current.crear(buildNuevoConductor())).rejects.toThrow('No se pudo guardar.');
    expect(repository.listPage).not.toHaveBeenCalled();
  });
});
