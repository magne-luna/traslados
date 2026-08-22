import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VistaPreviaArchivo, type EstadoPrevisualizacion } from './VistaPreviaArchivo';

// Mismo criterio que DocumentChecklist.test.tsx: `PdfPreview` (pdf.js + canvas) se mockea para
// verificar solo la delegación (qué props recibe) — su comportamiento interno ya está cubierto
// exhaustivamente en `PdfPreview.test.tsx`.
vi.mock('./PdfPreview', () => ({
  PdfPreview: ({ url, nombreArchivo }: { url: string; nombreArchivo: string }) => (
    <div data-testid="pdf-preview-stub" data-url={url} data-nombre-archivo={nombreArchivo} />
  ),
}));

// presupuestos-vigencia-datos-traslado-vista-previa (tasks.md 7.6/7.10, design.md D6a): tests
// directos del componente extraído, sin pasar por `DocumentChecklist` — mismos 5 desenlaces que
// ya cubría `ContenidoPreview` ahí (design.md Testing Strategy: "imagen / PDF / tipo no
// soportado / error / sin contenido"), verificando que la extracción no cambió ningún
// comportamiento y que los props generalizados (`nombreArchivo`/`tipoMime` en vez de
// `documento: DocumentoAdjunto`) siguen produciendo el mismo render.

const ESTADO_CARGANDO: EstadoPrevisualizacion = { status: 'cargando' };
const ESTADO_ERROR: EstadoPrevisualizacion = { status: 'error' };
const ESTADO_SIN_CONTENIDO: EstadoPrevisualizacion = { status: 'sin-contenido' };

function estadoLista(url = 'blob:mock-url'): EstadoPrevisualizacion {
  return { status: 'lista', url };
}

describe('VistaPreviaArchivo — desenlace 1: imagen', () => {
  it('tipoMime image/* se renderiza como <img> con el nombre de archivo como alt', () => {
    render(<VistaPreviaArchivo estado={estadoLista('blob:imagen')} nombreArchivo="foto.jpg" tipoMime="image/jpeg" />);

    const img = screen.getByAltText('foto.jpg');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'blob:imagen');
  });
});

describe('VistaPreviaArchivo — desenlace 2: PDF', () => {
  it('tipoMime application/pdf delega en PdfPreview (pdf.js + canvas) con la url y el nombre de archivo correctos, sin <iframe>', () => {
    const { container } = render(
      <VistaPreviaArchivo estado={estadoLista('blob:pdf')} nombreArchivo="informe.pdf" tipoMime="application/pdf" />,
    );

    const pdfPreview = screen.getByTestId('pdf-preview-stub');
    expect(pdfPreview).toHaveAttribute('data-url', 'blob:pdf');
    expect(pdfPreview).toHaveAttribute('data-nombre-archivo', 'informe.pdf');
    expect(container.querySelector('iframe')).not.toBeInTheDocument();
  });
});

describe('VistaPreviaArchivo — desenlace 3: tipo no soportado', () => {
  it('tipoMime fuera de imagen/pdf muestra el aviso explícito de "no se puede previsualizar", sin <img> ni <canvas>', () => {
    const { container } = render(
      <VistaPreviaArchivo estado={estadoLista('blob:zip')} nombreArchivo="contrato.zip" tipoMime="application/zip" />,
    );

    expect(screen.getByText(/no se puede previsualizar acá/i)).toBeInTheDocument();
    expect(screen.getByText(/contrato\.zip/)).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-preview-stub')).not.toBeInTheDocument();
  });

  it('con "lista" siempre aparece "Descargar" (incluso sin preview inline)', () => {
    render(<VistaPreviaArchivo estado={estadoLista('blob:zip')} nombreArchivo="contrato.zip" tipoMime="application/zip" />);

    const descargar = screen.getByRole('link', { name: /descargar/i });
    expect(descargar).toHaveAttribute('href', 'blob:zip');
    expect(descargar).toHaveAttribute('download', 'contrato.zip');
  });
});

describe('VistaPreviaArchivo — desenlace 4: error', () => {
  it('muestra un mensaje comprensible, nunca el mensaje crudo del error real', () => {
    render(<VistaPreviaArchivo estado={ESTADO_ERROR} nombreArchivo="informe.pdf" tipoMime="application/pdf" />);

    expect(screen.getByText(/no se pudo cargar la previsualización/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /descargar/i })).not.toBeInTheDocument();
  });
});

describe('VistaPreviaArchivo — desenlace 5: sin contenido', () => {
  it('muestra el estado explícito de "sin contenido para previsualizar", sin link de Descargar', () => {
    render(<VistaPreviaArchivo estado={ESTADO_SIN_CONTENIDO} nombreArchivo="informe.pdf" tipoMime="application/pdf" />);

    expect(screen.getByText(/no tiene contenido para previsualizar/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /descargar/i })).not.toBeInTheDocument();
  });
});

// No es uno de los 5 desenlaces "de contenido" de la spec, pero es un estado real de la máquina
// (`EstadoPrevisualizacion`) que el componente extraído sigue teniendo que cubrir tal cual lo
// hacía `ContenidoPreview` — se prueba aparte para no inflar el conteo de los 5 de arriba.
describe('VistaPreviaArchivo — estado intermedio: cargando', () => {
  it('mientras resuelve, muestra un texto de carga explícito, sin <img>/PdfPreview/Descargar', () => {
    const { container } = render(<VistaPreviaArchivo estado={ESTADO_CARGANDO} nombreArchivo="informe.pdf" tipoMime="application/pdf" />);

    expect(screen.getByText(/cargando previsualización/i)).toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pdf-preview-stub')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /descargar/i })).not.toBeInTheDocument();
  });
});

describe('VistaPreviaArchivo — sin tipoMime (fallback de extensión resuelto por el llamador, tasks.md 7.9)', () => {
  it('tipoMime undefined cae en la rama de "no se puede previsualizar" — el componente nunca infiere por su cuenta', () => {
    render(<VistaPreviaArchivo estado={estadoLista('blob:sin-tipo')} nombreArchivo="documento-viejo.pdf" tipoMime={undefined} />);

    expect(screen.getByText(/no se puede previsualizar acá/i)).toBeInTheDocument();
  });
});
