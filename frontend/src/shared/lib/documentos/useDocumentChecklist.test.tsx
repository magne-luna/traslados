import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChecklistItem, DocumentoAdjunto, EntidadDocumental } from '../../types/documento';
import type { DocumentoRepository } from './DocumentoRepository';
import { useDocumentChecklist } from './useDocumentChecklist';

const items: ChecklistItem[] = [{ id: 'item-presupuesto', nombre: 'Presupuesto', requerido: true }];

function archivo(nombre: string): File {
  return new File(['contenido'], nombre, { type: 'application/pdf' });
}

function buildFakeRepository(overrides: Partial<DocumentoRepository> = {}): DocumentoRepository {
  return {
    listByEntity: vi.fn((_entidad: EntidadDocumental, _entidadId: string) => Promise.resolve<DocumentoAdjunto[]>([])),
    upload: vi.fn(),
    remove: vi.fn().mockResolvedValue(undefined),
    // documentos-previsualizacion (tasks.md 1.2): cuarto método del contrato, agregado acá para que
    // el fake siga siendo asignable a `DocumentoRepository` — sin default, este archivo vuelve a
    // aparecer en la lista de 15 archivos rojos de `npx tsc -b --noEmit` que dejó anotada 1.3.
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

// pacientes-documentos-multiples, tasks.md 3.1/3.2: el hook deja de reemplazar por itemId al
// subir y pasa a filtrar por id de documento al quitar.

describe('useDocumentChecklist — upload() acumula en vez de reemplazar (tasks.md 3.1)', () => {
  it('sin documentos previos, subir uno deja exactamente ese documento en el estado', async () => {
    const nuevo: DocumentoAdjunto = {
      id: 'doc-2',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-2026.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };
    const repository = buildFakeRepository({ upload: vi.fn().mockResolvedValue(nuevo) });

    const { result } = renderHook(() => useDocumentChecklist('paciente', 'p1', items, repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.upload('item-presupuesto', archivo('presupuesto-2026.pdf'));
    });

    expect(result.current.documentos).toEqual([nuevo]);
  });

  it('con un documento ya cargado, subir otro del mismo itemId conserva ambos en el estado (escenario central)', async () => {
    const existente: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-2025.pdf',
      subidoEn: '2025-08-01T00:00:00.000Z',
    };
    const nuevo: DocumentoAdjunto = {
      id: 'doc-2',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-2026.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };
    const repository = buildFakeRepository({
      listByEntity: vi.fn().mockResolvedValue([existente]),
      upload: vi.fn().mockResolvedValue(nuevo),
    });

    const { result } = renderHook(() => useDocumentChecklist('paciente', 'p1', items, repository));
    await waitFor(() => expect(result.current.documentos).toEqual([existente]));

    await act(async () => {
      await result.current.upload('item-presupuesto', archivo('presupuesto-2026.pdf'));
    });

    expect(result.current.documentos).toEqual(
      expect.arrayContaining([existente, nuevo]),
    );
    expect(result.current.documentos).toHaveLength(2);
  });
});

describe('useDocumentChecklist — remove() filtra por id de documento (tasks.md 3.2)', () => {
  it('quitar un documento puntual por su id no afecta a los demás documentos del mismo itemId', async () => {
    const uno: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-viejo.pdf',
      subidoEn: '2025-08-01T00:00:00.000Z',
    };
    const dos: DocumentoAdjunto = {
      id: 'doc-2',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-nuevo.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };
    const repository = buildFakeRepository({ listByEntity: vi.fn().mockResolvedValue([uno, dos]) });

    const { result } = renderHook(() => useDocumentChecklist('paciente', 'p1', items, repository));
    await waitFor(() => expect(result.current.documentos).toHaveLength(2));

    await act(async () => {
      await result.current.remove('doc-1');
    });

    expect(repository.remove).toHaveBeenCalledWith('paciente', 'p1', 'doc-1');
    expect(result.current.documentos).toEqual([dos]);
  });
});

