import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ChecklistItem, DocumentoAdjunto, EntidadDocumental } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { FacturaDocumentos } from './FacturaDocumentos';

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
