import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { DocumentoAdjunto } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { ConductorDocumentos } from './ConductorDocumentos';

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

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
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
    const doc: DocumentoAdjunto = { id: 'doc-licencia', itemId: 'conductor-doc-licencia', nombreArchivo: 'licencia.pdf', subidoEn: '2026-07-01' };
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

  // documentos-vehiculos-conductores-facturacion (2026-08-16): el swap a
  // supabaseDocumentoRepository retira el aviso de subida simulada — el cartel de precarga
  // (pendiente #4 de C-09, sin relación) sigue, sin resolver.
  it('no muestra el aviso de subida simulada, pero conserva el cartel de precarga', async () => {
    render(<ConductorDocumentos conductorId="c1" repository={buildFakeRepository()} />);

    await screen.findByText(/pendiente de confirmar con el cliente: documentos a precargar/i);
    expect(screen.queryByText(/modelo de datos/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sigue.*simulada/i)).not.toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-conductores, design.md D5, tasks.md 2.6). Solo la carga y baja se
// gatea (vía la prop `readOnly` que DocumentChecklist ya expone); consultar/descargar sigue
// disponible con `read` porque la RLS del servidor ya autoriza esa lectura.
describe('ConductorDocumentos — gateo de escritura', () => {
  it('sin permiso de escritura: "Subir" queda deshabilitado, pero el documento ya cargado sigue siendo consultable', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-licencia', itemId: 'conductor-doc-licencia', nombreArchivo: 'licencia.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    renderConPermiso(false, <ConductorDocumentos conductorId="c1" repository={repository} />);

    expect(await screen.findByText(/licencia\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByText('DNI')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^subir$/i })[0]).toBeDisabled();
  });

  it('con permiso de escritura: "Subir" y "Reemplazar" están activables (triangulación)', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-licencia', itemId: 'conductor-doc-licencia', nombreArchivo: 'licencia.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    renderConPermiso(true, <ConductorDocumentos conductorId="c1" repository={repository} />);

    expect(await screen.findByText(/licencia\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^subir$/i })[0]).toBeEnabled();
  });
});

// documentos-checklist-por-actividad (tasks.md 7.2, specs/paciente-documentos/spec.md
// "Un dominio sin actividades sigue con un único checklist"): no regresión explícita. Conductores
// nunca pasa `agrupacionId` a useDocumentChecklist (design.md D1) — aunque el tipo
// `DocumentoAdjunto.agrupacionId` ahora existe (tasks.md 2.1) y el repository pudiera devolver
// documentos con ese campo poblado (dato legacy o de otra integración), este dominio los sigue
// mostrando todos juntos en un único checklist, sin bloques por actividad ni pasos adicionales.
describe('ConductorDocumentos — no regresión por agrupación (tasks.md 7.2)', () => {
  it('muestra un único checklist sin bloques por actividad, incluso si el repository devuelve documentos con agrupacionId', async () => {
    const docSinAgrupar: DocumentoAdjunto = { id: 'doc-licencia', itemId: 'conductor-doc-licencia', nombreArchivo: 'licencia.pdf', subidoEn: '2026-07-01' };
    const docConAgrupacionLegacy: DocumentoAdjunto = {
      id: 'doc-dni',
      itemId: 'conductor-doc-dni',
      nombreArchivo: 'dni.pdf',
      subidoEn: '2026-07-02',
      agrupacionId: 'direccion-x',
    };
    const repository = buildFakeRepository({
      listByEntity: vi.fn().mockResolvedValue([docSinAgrupar, docConAgrupacionLegacy]),
    });

    render(<ConductorDocumentos conductorId="c1" repository={repository} />);

    expect(await screen.findByText(/licencia\.pdf/i)).toBeInTheDocument();
    expect(await screen.findByText(/dni\.pdf/i)).toBeInTheDocument();
    // "sin bloques por actividad": role="group" es el marcador que usa Pacientes
    // (PacienteDocumentosChecklist.tsx) para cada bloque de actividad — acá no debe aparecer ninguno.
    expect(screen.queryAllByRole('group')).toHaveLength(0);
    // "sin pasos adicionales": la misma llamada de siempre, con exactamente 2 argumentos — nunca un
    // 3.er `agrupacionId` explícito, porque este dominio nunca se lo pasa a useDocumentChecklist.
    expect(repository.listByEntity).toHaveBeenCalledWith('conductor', 'c1');
  });
});
