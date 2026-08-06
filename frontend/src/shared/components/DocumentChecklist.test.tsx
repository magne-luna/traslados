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

describe('DocumentChecklist — acción "Ver" por documento (tasks.md 5.1)', () => {
  it('muestra un botón "Ver" por cada documento cuando se provee onResolverPrevisualizacion', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue(null)}
      />,
    );

    expect(screen.getByRole('button', { name: /ver/i })).toBeInTheDocument();
  });

  it('sin onResolverPrevisualizacion no se renderiza ningún botón "Ver" (los 6 puntos de montaje todavía no lo pasan, tasks.md §6)', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /ver/i })).not.toBeInTheDocument();
  });
});

describe('DocumentChecklist — aria-label de "Ver" distinguible por documento (tasks.md 5.2)', () => {
  it('con 2 documentos en el mismo ítem, cada "Ver" tiene un aria-label que combina ítem + archivo, siguiendo el patrón de "Quitar"', () => {
    const doc1: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-2025.pdf',
      subidoEn: '2025-08-01T00:00:00.000Z',
    };
    const doc2: DocumentoAdjunto = {
      id: 'doc-2',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto-2026.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc1, doc2]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue(null)}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ver Presupuesto - presupuesto-2025.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver Presupuesto - presupuesto-2026.pdf' })).toBeInTheDocument();
  });
});

describe('DocumentChecklist — estado local de "qué documento estoy viendo" (tasks.md 5.3, design.md D3)', () => {
  it('clickear "Ver" llama a onResolverPrevisualizacion con el id del documento y monta el overlay', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };
    const onResolver = vi.fn().mockResolvedValue(null);

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={onResolver}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - presupuesto\.pdf/i }));

    expect(onResolver).toHaveBeenCalledWith('doc-1');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('DocumentChecklist — contenido de la previsualización según tipoMime (tasks.md 5.4, design.md Checkpoint (e))', () => {
  it('imagen (tipoMime image/*) se renderiza como <img>', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'foto.jpg',
      subidoEn: '2026-08-01T00:00:00.000Z',
      tipoMime: 'image/jpeg',
    };

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue('blob:foto-url')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - foto\.jpg/i }));

    const img = await screen.findByRole('img', { name: /foto\.jpg/i });
    expect(img).toHaveAttribute('src', 'blob:foto-url');
  });

  it('PDF (tipoMime application/pdf) se renderiza como <iframe> sandboxeado con allow-same-origin (necesario para cargar blob:) pero sin allow-scripts', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
      tipoMime: 'application/pdf',
    };

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue('blob:pdf-url')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - presupuesto\.pdf/i }));

    const iframe = await screen.findByTitle('presupuesto.pdf');
    expect(iframe.tagName).toBe('IFRAME');
    expect(iframe).toHaveAttribute('src', 'blob:pdf-url');
    expect(iframe).toHaveAttribute('sandbox', 'allow-same-origin');
    expect(iframe.getAttribute('sandbox')).not.toContain('allow-scripts');
  });

  it('tipo no soportado (ej. application/zip) muestra un estado explícito de "no previsualizable", sin <img> ni <iframe>', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'archivo.zip',
      subidoEn: '2026-08-01T00:00:00.000Z',
      tipoMime: 'application/zip',
    };

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue('blob:zip-url')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - archivo\.zip/i }));

    expect(await screen.findByText(/no se puede previsualizar/i)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
  });
});

describe('DocumentChecklist — estados de carga/error/no-previsualizable (tasks.md 5.5, design.md D5)', () => {
  it('mientras resuelve, muestra un estado de carga explícito', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
      tipoMime: 'application/pdf',
    };
    let resolver: (v: string | null) => void = () => {};
    const onResolver = vi.fn(
      () =>
        new Promise<string | null>((res) => {
          resolver = res;
        }),
    );

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={onResolver}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - presupuesto\.pdf/i }));

    expect(screen.getByText(/cargando previsualización/i)).toBeInTheDocument();

    // Resolver la promesa pendiente para no dejar el test colgado (act warning).
    resolver('blob:x');
    await screen.findByTitle('presupuesto.pdf');
  });

  it('si resolverPrevisualizacion rechaza, muestra un mensaje de error genérico, nunca el mensaje crudo del error', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
      tipoMime: 'application/pdf',
    };
    const onResolver = vi.fn().mockRejectedValue(new Error('403: sin permiso para este documento'));

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={onResolver}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - presupuesto\.pdf/i }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/403/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin permiso/i)).not.toBeInTheDocument();
  });

  it('si resolverPrevisualizacion resuelve null, muestra el estado explícito de "sin contenido para previsualizar"', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'viejo.pdf',
      subidoEn: '2025-01-01T00:00:00.000Z',
    };

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue(null)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - viejo\.pdf/i }));

    expect(await screen.findByText(/no tiene contenido para previsualizar/i)).toBeInTheDocument();
  });
});

describe('DocumentChecklist — "Ver" disponible en readOnly (tasks.md 5.6, design.md Checkpoint (c))', () => {
  it('con readOnly, "Ver" sigue habilitado aunque "Agregar otro" y "Quitar" queden deshabilitados (el gateo de cliente no debe ser más restrictivo que la RLS)', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue(null)}
        readOnly
      />,
    );

    expect(screen.getByRole('button', { name: /ver presupuesto - presupuesto\.pdf/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar presupuesto/i })).toBeDisabled();
  });
});

describe('DocumentChecklist — cerrar el overlay no recarga ni pierde progreso ni "Vigente" (tasks.md 5.7)', () => {
  it('tras abrir y cerrar "Ver" con Escape, el progreso y el chip "Vigente" siguen intactos, no se llama onUpload/onRemove, y se revoca la URL abierta', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
      tipoMime: 'application/pdf',
    };
    const onUpload = vi.fn();
    const onRemove = vi.fn();
    const onRevocar = vi.fn();

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={onUpload}
        onRemove={onRemove}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue('blob:x')}
        onRevocarPrevisualizacion={onRevocar}
      />,
    );

    expect(screen.getByText(/1 de 2 documentos cargados/i)).toBeInTheDocument();
    expect(screen.getByText(/presupuesto\.pdf/i).closest('div')).toHaveTextContent(/vigente/i);

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - presupuesto\.pdf/i }));
    await screen.findByRole('dialog');
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText(/1 de 2 documentos cargados/i)).toBeInTheDocument();
    expect(screen.getByText(/presupuesto\.pdf/i).closest('div')).toHaveTextContent(/vigente/i);
    expect(onUpload).not.toHaveBeenCalled();
    expect(onRemove).not.toHaveBeenCalled();
    expect(onRevocar).toHaveBeenCalledWith('blob:x');
  });

  it('si el componente se desmonta con la ventana todavía abierta (sin Escape/backdrop explícito), igual revoca la URL abierta', async () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
      tipoMime: 'application/pdf',
    };
    const onRevocar = vi.fn();

    const { unmount } = render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue('blob:y')}
        onRevocarPrevisualizacion={onRevocar}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - presupuesto\.pdf/i }));
    await screen.findByRole('dialog');

    unmount();

    expect(onRevocar).toHaveBeenCalledWith('blob:y');
  });
});
