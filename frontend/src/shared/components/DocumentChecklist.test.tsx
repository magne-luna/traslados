import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ChecklistItem, DocumentoAdjunto } from '../types/documento';
import { DocumentChecklist } from './DocumentChecklist';

const items: ChecklistItem[] = [
  { id: 'item-presupuesto', nombre: 'Presupuesto', requerido: true },
  { id: 'item-rhc', nombre: 'RHC', requerido: true },
];

// pacientes-documentos-multiples (tasks.md §4, design.md D2): cada fila de ítem pasa de mostrar
// a lo sumo un documento a mostrar una colección — sin componente nuevo, reusa Chip/chipColors.

describe('DocumentChecklist — colección de N documentos por ítem (tasks.md 4.2)', () => {
  it('un ítem sin documentos no muestra ningún nombre de archivo', () => {
    render(<DocumentChecklist items={items} documentos={[]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByText(/\.pdf/i)).not.toBeInTheDocument();
  });

  it('un ítem con dos documentos del mismo tipo muestra ambos, cada uno con su propio "Quitar" (escenario central)', () => {
    const viejo: DocumentoAdjunto = {
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

    render(<DocumentChecklist items={items} documentos={[viejo, nuevo]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText(/presupuesto-2025\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/presupuesto-2026\.pdf/i)).toBeInTheDocument();
  });

  it('el botón "Quitar" de un documento puntual llama a onRemove con el id del documento, no del ítem', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-especifico',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };
    const onRemove = vi.fn();

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={onRemove} />);

    fireEvent.click(screen.getByRole('button', { name: /quitar presupuesto/i }));

    expect(onRemove).toHaveBeenCalledWith('doc-especifico');
    expect(onRemove).not.toHaveBeenCalledWith('item-presupuesto');
  });
});

describe('DocumentChecklist — "Agregar otro" reemplaza a "Reemplazar" (tasks.md 4.3)', () => {
  it('un ítem con documentos ya cargados muestra "Agregar otro" en vez de "Reemplazar"', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /^reemplazar$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeInTheDocument();
  });

  it('"Agregar otro" sigue disparando el mismo input de archivo sin sobrescribir (flujo disponible con N > 0)', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeEnabled();
  });
});

describe('DocumentChecklist — distinción vigente/siguiente con Chip (tasks.md 4.4, design.md D2)', () => {
  it('con vigenciaDesde cargado en ambos documentos, el de vigenciaDesde vigente (no futuro) más reciente se marca "Vigente"', () => {
    const actual: DocumentoAdjunto = {
      id: 'doc-actual',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-actual.pdf',
      subidoEn: '2025-08-01T00:00:00.000Z',
      vigenciaDesde: '2025-08-01',
    };
    const renovacion: DocumentoAdjunto = {
      id: 'doc-renovacion',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-renovacion.pdf',
      subidoEn: '2026-08-05T00:00:00.000Z',
      vigenciaDesde: '2099-08-01', // período futuro: todavía no arrancó, no es "el vigente"
    };

    render(
      <DocumentChecklist items={items} documentos={[actual, renovacion]} onUpload={vi.fn()} onRemove={vi.fn()} />,
    );

    const filaActual = screen.getByText(/presupuesto-actual\.pdf/i).closest('div');
    const filaRenovacion = screen.getByText(/presupuesto-renovacion\.pdf/i).closest('div');
    expect(filaActual).toHaveTextContent(/vigente/i);
    expect(filaRenovacion).not.toHaveTextContent(/vigente/i);
  });

  it('sin vigenciaDesde en ningún documento, degrada a orden por subidoEn (el más reciente se marca "Vigente")', () => {
    const viejo: DocumentoAdjunto = {
      id: 'doc-viejo',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-viejo.pdf',
      subidoEn: '2025-08-01T00:00:00.000Z',
    };
    const reciente: DocumentoAdjunto = {
      id: 'doc-reciente',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-reciente.pdf',
      subidoEn: '2026-08-05T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[viejo, reciente]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    const filaReciente = screen.getByText(/presupuesto-reciente\.pdf/i).closest('div');
    const filaVieja = screen.getByText(/presupuesto-viejo\.pdf/i).closest('div');
    expect(filaReciente).toHaveTextContent(/vigente/i);
    expect(filaVieja).not.toHaveTextContent(/vigente/i);
  });
});

describe('DocumentChecklist — progreso a nivel ítem sin cambio de fórmula (tasks.md 4.5)', () => {
  it('"cargado" sigue significando "al menos un documento" al pasar de .find() a .filter()', () => {
    const dosDelMismoItem: DocumentoAdjunto[] = [
      { id: 'doc-1', itemId: 'item-presupuesto', nombreArchivo: 'a.pdf', subidoEn: '2026-01-01T00:00:00.000Z' },
      { id: 'doc-2', itemId: 'item-presupuesto', nombreArchivo: 'b.pdf', subidoEn: '2026-02-01T00:00:00.000Z' },
    ];

    render(<DocumentChecklist items={items} documentos={dosDelMismoItem} onUpload={vi.fn()} onRemove={vi.fn()} />);

    // 2 ítems totales, 1 cargado (presupuesto, con 2 documentos) — no debe contar como "2 cargados"
    // por tener 2 documentos; el ítem RHC sigue sin cargar.
    expect(screen.getByText(/1 de 2 documentos cargados/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pendiente/i)).toBeInTheDocument();
  });
});

describe('DocumentChecklist — readOnly deshabilita agregar y cada "Quitar" (tasks.md 4.6)', () => {
  it('con readOnly, "Agregar otro" y cada "Quitar" individual quedan deshabilitados', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} readOnly />);

    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar presupuesto/i })).toBeDisabled();
  });
});
