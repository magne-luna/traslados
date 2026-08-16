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
    transferirAgrupacion: vi.fn(),
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

  // documentos-vehiculos-conductores-facturacion (2026-08-16): el swap a
  // supabaseDocumentoRepository retira el aviso de subida simulada — ya no aplica.
  it('no muestra ningún aviso de subida simulada', async () => {
    render(<VehiculoDocumentos vehiculoId="v1" repository={buildFakeRepository()} />);

    await screen.findByText('Cédula');
    expect(screen.queryByText(/modelo de datos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sigue.*simulada/i)).not.toBeInTheDocument();
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

// documentos-checklist-por-actividad (tasks.md 7.2, specs/paciente-documentos/spec.md
// "Un dominio sin actividades sigue con un único checklist"): no regresión explícita. Vehículos
// nunca pasa `agrupacionId` a useDocumentChecklist (design.md D1) — aunque el tipo
// `DocumentoAdjunto.agrupacionId` ahora existe (tasks.md 2.1) y el repository pudiera devolver
// documentos con ese campo poblado (dato legacy o de otra integración), este dominio los sigue
// mostrando todos juntos en un único checklist, sin bloques por actividad ni pasos adicionales.
describe('VehiculoDocumentos — no regresión por agrupación (tasks.md 7.2)', () => {
  it('muestra un único checklist sin bloques por actividad, incluso si el repository devuelve documentos con agrupacionId', async () => {
    const docSinAgrupar: DocumentoAdjunto = { id: 'doc-cedula', itemId: 'vehiculo-doc-cedula', nombreArchivo: 'cedula.pdf', subidoEn: '2026-07-01' };
    const docConAgrupacionLegacy: DocumentoAdjunto = {
      id: 'doc-vtv',
      itemId: 'vehiculo-doc-vtv',
      nombreArchivo: 'vtv.pdf',
      subidoEn: '2026-07-02',
      agrupacionId: 'direccion-x',
    };
    const repository = buildFakeRepository({
      listByEntity: vi.fn().mockResolvedValue([docSinAgrupar, docConAgrupacionLegacy]),
    });

    render(<VehiculoDocumentos vehiculoId="v1" repository={repository} />);

    expect(await screen.findByText(/cedula\.pdf/i)).toBeInTheDocument();
    expect(await screen.findByText(/vtv\.pdf/i)).toBeInTheDocument();
    // "sin bloques por actividad": role="group" es el marcador que usa Pacientes
    // (PacienteDocumentosChecklist.tsx) para cada bloque de actividad — acá no debe aparecer ninguno.
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    // "sin pasos adicionales": la misma llamada de siempre, con exactamente 2 argumentos — nunca un
    // 3.er `agrupacionId` explícito, porque este dominio nunca se lo pasa a useDocumentChecklist.
    expect(repository.listByEntity).toHaveBeenCalledWith('vehiculo', 'v1');
  });
});
