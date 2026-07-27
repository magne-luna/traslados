import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { ObraSocialRepository } from '../../shared/lib/obrasSociales/ObraSocialRepository';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import type { DocumentoAdjunto } from '../../shared/types/documento';
import { PacienteDocumentos } from './PacienteDocumentos';

const osecac: ObraSocial = {
  id: 'osecac',
  nombre: 'OSECAC',
  cuit: '30-54155200-6',
  plazoCobroDias: 90,
  tipoComprobante: 'A',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
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
    const doc: DocumentoAdjunto = { itemId: 'item-1', nombreArchivo: 'rhc.pdf', subidoEn: '2026-07-01' };
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
});
