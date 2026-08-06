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
