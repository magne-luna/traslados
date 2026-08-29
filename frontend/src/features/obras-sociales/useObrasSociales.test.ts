import { act, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import { crearQueryClientDeTest, renderHookConQuery } from '../../shared/test/queryWrapper';
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

    const { result } = renderHookConQuery(() => useObrasSociales(repository));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.obrasSociales).toEqual([osecac]);
    expect(result.current.error).toBeNull();
  });

  it('expone un error legible cuando list() rechaza la promesa (triangulación)', async () => {
    const repository = buildFakeRepository({ list: vi.fn().mockRejectedValue(new Error('caído')) });

    const { result } = renderHookConQuery(() => useObrasSociales(repository));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('caído');
    expect(result.current.obrasSociales).toEqual([]);
  });

  it('crear() llama a repository.create() y recarga la lista', async () => {
    const repository = buildFakeRepository();
    const { result } = renderHookConQuery(() => useObrasSociales(repository));
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
    const { result } = renderHookConQuery(() => useObrasSociales(repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.actualizar('osecac', { condicionIva: 'Monotributo' });
    });

    expect(repository.update).toHaveBeenCalledWith('osecac', { condicionIva: 'Monotributo' });
    expect(repository.list).toHaveBeenCalledTimes(2);
  });

  it('crear() propaga el error del repository sin dejar loading colgado', async () => {
    const repository = buildFakeRepository({ create: vi.fn().mockRejectedValue(new Error('nombre duplicado')) });
    const { result } = renderHookConQuery(() => useObrasSociales(repository));
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

  // ---------------------------------------------------------------------------------------------
  // migracion-react-query, tasks.md 2.2/2.7/2.8. Lo que estos tests protegen es el REQUISITO del
  // change, no un detalle de implementación: navegar y volver no debe volver a pedir el padrón.
  // ---------------------------------------------------------------------------------------------

  it('dos montajes sucesivos dentro del plazo llaman a list() UNA sola vez (tasks.md 2.2)', async () => {
    const repository = buildFakeRepository();
    // Un solo cliente = una sola sesión de la app. react-router desmonta la ruta al navegar; lo que
    // tiene que sobrevivir a ese desmontaje es la caché, no el estado del hook.
    // El `staleTime` de referencia lo declara el hook en su propia `useQuery`: las opciones por
    // query GANAN sobre los defaults del cliente, así que el `staleTime: 0` de test no lo pisa.
    const client = crearQueryClientDeTest();

    const primero = renderHookConQuery(() => useObrasSociales(repository), { client });
    await waitFor(() => expect(primero.result.current.loading).toBe(false));
    primero.unmount();

    const segundo = renderHookConQuery(() => useObrasSociales(repository), { client });
    await waitFor(() => expect(segundo.result.current.obrasSociales).toEqual([osecac]));

    expect(repository.list).toHaveBeenCalledTimes(1);
  });

  it('el segundo montaje no parpadea: expone el dato cacheado sin pasar por loading (tasks.md 2.8)', async () => {
    const repository = buildFakeRepository();
    const client = crearQueryClientDeTest();

    const primero = renderHookConQuery(() => useObrasSociales(repository), { client });
    await waitFor(() => expect(primero.result.current.loading).toBe(false));
    primero.unmount();

    const segundo = renderHookConQuery(() => useObrasSociales(repository), { client });

    // En el PRIMER render, no en un tick posterior: una pantalla que ya tenía contenido nunca
    // vuelve a un estado de carga vacío.
    expect(segundo.result.current.loading).toBe(false);
    expect(segundo.result.current.obrasSociales).toEqual([osecac]);
  });

  it('crear invalida el dominio: otro consumidor ve el alta sin esperar al plazo (tasks.md 2.7)', async () => {
    const nueva: ObraSocial = { ...osecac, id: 'swiss', nombre: 'Swiss Medical' };
    const list = vi.fn().mockResolvedValue([osecac]);
    const repository = buildFakeRepository({ list, create: vi.fn().mockResolvedValue(nueva) });
    const client = crearQueryClientDeTest();

    // Consumidor A: la pantalla de Obras Sociales.
    const pantalla = renderHookConQuery(() => useObrasSociales(repository), { client });
    await waitFor(() => expect(pantalla.result.current.loading).toBe(false));

    list.mockResolvedValue([osecac, nueva]);
    await act(async () => {
      await pantalla.result.current.crear({ ...osecac, nombre: 'Swiss Medical' } as never);
    });
    pantalla.unmount();

    // Consumidor B: el selector de otra pantalla. Ve el alta aunque el plazo no haya vencido.
    const selector = renderHookConQuery(() => useObrasSociales(repository), { client });
    await waitFor(() => expect(selector.result.current.obrasSociales).toEqual([osecac, nueva]));
  });

  it('actualizar también invalida el dominio', async () => {
    const editada: ObraSocial = { ...osecac, nombre: 'OSECAC (editada)' };
    const list = vi.fn().mockResolvedValue([osecac]);
    const repository = buildFakeRepository({ list, update: vi.fn().mockResolvedValue(editada) });
    const client = crearQueryClientDeTest();

    const pantalla = renderHookConQuery(() => useObrasSociales(repository), { client });
    await waitFor(() => expect(pantalla.result.current.loading).toBe(false));

    list.mockResolvedValue([editada]);
    await act(async () => {
      await pantalla.result.current.actualizar('osecac', { nombre: 'OSECAC (editada)' });
    });

    await waitFor(() => expect(pantalla.result.current.obrasSociales).toEqual([editada]));
  });
});
