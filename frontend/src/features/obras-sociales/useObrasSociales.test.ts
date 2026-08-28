import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { useObrasSociales } from './useObrasSociales';

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

describe('useObrasSociales', () => {
  it('arranca en loading y expone la lista una vez que list() resuelve', async () => {
    const repository = buildFakeRepository();

    const { result } = renderHook(() => useObrasSociales(repository));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.obrasSociales).toEqual([osecac]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa (triangulación)', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHook(() => useObrasSociales(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.obrasSociales).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useObrasSociales(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.crear({
        nombre: 'Swiss Medical',
        cuit: '30-11111111-1',
        modalidadFacturacion: 'general',
        admitePagosParciales: true,
        formatoAfiliado: 'numero-documento',
        checklist: [],
        plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
      });
    });

    expect(repository.create).toHaveBeenCalledTimes(1);
    expect(repository.list).toHaveBeenCalledTimes(2); // carga inicial + recarga tras crear
  });

  it('actualizar() llama a repository.update() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHook(() => useObrasSociales(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('osecac', { condicionIva: 'MONOTRIBUTO' });
    });

    expect(repository.update).toHaveBeenCalledWith('osecac', { condicionIva: 'MONOTRIBUTO' });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('crear() propaga el error del repository sin dejar loading colgado', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('nombre duplicado')) });
    const { result } = renderHook(() => useObrasSociales(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        result.current.crear({
          nombre: 'OSECAC',
          cuit: '30-54155200-6',
          modalidadFacturacion: 'por-prestacion',
          admitePagosParciales: false,
          formatoAfiliado: 'numero-documento',
          checklist: [],
          plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
        }),
      ).rejects.toThrow('nombre duplicado');
    });

    expect(result.current.error).toBe('nombre duplicado');
    expect(result.current.loading).toBe(false);
  });
});
