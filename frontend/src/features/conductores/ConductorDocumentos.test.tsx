import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DocumentoAdjunto } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { ConductorDocumentos } from './ConductorDocumentos';

function buildFakeRepository(overrides: Partial<DocumentoRepository> = {}): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

// Documentos del conductor (tasks.md 7.2, 9.4): reutiliza DocumentChecklist + useDocumentChecklist
// de FE-1 con entidad = 'conductor', sin modelo documental paralelo (design.md Decisión 8).

describe('ConductorDocumentos', () => {
  it('renderiza el checklist fijo de documentos del conductor (licencia, DNI, apto médico)', async () => {
    render(<ConductorDocumentos conductorId="c1" repository={buildFakeRepository()} />);

    expect(await screen.findByText('Licencia de conducir')).toBeInTheDocument();
    expect(screen.getByText('DNI')).toBeInTheDocument();
    expect(screen.getByText('Apto médico')).toBeInTheDocument();
  });

  it('distingue el documento subido del faltante consultando al repository por entidad "conductor" (triangulación)', async () => {
    const doc: DocumentoAdjunto = { itemId: 'conductor-doc-licencia', nombreArchivo: 'licencia.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    render(<ConductorDocumentos conductorId="c1" repository={repository} />);

    expect(await screen.findByText(/licencia\.pdf/i)).toBeInTheDocument();
    expect(repository.listByEntity).toHaveBeenCalledWith('conductor', 'c1');
  });

  it('muestra el cartel de pendiente de confirmar sobre los documentos a precargar (tasks.md 9.4)', async () => {
    render(<ConductorDocumentos conductorId="c1" repository={buildFakeRepository()} />);

    expect(
      await screen.findByText(/pendiente de confirmar con el cliente: documentos a precargar/i),
    ).toBeInTheDocument();
  });
});
