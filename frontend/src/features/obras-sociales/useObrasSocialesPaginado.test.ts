import { act, waitFor } from '@testing-library/react';
import { renderHookConQuery } from '../../shared/test/queryWrapper';
import { describe, expect, it, vi } from 'vitest';
import type { NuevaObraSocial, ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { useObrasSocialesPaginado } from './useObrasSocialesPaginado';

// paginacion-listados, Fase 3 (tasks.md 17.3): hook exclusivo de la pantalla de listado, distinto
// de `useObrasSociales.ts` (sigue existiendo tal cual para PacientesPage/PresupuestosPage/
// FacturacionPage). Mismo wiring que `usePacientesPaginado.ts`/`useConductoresPaginado.ts`.

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

function buildFakeRepository(overrides: Partial<ObraSocialRepository> = {}): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([osecac]),
    listPage: vi.fn().mockResolvedValue({ items: [osecac], total: 1, pagina: 1, tamanio: 20 }),
    getById: vi.fn().mockResolvedValue(osecac),
    create: vi.fn().mockResolvedValue(osecac),
    update: vi.fn().mockResolvedValue(osecac),
    ...overrides,
  };
}

function buildNuevaObraSocial(): NuevaObraSocial {
  return {
    nombre: 'Swiss Medical',
    cuit: '30-11111111-1',
    modalidadFacturacion: 'general',
    admitePagosParciales: true,
    formatoAfiliado: 'numero-documento',
    checklist: [],
    plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
  };
}

describe('useObrasSocialesPaginado', () => {
  it('al montar invoca listPage con tamanio 20 y expone items/total', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHookConQuery(() => useObrasSocialesPaginado(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(repository.listPage).toHaveBeenCalledWith({ pagina: 1, tamanio: 20, filtros: { busqueda: '' } });
    expect(result.current.items).toEqual([osecac]);
    expect(result.current.total).toBe(1);
  });

  it('crear() llama a repository.create y recarga la página vigente', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useObrasSocialesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await act(async () => {
      await result.current.crear(buildNuevaObraSocial());
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(repository.listPage).toHaveBeenCalledTimes(1));
  });

  it('actualizar() llama a repository.update y recarga la página vigente', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useObrasSocialesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await act(async () => {
      await result.current.actualizar('osecac', { condicionIva: 'MONOTRIBUTO' });
    });

    expect(repository.update).toHaveBeenCalledWith('osecac', { condicionIva: 'MONOTRIBUTO' });
    await waitFor(() => expect(repository.listPage).toHaveBeenCalledTimes(1));
  });

  it('recargar() tras actualizar() NO resetea la página a 1', async () => {
    const repository = buildFakeRepository({
      listPage: vi.fn().mockResolvedValue({ items: [], total: 50, pagina: 1, tamanio: 20 }),
    });
    const { result } = renderHookConQuery(() => useObrasSocialesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.irAPagina(3);
    });
    await waitFor(() => expect(result.current.pagina).toBe(3));

    await act(async () => {
      await result.current.actualizar('osecac', { condicionIva: 'MONOTRIBUTO' });
    });

    expect(result.current.pagina).toBe(3);
  });

  it('crear() propaga el error sin recargar si repository.create rechaza', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('No se pudo guardar.')) });
    const { result } = renderHookConQuery(() => useObrasSocialesPaginado(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));
    vi.mocked(repository.listPage).mockClear();

    await expect(result.current.crear(buildNuevaObraSocial())).rejects.toThrow('No se pudo guardar.');
    expect(repository.listPage).not.toHaveBeenCalled();
  });
});
