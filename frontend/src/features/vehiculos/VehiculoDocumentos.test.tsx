import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DocumentoAdjunto } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { VehiculoDocumentos } from './VehiculoDocumentos';

function buildFakeRepository(overrides: Partial<DocumentoRepository> = {}): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

describe('VehiculoDocumentos', () => {
  it('renderiza el checklist fijo de documentos del vehículo (cédula, VTV, RTO, seguro, fotos)', async () => {
    render(<VehiculoDocumentos vehiculoId="v1" repository={buildFakeRepository()} />);

    expect(await screen.findByText('Cédula')).toBeInTheDocument();
    expect(screen.getByText('VTV')).toBeInTheDocument();
    expect(screen.getByText('RTO')).toBeInTheDocument();
    expect(screen.getByText('Seguro')).toBeInTheDocument();
    expect(screen.getByText('Fotos')).toBeInTheDocument();
  });

  it('distingue el documento subido del faltante consultando al repository por entidad "vehiculo"', async () => {
    const doc: DocumentoAdjunto = { itemId: 'vehiculo-doc-cedula', nombreArchivo: 'cedula.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    render(<VehiculoDocumentos vehiculoId="v1" repository={repository} />);

    expect(await screen.findByText(/cedula\.pdf/i)).toBeInTheDocument();
    expect(repository.listByEntity).toHaveBeenCalledWith('vehiculo', 'v1');
  });
});
