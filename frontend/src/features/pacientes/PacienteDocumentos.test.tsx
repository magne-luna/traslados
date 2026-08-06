import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { DocumentoAdjunto } from '../../shared/types/documento';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { PacienteDocumentos } from './PacienteDocumentos';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: 'numero-documento',
  checklist: [
    { id: 'item-1', nombre: 'RHC', requerido: true },
    { id: 'item-2', nombre: 'Consentimiento informado', requerido: true },
  ],
  plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
};

function buildObraSocialRepository(overrides: Partial<ObraSocialRepository> = {}): ObraSocialRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    getById: vi.fn().mockResolvedValue(osecac),
    create: vi.fn(),
    update: vi.fn(),
    ...overrides,
  };
}

function buildDocumentoRepository(overrides: Partial<DocumentoRepository> = {}): DocumentoRepository {
  return {
    listByEntity: vi.fn().mockResolvedValue([]),
    upload: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

describe('PacienteDocumentos', () => {
  it('sin obra social asignada, muestra un estado vacío explícito (no un checklist genérico)', () => {
    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId={null}
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
      />,
    );

    expect(screen.getByText(/no tiene una obra social asignada/i)).toBeInTheDocument();
  });

  it('mientras resuelve la obra social, muestra un estado de carga', () => {
    const obraSocialRepository = buildObraSocialRepository({
      getById: vi.fn(() => new Promise<ObraSocial | null>(() => {})),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={obraSocialRepository}
        documentoRepository={buildDocumentoRepository()}
      />,
    );

    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('obra social sin checklist configurado muestra un estado vacío explícito (triangulación)', async () => {
    const sinChecklist: ObraSocial = { ...osecac, checklist: [] };
    const obraSocialRepository = buildObraSocialRepository({ getById: vi.fn().mockResolvedValue(sinChecklist) });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={obraSocialRepository}
        documentoRepository={buildDocumentoRepository()}
      />,
    );

    expect(await screen.findByText(/no tiene.*checklist|sin checklist/i)).toBeInTheDocument();
  });

  it('con checklist configurado, muestra los ítems de la obra social del paciente en su orden', async () => {
    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
      />,
    );

    expect(await screen.findByText('RHC')).toBeInTheDocument();
    expect(screen.getByText('Consentimiento informado')).toBeInTheDocument();
  });

  it('consulta los documentos del paciente por entidad "paciente" y su id', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-1', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01' };
    const documentoRepository = buildDocumentoRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
      />,
    );

    expect(await screen.findByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(documentoRepository.listByEntity).toHaveBeenCalledWith('paciente', 'paciente-1');
  });

  // pacientes-documentos-multiples (tasks.md 5.1): escenario central del change — feedback real
  // de la clienta (Andrea Pastor). Dos documentos del mismo tipo (ej. presupuesto agosto-julio
  // actual + su renovación) conviven visibles, ninguno se sobrescribe.
  it('dos documentos del mismo tipo conviven visibles sin sobrescribirse (escenario central de pacientes-documentos-multiples)', async () => {
    const actual: DocumentoAdjunto = {
      id: 'doc-actual',
      itemId: 'item-1',
      nombreArchivo: 'rhc-2025.pdf',
      subidoEn: '2025-08-01',
      vigenciaDesde: '2025-08-01',
    };
    const renovacion: DocumentoAdjunto = {
      id: 'doc-renovacion',
      itemId: 'item-1',
      nombreArchivo: 'rhc-2026.pdf',
      subidoEn: '2026-07-30',
      vigenciaDesde: '2099-08-01',
    };
    const documentoRepository = buildDocumentoRepository({
      listByEntity: vi.fn().mockResolvedValue([actual, renovacion]),
    });

    render(
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
      />,
    );

    expect(await screen.findByText(/rhc-2025\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/rhc-2026\.pdf/i)).toBeInTheDocument();
  });
});

// Gateo de escritura (gateo-pacientes, design.md D3, tasks.md 5.1/5.2). Solo la carga y baja de
// documentos (DocumentChecklist.readOnly, ya existente y reutilizado tal cual — el mecanismo
// compartido de gateo-obrasocial NO se toca) se gatea; consultar/descargar sigue disponible con
// `read` porque la RLS del servidor ya autoriza esa lectura — el gateo del cliente nunca debe ser
// más restrictivo que eso (design.md riesgos).
describe('PacienteDocumentos — gateo de escritura', () => {
  it('sin permiso de escritura: "Subir" y "Quitar" quedan deshabilitados, pero el documento ya cargado sigue siendo consultable', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-1', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01' };
    const documentoRepository = buildDocumentoRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    renderConPermiso(
      false,
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
      />,
    );

    // Consultar sigue disponible con solo `read` (D3): el archivo cargado sigue visible.
    expect(await screen.findByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar rhc/i })).toBeDisabled();
    // El ítem sin cargar todavía ("Consentimiento informado") también sigue legible.
    expect(screen.getByText('Consentimiento informado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subir/i })).toBeDisabled();
  });

  it('con permiso de escritura: "Subir", "Reemplazar" y "Quitar" están activables (triangulación), y el checklist se renderiza completo', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-1', itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01' };
    const documentoRepository = buildDocumentoRepository({ listByEntity: vi.fn().mockResolvedValue([doc]) });

    renderConPermiso(
      true,
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={documentoRepository}
      />,
    );

    expect(await screen.findByText(/rhc\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /quitar rhc/i })).toBeEnabled();
    expect(screen.getByText('Consentimiento informado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /subir/i })).toBeEnabled();
  });
});

// Rol admin sin filas de permisos (design.md D5): el contexto ya resolvió el short-circuit de
// admin (probado de punta a punta en usePuedeEscribir.test.tsx, gateo-obrasocial tasks.md 2.2) —
// acá solo se confirma que PacienteDocumentos consume ese resultado.
describe('PacienteDocumentos — rol admin sin filas de permisos', () => {
  it('con puedeEscribir true (equivalente al short-circuit de admin sin filas): carga y baja de documentos operativas', async () => {
    renderConPermiso(
      true,
      <PacienteDocumentos
        pacienteId="paciente-1"
        obraSocialId="osecac"
        obraSocialRepository={buildObraSocialRepository()}
        documentoRepository={buildDocumentoRepository()}
      />,
    );

    expect(await screen.findByText('RHC')).toBeInTheDocument();
    for (const boton of screen.getAllByRole('button', { name: /^subir$/i })) {
      expect(boton).toBeEnabled();
    }
  });
});