// documentos-previsualizacion (tasks.md 4.1/4.2): el hook expone una función que delega en
// repository.resolverPrevisualizacion(entidad, entidadId, documentoId) — no guarda la URL en el
// estado del hook (D2 de design.md), así que no hay nada que leer de `result.current` más allá de
// la propia función: se testea el valor resuelto/rechazado de la promesa que devuelve.
describe('useDocumentChecklist — resolverPrevisualizacion() delega en el repository (tasks.md 4.1)', () => {
  it('delega en repository.resolverPrevisualizacion con entidad, entidadId y el documentoId pedido', async () => {
    const repository = buildFakeRepository({
      resolverPrevisualizacion: vi.fn().mockResolvedValue('blob:mock-url'),
    });

    const { result } = renderHook(() => useDocumentChecklist('paciente', 'p1', items, repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.resolverPrevisualizacion('doc-1');
    });

    expect(repository.resolverPrevisualizacion).toHaveBeenCalledWith('paciente', 'p1', 'doc-1');
  });
});

describe('useDocumentChecklist — resolverPrevisualizacion() maneja los tres desenlaces del contrato (tasks.md 4.2)', () => {
  it('resuelto: devuelve la URL tal cual la resolvió el repository', async () => {
    const repository = buildFakeRepository({
      resolverPrevisualizacion: vi.fn().mockResolvedValue('blob:doc-1-url'),
    });
    const { result } = renderHook(() => useDocumentChecklist('paciente', 'p1', items, repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let url: string | null = null;
    await act(async () => {
      url = await result.current.resolverPrevisualizacion('doc-1');
    });

    expect(url).toBe('blob:doc-1-url');
  });

  it('null: no es un error — la promesa resuelve null sin lanzar', async () => {
    const repository = buildFakeRepository({
      resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
    });
    const { result } = renderHook(() => useDocumentChecklist('paciente', 'p1', items, repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let url: string | null = 'sin-tocar';
    await act(async () => {
      url = await result.current.resolverPrevisualizacion('doc-sin-contenido');
    });

    expect(url).toBeNull();
  });

  it('error: la promesa rechaza con el error real, no lo traga ni lo convierte en null', async () => {
    const fallo = new Error('403: sin permiso para este documento');
    const repository = buildFakeRepository({
      resolverPrevisualizacion: vi.fn().mockRejectedValue(fallo),
    });
    const { result } = renderHook(() => useDocumentChecklist('paciente', 'p1', items, repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await expect(result.current.resolverPrevisualizacion('doc-1')).rejects.toThrow(
      '403: sin permiso para este documento',
    );

    // El error de resolverPrevisualizacion() es independiente de la carga inicial del checklist:
    // no debe dejar el estado general del hook en "cargando" (mismo criterio que usePacientes.ts
    // aplica con su try/catch/finally para la carga inicial).
    expect(result.current.loading).toBe(false);
  });
});

// documentos-previsualizacion (tasks.md 4.3): revocar el ObjectURL que el hook resolvió para
// mostrarlo en la ventana. Distinto del revoke que ya hace el mock en remove() (tasks.md 2.3) sobre
// el store interno del repository — este es el de la URL que quedó en manos del consumidor mientras
// la ventana estuvo abierta.
describe('useDocumentChecklist — revocarPrevisualizacion() libera el ObjectURL (tasks.md 4.3)', () => {
  it('llama a URL.revokeObjectURL exactamente una vez con la URL resuelta', async () => {
    const repository = buildFakeRepository({
      resolverPrevisualizacion: vi.fn().mockResolvedValue('blob:doc-1-url'),
    });
    const { result } = renderHook(() => useDocumentChecklist('paciente', 'p1', items, repository));
    await waitFor(() => expect(result.current.loading).toBe(false));

    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    let url: string | null = null;
    await act(async () => {
      url = await result.current.resolverPrevisualizacion('doc-1');
    });
    act(() => {
      result.current.revocarPrevisualizacion(url as string);
    });

    expect(revokeSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledWith('blob:doc-1-url');
    revokeSpy.mockRestore();
  });
});
