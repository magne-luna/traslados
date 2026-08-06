import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ChecklistItem, DocumentoAdjunto, EntidadDocumental } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { PuedeEscribirContext } from '../../shared/auth/PuedeEscribirContext';
import { FacturaDocumentos } from './FacturaDocumentos';

function renderConPermiso(puedeEscribir: boolean, ui: React.ReactElement) {
  return render(<PuedeEscribirContext.Provider value={puedeEscribir}>{ui}</PuedeEscribirContext.Provider>);
}

const items: ChecklistItem[] = [
  { id: 'item-arca', nombre: 'Comprobante ARCA', requerido: true },
  { id: 'item-asistencia', nombre: 'Asistencia', requerido: true },
  { id: 'item-codem', nombre: 'CODEM', requerido: false },
];

function buildFakeRepository(documentos: DocumentoAdjunto[] = []): DocumentoRepository {
  return {
    listByEntity: vi.fn((_entidad: EntidadDocumental, _entidadId: string) => Promise.resolve(documentos)),
    upload: vi.fn(),
    remove: vi.fn(),
    resolverPrevisualizacion: vi.fn().mockResolvedValue(null),
  };
}

describe('FacturaDocumentos', () => {
  it('lista los ítems del checklist en el orden recibido, con entidad="factura"', async () => {
    const repository = buildFakeRepository();
    render(<FacturaDocumentos facturaId="factura-1" items={items} repository={repository} />);

    await waitFor(() => expect(repository.listByEntity).toHaveBeenCalledWith('factura', 'factura-1'));

    const nombres = items.map((item) => item.nombre);
    const textos = screen.getAllByText(new RegExp(nombres.join('|'))).map((el) => el.textContent);
    expect(textos).toEqual(nombres);
  });

  it('muestra el aviso de discrepancia de documentos por factura contra el modelo de datos real', () => {
    render(<FacturaDocumentos facturaId="factura-1" items={items} repository={buildFakeRepository()} />);
    expect(screen.getByText(/modelo de datos/i)).toBeInTheDocument();
    expect(screen.getByText(/documento_factura/i)).toBeInTheDocument();
  });

  it('no bloquea nada visualmente aunque falten documentos requeridos (solo informa el estado)', async () => {
    render(<FacturaDocumentos facturaId="factura-1" items={items} repository={buildFakeRepository()} />);
    await waitFor(() => expect(screen.getAllByText(/falta/i).length).toBeGreaterThan(0));
  });
});

// Gateo de escritura (gateo-facturacion, design.md D4, tasks.md 6.3). Solo la carga y baja de
// documentos se gatea (DocumentChecklist.readOnly, ya existente y reutilizado tal cual — el
// mecanismo compartido de gateo-obrasocial NO se toca); consultar/descargar sigue disponible con
// `read` porque la RLS del servidor ya autoriza esa lectura.
describe('FacturaDocumentos — gateo de escritura', () => {
  it('sin permiso de escritura: "Subir" y "Quitar" quedan deshabilitados, pero el documento ya cargado sigue siendo consultable', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-arca', itemId: 'item-arca', nombreArchivo: 'arca.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository([doc]);

    renderConPermiso(false, <FacturaDocumentos facturaId="factura-1" items={items} repository={repository} />);

    // Consultar sigue disponible con solo `read` (D4): el archivo cargado sigue visible.
    expect(await screen.findByText(/arca\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar comprobante arca/i })).toBeDisabled();
    // Los ítems sin cargar todavía también siguen legibles.
    expect(screen.getByText('Asistencia')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^subir$/i })[0]).toBeDisabled();
  });

  it('con permiso de escritura: "Subir", "Reemplazar" y "Quitar" están activables (triangulación), y el checklist se renderiza completo', async () => {
    const doc: DocumentoAdjunto = { id: 'doc-arca', itemId: 'item-arca', nombreArchivo: 'arca.pdf', subidoEn: '2026-07-01' };
    const repository = buildFakeRepository([doc]);

    renderConPermiso(true, <FacturaDocumentos facturaId="factura-1" items={items} repository={repository} />);

    expect(await screen.findByText(/arca\.pdf/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /quitar comprobante arca/i })).toBeEnabled();
    expect(screen.getAllByRole('button', { name: /^subir$/i })[0]).toBeEnabled();
  });
});
