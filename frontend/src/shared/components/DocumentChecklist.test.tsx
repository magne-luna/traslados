import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ChecklistItem, DocumentoAdjunto } from '../types/documento';
import { DocumentChecklist } from './DocumentChecklist';

// documentos-previsualizacion (corrección 2026-08-06): `ContenidoPreview` delega PDF a
// `PdfPreview` (pdf.js + canvas, ver DocumentChecklist.tsx). Se mockea acá para verificar solo la
// delegación (qué props recibe) — el comportamiento interno de `PdfPreview` (carga, paginación,
// error, limpieza) ya está cubierto exhaustivamente en `PdfPreview.test.tsx`; duplicarlo acá
// además obligaría a mockear pdf.js completo en este archivo sin aportar cobertura nueva.
vi.mock('./PdfPreview', () => ({
  PdfPreview: ({ url, nombreArchivo }: { url: string; nombreArchivo: string }) => (
    <div data-testid="pdf-preview-stub" data-url={url} data-nombre-archivo={nombreArchivo} />
  ),
}));

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

describe('DocumentChecklist — clickear la fila abre "Ver" (feedback de usuario, 2026-08-06)', () => {
  it('clickear la fila del documento (no el botón "Ver") abre la previsualización', async () => {
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

    // Click sobre el texto del nombre de archivo, NO sobre el botón "Ver" — es el punto central
    // de este test: la fila entera es clickeable, no solo el botón.
    fireEvent.click(screen.getByText(/foto\.jpg/i));

    const img = await screen.findByRole('img', { name: /foto\.jpg/i });
    expect(img).toHaveAttribute('src', 'blob:foto-url');
  });

  it('clickear "Quitar" NO abre la previsualización (stopPropagation, no dispara también el click de la fila)', () => {
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

    fireEvent.click(screen.getByRole('button', { name: /quitar presupuesto/i }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sin onResolverPrevisualizacion (punto de montaje sin cablear), la fila no es clickeable', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    fireEvent.click(screen.getByText(/presupuesto\.pdf/i));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
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

describe('DocumentChecklist — dos instancias montadas en paralelo calculan su progreso de forma aislada (tasks.md §4.2, design.md D1)', () => {
  // Escenario nuevo que introduce `documentos-checklist-por-actividad` §3: N `DocumentChecklist`
  // montados en simultáneo en la misma pantalla (uno "General" + uno por actividad). El escenario
  // central de la agrupación por `agrupacionId` ya está cubierto por `PacienteDocumentos.test.tsx`
  // (tasks.md 3.7, no se duplica acá) a nivel de integración. Lo que ese test NO afirma
  // explícitamente es el contador agregado (`cargados`/`pctCargado`) de cada bloque — solo el chip
  // "Falta" por ítem. Este test cierra ese ángulo puntual a nivel de UNIDAD de `DocumentChecklist`
  // en sí (sin pasar por Pacientes/`useDocumentChecklist`): confirma que el componente compartido no
  // tiene ningún estado global/módulo compartido entre instancias — cada `cargados`/`pendientes`/
  // `pctCargado` se deriva únicamente de los `items`/`documentos` que esa instancia puntual recibió.
  it('cargar documentos en una instancia no afecta el contador "X de Y documentos cargados" de la otra instancia montada al lado', () => {
    const itemsA: ChecklistItem[] = [
      { id: 'item-a1', nombre: 'Item A1', requerido: true },
      { id: 'item-a2', nombre: 'Item A2', requerido: true },
    ];
    const itemsB: ChecklistItem[] = [{ id: 'item-b1', nombre: 'Item B1', requerido: true }];
    const docA: DocumentoAdjunto = {
      id: 'doc-a',
      itemId: 'item-a1',
      nombreArchivo: 'a.pdf',
      subidoEn: '2026-01-01T00:00:00.000Z',
    };

    render(
      <>
        <section aria-label="Instancia A">
          <DocumentChecklist items={itemsA} documentos={[docA]} onUpload={vi.fn()} onRemove={vi.fn()} />
        </section>
        <section aria-label="Instancia B">
          <DocumentChecklist items={itemsB} documentos={[]} onUpload={vi.fn()} onRemove={vi.fn()} />
        </section>
      </>,
    );

    const instanciaA = screen.getByRole('region', { name: 'Instancia A' });
    const instanciaB = screen.getByRole('region', { name: 'Instancia B' });

    expect(within(instanciaA).getByText(/1 de 2 documentos cargados/i)).toBeInTheDocument();
    expect(within(instanciaB).getByText(/0 de 1 documentos cargados/i)).toBeInTheDocument();
    // Triangulación: la instancia sin documentos no hereda el "Cargado" ni el ítem de la otra.
    expect(within(instanciaB).queryByText(/item a1|item a2/i)).not.toBeInTheDocument();
  });
});

describe('DocumentChecklist — mostrarProgreso oculta la barra "X de Y cargados" propia de la instancia (feedback 2026-08-07)', () => {
  it('mostrarProgreso={false}: no renderiza el resumen "X de Y documentos cargados" ni el chip de pendientes', () => {
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
        mostrarProgreso={false}
      />,
    );

    expect(screen.queryByText(/documentos cargados/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/pendiente/i)).not.toBeInTheDocument();
    // Triangulación: el resto del checklist (ítems, chips por ítem, botones) sigue intacto — solo
    // desaparece el bloque de resumen agregado, no el componente entero.
    expect(screen.getByText('Presupuesto')).toBeInTheDocument();
    expect(screen.getByText(/presupuesto\.pdf/i)).toBeInTheDocument();
  });

  it('sin pasar mostrarProgreso (default true): sigue mostrando el resumen — cero regresión para Vehículos/Conductores/Facturas', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText(/1 de 2 documentos cargados/i)).toBeInTheDocument();
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

  it('PDF (tipoMime application/pdf) delega en PdfPreview (pdf.js + canvas, sin <iframe>) con la url y el nombre de archivo correctos', async () => {
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

    const pdfPreview = await screen.findByTestId('pdf-preview-stub');
    expect(pdfPreview).toHaveAttribute('data-url', 'blob:pdf-url');
    expect(pdfPreview).toHaveAttribute('data-nombre-archivo', 'presupuesto.pdf');
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
  });

  it('con contenido resuelto (imagen o PDF), aparece un link "Descargar" con la url y el nombre de archivo original', async () => {
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

    const link = await screen.findByRole('link', { name: /descargar/i });
    expect(link).toHaveAttribute('href', 'blob:foto-url');
    expect(link).toHaveAttribute('download', 'foto.jpg');
  });

  it('tipo no soportado (ej. zip) tiene URL válida igual, así que "Descargar" aparece ahí también', async () => {
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

    await screen.findByText(/no se puede previsualizar/i);
    const link = await screen.findByRole('link', { name: /descargar/i });
    expect(link).toHaveAttribute('href', 'blob:zip-url');
    expect(link).toHaveAttribute('download', 'archivo.zip');
  });

  it('sin contenido resuelto (null, D2) o con error, no aparece el link "Descargar" — no hay url válida que ofrecer', async () => {
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
        onResolverPrevisualizacion={vi.fn().mockResolvedValue(null)}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /ver presupuesto - presupuesto\.pdf/i }));

    await screen.findByText(/no tiene contenido para previsualizar/i);
    expect(screen.queryByRole('link', { name: /descargar/i })).not.toBeInTheDocument();
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
    await screen.findByTestId('pdf-preview-stub');
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

// checklist-documental-progreso-visual (skill `prototype`, variante "Progreso visual" elegida
// 2026-08-10, solo Pacientes por ahora): `variant="ring"` es puramente visual — cambia el marcador
// de estado de cada ítem (círculo con check en vez de ícono + Chip), nunca el contrato funcional
// ya cubierto por el resto de este archivo (Subir/Agregar otro/Quitar, readOnly, Ver, colección de
// N documentos). Sin `variant`, el comportamiento por defecto (Vehículos/Conductores/Facturas)
// queda exactamente igual — ningún test de arriba se tocó.
describe('DocumentChecklist — variant="ring" (checklist-documental-progreso-visual)', () => {
  it('renderiza un círculo de estado por ítem (data-testid="ring-item-badge", ausente en el variant por defecto) con "Cargado"/"Falta" en texto', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    const { rerender } = render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryAllByTestId('ring-item-badge')).toHaveLength(0);

    rerender(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} variant="ring" />);

    expect(screen.getAllByTestId('ring-item-badge')).toHaveLength(2);
    expect(screen.getByText('Presupuesto')).toBeInTheDocument();
    expect(screen.getByText('Cargado')).toBeInTheDocument();
    expect(screen.getByText('RHC')).toBeInTheDocument();
    expect(screen.getByText('Falta')).toBeInTheDocument();
  });

  it('un ítem opcional sin cargar muestra "Sin cargar" (triangulación del estado de texto)', () => {
    const itemsConOpcional: ChecklistItem[] = [...items, { id: 'item-cuil', nombre: 'Constancia de CUIL', requerido: false }];

    render(<DocumentChecklist items={itemsConOpcional} documentos={[]} onUpload={vi.fn()} onRemove={vi.fn()} variant="ring" />);

    expect(screen.getAllByTestId('ring-item-badge')).toHaveLength(3);
    expect(screen.getByText('Sin cargar')).toBeInTheDocument();
  });

  it('"Subir"/"Agregar otro" y "Quitar" siguen llamando a los mismos callbacks que el variant por defecto', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };
    const onRemove = vi.fn();

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={onRemove} variant="ring" />);

    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^subir$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quitar presupuesto/i }));
    expect(onRemove).toHaveBeenCalledWith('doc-1');
  });

  it('readOnly deshabilita "Agregar otro" y "Quitar" igual que el variant por defecto (tasks.md 4.6)', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(
      <DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} readOnly variant="ring" />,
    );

    expect(screen.getByRole('button', { name: /agregar otro/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /quitar presupuesto/i })).toBeDisabled();
  });

  // checklist-documental-progreso-visual (ampliación 2026-08-10, "dejar todo consistente"):
  // Vehículos/Conductores/Facturas no suprimen `mostrarProgreso` (a diferencia de Pacientes) — su
  // resumen "X de Y cargados" es la ÚNICA fuente de progreso que tienen, así que también pasa a
  // usar el anillo en vez de la barra lineal cuando `variant="ring"`, mismo texto/Chip que antes.
  it('con mostrarProgreso (default true) y variant="ring", el resumen usa el anillo en vez de la barra lineal, con el mismo texto', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    const { rerender } = render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.queryByTestId('ring-progreso-header')).not.toBeInTheDocument();
    expect(screen.getByText(/1 de 2 documentos cargados/i)).toBeInTheDocument();

    rerender(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} variant="ring" />);

    expect(screen.getByTestId('ring-progreso-header')).toBeInTheDocument();
    expect(screen.getByText(/1 de 2 documentos cargados/i)).toBeInTheDocument();
    expect(screen.getByText(/1 pendiente/i)).toBeInTheDocument();
  });
});

