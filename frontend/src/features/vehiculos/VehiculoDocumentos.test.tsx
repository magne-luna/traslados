import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DocumentoAdjunto } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { VehiculoDocumentos } from './VehiculoDocumentos';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

function buildFakeRepository(overrides: Partial<DocumentoRepository> = {}): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
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

  it('muestra el aviso de que la subida de documentos del vehículo sigue simulada', async () => {
    render(<VehiculoDocumentos vehiculoId="v1" repository={buildFakeRepository()} />);

    expect(await screen.findByText(/modelo de datos/i)).toBeInTheDocument();
    expect(screen.getByText(/sigue.*simulada/i)).toBeInTheDocument();
  });

  it('distingue el documento subido del faltante consultando al repository por entidad "vehiculo"', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-cedula', itemId: 'vehiculo-doc-cedula', nombreArchivo: 'cedula.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    render(<VehiculoDocumentos vehiculoId="v1" repository={repository} />);

    expect(await screen.findByText(/cedula\.pdf/i)).toBeInTheDocument();
    expect(repository.listByEntity).toHaveBeenCalledWith('vehiculo', 'v1');
  });
});

// Gateo de escritura (gateo-conductores, design.md D5, tasks.md 4.3). Solo la carga y baja se
// gatea; consultar/descargar sigue disponible con `read`.
describe('VehiculoDocumentos — gateo de escritura', () => {
  it('sin permiso de escritura: "Subir" queda deshabilitado, pero el documento ya cargado sigue siendo consultable', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-cedula', itemId: 'vehiculo-doc-cedula', nombreArchivo: 'cedula.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    renderConPermiso(false, <VehiculoDocumentos vehiculoId="v1" repository={repository} />);

    expect(await screen.findByText(/cedula\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByText('VTV')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^subir$/i })[0]).toBeDisabled();
  });

  it('con permiso de escritura: "Subir" y "Reemplazar" están activables (triangulación)', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-cedula', itemId: 'vehiculo-doc-cedula', nombreArchivo: 'cedula.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    renderConPermiso(true, <VehiculoDocumentos vehiculoId="v1" repository={repository} />);

    expect(await screen.findByText(/cedula\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^subir$/i })[0]).toBeEnabled();
  });
});