// documentos-transferencia-actividad (tasks.md 6.1/6.2, design.md Checkpoint (c) VEREDICTO opción
// A — mismo mecanismo opt-in que `mostrarProgreso`): "Transferir" solo aparece cuando el punto de
// montaje pasa `onTransferir`. Vehículos/Conductores/Facturas nunca lo pasan (no se tocan sus
// wrappers en este change) — mismo precedente que el test de `mostrarProgreso` de arriba
// ("cero regresión para Vehículos/Conductores/Facturas").
describe('DocumentChecklist — acción "Transferir" por documento (tasks.md 6.1, Checkpoint (c) opción A)', () => {
  const doc: DocumentoAdjunto = {
    id: 'doc-1',
    itemId: 'item-presupuesto',
    nombreArchivo: 'presupuesto.pdf',
    subidoEn: '2026-08-01T00:00:00.000Z',
  };

  it('muestra un botón "Transferir" por documento cuando se provee onTransferir', () => {
    render(
      <DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} onTransferir={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: /transferir/i })).toBeInTheDocument();
  });

  it('sin onTransferir (punto de montaje sin cablear — Vehículos/Conductores/Facturas) no se renderiza ningún botón "Transferir"', () => {
    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /transferir/i })).not.toBeInTheDocument();
  });

  it('clickear "Transferir" llama a onTransferir con el id del documento, no del ítem', async () => {
    const onTransferir = vi.fn();

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onTransferir={onTransferir}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /transferir presupuesto/i }));

    expect(onTransferir).toHaveBeenCalledWith('doc-1');
    expect(onTransferir).not.toHaveBeenCalledWith('item-presupuesto');
  });

  it('con readOnly, "Transferir" queda deshabilitado igual que "Quitar" (Checkpoint (g): transferir exige escritura)', () => {
    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onTransferir={vi.fn()}
        readOnly
      />,
    );

    expect(screen.getByRole('button', { name: /transferir presupuesto/i })).toBeDisabled();
  });

  it('clickear "Transferir" NO abre la previsualización (stopPropagation, mismo criterio que "Quitar")', () => {
    const onResolverPrevisualizacion = vi.fn().mockResolvedValue(null);

    render(
      <DocumentChecklist
        items={items}
        documentos={[doc]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onTransferir={vi.fn()}
        onResolverPrevisualizacion={onResolverPrevisualizacion}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /transferir presupuesto/i }));

    expect(onResolverPrevisualizacion).not.toHaveBeenCalled();
  });
});

// documentos-transferencia-actividad (Checkpoint (e) de design.md, VEREDICTO revisado
// 2026-08-11: opción B implementada antes de archivar, en vez de quedar como forma futura).
// Hoy el render está manejado por `items` — `items.map(item => documentos.filter(d =>
// d.itemId === item.id))` — así que un documento cuyo `itemId` no matchea NINGÚN `item.id` de la
// lista vigente nunca se renderiza: no hay error, no se pierde en la base, pero desaparece de la
// vista. Es inofensivo hoy porque todos los bloques de un paciente reciben siempre los mismos
// ítems (los de la obra social), pero dejará de serlo cuando
// `documentos-checklist-items-por-actividad` cablee `combinarItemsDeActividad()` y las listas de
// ítems empiecen a variar por actividad — ahí `transferirAgrupacion` (6.1) puede aterrizar un
// documento en un bloque cuya lista de ítems no lo incluye. Esta es una guardia GENÉRICA del
// componente compartido, no específica de Pacientes ni de transferencia: protege contra
// cualquier drift futuro entre el `itemId` de un documento y la lista de `items` vigente
// (incluido el caso de borrar un ítem del checklist de una obra social con documentos ya
// cargados contra él).
describe('DocumentChecklist — documentos huérfanos: itemId sin ítem correspondiente en la lista vigente (Checkpoint (e), 2026-08-11)', () => {
  const huerfano: DocumentoAdjunto = {
    id: 'doc-huerfano',
    itemId: 'item-que-ya-no-existe',
    nombreArchivo: 'huerfano.pdf',
    subidoEn: '2026-08-01T00:00:00.000Z',
  };

  it('RED: un documento con itemId que no matchea ningún ítem de la lista vigente NO desaparece — sigue en el DOM', () => {
    render(<DocumentChecklist items={items} documentos={[huerfano]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    // Antes de esta guardia, este documento se filtraba silenciosamente afuera de todo `item.map`
    // y nunca llegaba a renderizarse — este assert es el que reproduce el bug con el código
    // original (falla en rojo antes de la implementación de la sección "Otros documentos").
    expect(screen.getByText(/huerfano\.pdf/i)).toBeInTheDocument();
  });

  it('sin huérfanos, no se muestra ninguna sección "Otros documentos" (nunca "0 documentos" fantasma)', () => {
    const doc: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[doc]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByText(/otros documentos/i)).not.toBeInTheDocument();
  });

  it('un solo huérfano: aparece bajo la sección "Otros documentos", debajo de los ítems normales', () => {
    render(<DocumentChecklist items={items} documentos={[huerfano]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText(/otros documentos/i)).toBeInTheDocument();
    expect(screen.getByText(/huerfano\.pdf/i)).toBeInTheDocument();
  });

  it('varios huérfanos mezclados con documentos de ítems normales: todos visibles, cada uno en su lugar', () => {
    const normal: DocumentoAdjunto = {
      id: 'doc-normal',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };
    const huerfano2: DocumentoAdjunto = {
      id: 'doc-huerfano-2',
      itemId: 'item-borrado-hace-tiempo',
      nombreArchivo: 'huerfano-2.pdf',
      subidoEn: '2026-08-02T00:00:00.000Z',
    };

    render(
      <DocumentChecklist
        items={items}
        documentos={[normal, huerfano, huerfano2]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText(/presupuesto\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/huerfano\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/huerfano-2\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/otros documentos/i)).toBeInTheDocument();
  });

  it('el huérfano NO cuenta para el progreso "cargados/total" (el progreso sigue siendo por ítem vigente)', () => {
    const normal: DocumentoAdjunto = {
      id: 'doc-normal',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    // Sin huérfano: 1 de 2 cargados. Con huérfano agregado, el total y el cargado de `items` no
    // deben moverse — el huérfano no es ninguno de los dos ítems vigentes.
    render(
      <DocumentChecklist items={items} documentos={[normal, huerfano]} onUpload={vi.fn()} onRemove={vi.fn()} />,
    );

    expect(screen.getByText(/1 de 2 documentos cargados/i)).toBeInTheDocument();
    expect(screen.queryByText(/2 de 2 documentos cargados/i)).not.toBeInTheDocument();
  });

  it('un huérfano se puede previsualizar/descargar aunque esté en readOnly (mismo criterio que "Ver" para ítems normales)', () => {
    render(
      <DocumentChecklist
        items={items}
        documentos={[huerfano]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onResolverPrevisualizacion={vi.fn().mockResolvedValue(null)}
        readOnly
      />,
    );

    expect(screen.getByRole('button', { name: /ver.*huerfano\.pdf/i })).toBeEnabled();
  });

  it('un huérfano en readOnly NO se puede transferir ni quitar (mismo gate de usePuedeEscribir que el resto del componente)', () => {
    render(
      <DocumentChecklist
        items={items}
        documentos={[huerfano]}
        onUpload={vi.fn()}
        onRemove={vi.fn()}
        onTransferir={vi.fn()}
        readOnly
      />,
    );

    expect(screen.getByRole('button', { name: /quitar.*huerfano\.pdf/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /transferir.*huerfano\.pdf/i })).toBeDisabled();
  });

  it('si el punto de montaje habilita transferencia (onTransferir), un huérfano también se puede transferir — es la vía de escape para corregirlo', () => {
    const onTransferir = vi.fn();

    render(
      <DocumentChecklist items={items} documentos={[huerfano]} onUpload={vi.fn()} onRemove={vi.fn()} onTransferir={onTransferir} />,
    );

    const boton = screen.getByRole('button', { name: /transferir.*huerfano\.pdf/i });
    expect(boton).toBeEnabled();

    fireEvent.click(boton);

    expect(onTransferir).toHaveBeenCalledWith('doc-huerfano');
  });

  it('sin onTransferir, un huérfano tampoco muestra botón "Transferir" (mismo opt-in que el resto del componente)', () => {
    render(<DocumentChecklist items={items} documentos={[huerfano]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /transferir/i })).not.toBeInTheDocument();
  });

  // No-regresión cruzada (mismo patrón que los tests de arriba, "cero regresión para
  // Vehículos/Conductores/Facturas"): esos tres dominios nunca tienen huérfanos hoy — cada
  // documento que cargan siempre corresponde a un ítem de su propio checklist. Con esa forma de
  // uso real (todo `documentos` matchea algún `items`), el render debe quedar IDÉNTICO a antes de
  // esta guardia: ninguna sección "Otros documentos", mismo texto de progreso, mismos botones.
  it('no-regresión: con todos los documentos matcheando algún ítem (uso real de Vehículos/Conductores/Facturas), el render queda idéntico — sin sección "Otros documentos"', () => {
    const doc1: DocumentoAdjunto = {
      id: 'doc-1',
      itemId: 'item-presupuesto',
      nombreArchivo: 'presupuesto.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };
    const doc2: DocumentoAdjunto = {
      id: 'doc-2',
      itemId: 'item-rhc',
      nombreArchivo: 'rhc.pdf',
      subidoEn: '2026-08-01T00:00:00.000Z',
    };

    render(<DocumentChecklist items={items} documentos={[doc1, doc2]} onUpload={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.queryByText(/otros documentos/i)).not.toBeInTheDocument();
    expect(screen.getByText(/2 de 2 documentos cargados/i)).toBeInTheDocument();
    expect(screen.getByText(/presupuesto\.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/rhc\.pdf/i)).toBeInTheDocument();
  });
});
