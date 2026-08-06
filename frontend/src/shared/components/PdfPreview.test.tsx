import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { getDocument } from 'pdfjs-dist';
import { PdfPreview } from './PdfPreview';

// documentos-previsualizacion (corrección 2026-08-06, ver design.md Checkpoint (e) y tasks.md
// 8.2): reemplaza el <iframe sandbox> por render propio con pdf.js. Se mockea el módulo completo
// — cargar/parsear un PDF real en cada test sería lento y frágil, y lo que hay que verificar acá
// es comportamiento observable (qué se llama, qué se renderiza), no la implementación interna de
// pdf.js.
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}));

const mockGetDocument = vi.mocked(getDocument);

interface PaginaFake {
  getViewport: ReturnType<typeof vi.fn>;
  render: ReturnType<typeof vi.fn>;
}

interface PdfFake {
  numPages: number;
  getPage: ReturnType<typeof vi.fn>;
}

// documentos-previsualizacion (corrección 2026-08-06): `destroy()` vive en el "loading task" que
// `getDocument()` devuelve (no en el `PdfFake` resuelto, ver comentario en PdfPreview.tsx) — el
// fake de acá refleja esa forma real, confirmada contra los tipos instalados.
interface LoadingTaskFake {
  promise: Promise<PdfFake>;
  destroy: ReturnType<typeof vi.fn>;
}

function crearPaginaFake(renderImpl?: () => { promise: Promise<void> }): PaginaFake {
  return {
    getViewport: vi.fn(() => ({ width: 100, height: 200 })),
    render: vi.fn(renderImpl ?? (() => ({ promise: Promise.resolve() }))),
  };
}

function crearPdfFake(numPages: number, pagina: PaginaFake = crearPaginaFake()): PdfFake {
  return {
    numPages,
    getPage: vi.fn(() => Promise.resolve(pagina)),
  };
}

function mockGetDocumentResuelve(pdf: PdfFake): LoadingTaskFake {
  const loadingTask: LoadingTaskFake = { promise: Promise.resolve(pdf), destroy: vi.fn(() => Promise.resolve()) };
  mockGetDocument.mockReturnValue(loadingTask as unknown as ReturnType<typeof getDocument>);
  return loadingTask;
}

function mockGetDocumentRechaza(error: Error): LoadingTaskFake {
  const loadingTask: LoadingTaskFake = { promise: Promise.reject(error), destroy: vi.fn(() => Promise.resolve()) };
  mockGetDocument.mockReturnValue(loadingTask as unknown as ReturnType<typeof getDocument>);
  return loadingTask;
}

beforeEach(() => {
  mockGetDocument.mockReset();
});

describe('PdfPreview — carga y render de PDF de una sola página (sin controles de navegación)', () => {
  it('muestra un estado de carga y luego renderiza el canvas, sin controles Anterior/Siguiente', async () => {
    const pdf = crearPdfFake(1);
    mockGetDocumentResuelve(pdf);

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);

    expect(screen.getByText(/cargando previsualización/i)).toBeInTheDocument();

    await waitFor(() => expect(pdf.getPage).toHaveBeenCalledWith(1));

    expect(mockGetDocument).toHaveBeenCalledWith({ url: 'blob:pdf-url' });
    expect(screen.queryByRole('button', { name: /anterior/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /siguiente/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/página 1 de/i)).not.toBeInTheDocument();
  });
});

describe('PdfPreview — PDF multipágina: navegación Anterior/Siguiente (comportamiento observable)', () => {
  it('con 3 páginas muestra los controles, el indicador "página 1 de 3", y navega con Siguiente/Anterior', async () => {
    const pdf = crearPdfFake(3);
    mockGetDocumentResuelve(pdf);

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);

    await waitFor(() => expect(pdf.getPage).toHaveBeenCalledWith(1));
    expect(screen.getByText(/página 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /siguiente/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(pdf.getPage).toHaveBeenCalledWith(2));
    expect(screen.getByText(/página 2 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anterior/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /anterior/i }));
    await waitFor(() => expect(pdf.getPage).toHaveBeenLastCalledWith(1));
    expect(screen.getByText(/página 1 de 3/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
  });
});

describe('PdfPreview — nitidez en pantallas HiDPI (devicePixelRatio)', () => {
  const dprOriginal = window.devicePixelRatio;

  afterEach(() => {
    Object.defineProperty(window, 'devicePixelRatio', { value: dprOriginal, configurable: true });
  });

  it('con devicePixelRatio 2, el canvas renderiza al doble de resolución interna que su tamaño visual (CSS)', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
    const pagina = crearPaginaFake();
    const pdf = crearPdfFake(1, pagina);
    mockGetDocumentResuelve(pdf);

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);
    await waitFor(() => expect(pagina.render).toHaveBeenCalled());

    const canvas = screen.getByRole('img', { name: 'presupuesto.pdf' }) as HTMLCanvasElement;
    // El viewport fake siempre da {width:100, height:200} (tamaño lógico, "de pantalla") sin
    // importar qué scale se le pida — es el mismo comportamiento que tendría un viewport real.
    expect(canvas.width).toBe(200);
    expect(canvas.height).toBe(400);
    expect(canvas.style.width).toBe('100px');
    expect(canvas.style.height).toBe('200px');
    expect(pagina.render).toHaveBeenCalledWith(expect.objectContaining({ transform: [2, 0, 0, 2, 0, 0] }));
  });

  it('con devicePixelRatio 1 (default), no hay transform extra ni diferencia entre tamaño interno y visual', async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });
    const pagina = crearPaginaFake();
    const pdf = crearPdfFake(1, pagina);
    mockGetDocumentResuelve(pdf);

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);
    await waitFor(() => expect(pagina.render).toHaveBeenCalled());

    const canvas = screen.getByRole('img', { name: 'presupuesto.pdf' }) as HTMLCanvasElement;
    expect(canvas.width).toBe(100);
    expect(canvas.height).toBe(200);
    expect(canvas.style.width).toBe('100px');
    expect(canvas.style.height).toBe('200px');
    expect(pagina.render).toHaveBeenCalledWith(expect.objectContaining({ transform: undefined }));
  });
});

describe('PdfPreview — zoom (Acercar/Alejar)', () => {
  it('arranca en 100%, Acercar sube el porcentaje y vuelve a renderizar la página con un scale mayor', async () => {
    const pagina = crearPaginaFake();
    const pdf = crearPdfFake(1, pagina);
    mockGetDocumentResuelve(pdf);

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);

    await waitFor(() => expect(pdf.getPage).toHaveBeenCalledWith(1));
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(pagina.getViewport).toHaveBeenLastCalledWith({ scale: 1 });

    fireEvent.click(screen.getByRole('button', { name: /acercar/i }));

    await waitFor(() => expect(screen.getByText('125%')).toBeInTheDocument());
    expect(pagina.getViewport).toHaveBeenLastCalledWith({ scale: 1.25 });
  });

  it('Alejar baja el porcentaje, y ninguno de los dos botones cruza los topes (50%–300%)', async () => {
    const pagina = crearPaginaFake();
    const pdf = crearPdfFake(1, pagina);
    mockGetDocumentResuelve(pdf);

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);
    await waitFor(() => expect(pdf.getPage).toHaveBeenCalledWith(1));

    const alejar = screen.getByRole('button', { name: /alejar/i });
    const acercar = screen.getByRole('button', { name: /acercar/i });

    // Baja hasta el piso (50%) y confirma que se deshabilita ahí, no antes ni después.
    for (let i = 0; i < 3; i++) fireEvent.click(alejar);
    await waitFor(() => expect(screen.getByText('50%')).toBeInTheDocument());
    expect(alejar).toBeDisabled();

    // Sube hasta el techo (300%) y confirma que Acercar se deshabilita ahí.
    for (let i = 0; i < 10; i++) fireEvent.click(acercar);
    await waitFor(() => expect(screen.getByText('300%')).toBeInTheDocument());
    expect(acercar).toBeDisabled();
  });

  it('al cambiar de página, el zoom actual se mantiene (no vuelve a 100%)', async () => {
    const pdf = crearPdfFake(2);
    mockGetDocumentResuelve(pdf);

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);
    await waitFor(() => expect(pdf.getPage).toHaveBeenCalledWith(1));

    fireEvent.click(screen.getByRole('button', { name: /acercar/i }));
    await waitFor(() => expect(screen.getByText('125%')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /siguiente/i }));
    await waitFor(() => expect(pdf.getPage).toHaveBeenCalledWith(2));

    expect(screen.getByText('125%')).toBeInTheDocument();
  });
});

describe('PdfPreview — estado de error (getDocument o render fallan)', () => {
  it('si getDocument() rechaza, muestra un mensaje de error genérico, nunca el error crudo', async () => {
    mockGetDocumentRechaza(new Error('403: sin permiso para este documento'));

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/403/)).not.toBeInTheDocument();
    expect(screen.queryByText(/sin permiso/i)).not.toBeInTheDocument();
  });

  it('si page.render() rechaza, también muestra el mismo estado de error genérico', async () => {
    const paginaQueFalla = crearPaginaFake(() => ({ promise: Promise.reject(new Error('render kaboom')) }));
    const pdf = crearPdfFake(1, paginaQueFalla);
    mockGetDocumentResuelve(pdf);

    render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/kaboom/i)).not.toBeInTheDocument();
  });
});

describe('PdfPreview — limpieza: destruye el loading task de pdf.js', () => {
  it('al desmontar con el documento ya cargado, llama a loadingTask.destroy()', async () => {
    const pdf = crearPdfFake(1);
    const loadingTask = mockGetDocumentResuelve(pdf);

    const { unmount } = render(<PdfPreview url="blob:pdf-url" nombreArchivo="presupuesto.pdf" />);

    await waitFor(() => expect(pdf.getPage).toHaveBeenCalledWith(1));

    unmount();

    expect(loadingTask.destroy).toHaveBeenCalledTimes(1);
  });

  it('al cambiar de url (otro documento) destruye el loading task anterior y carga el nuevo', async () => {
    const pdfViejo = crearPdfFake(1);
    const loadingTaskViejo = mockGetDocumentResuelve(pdfViejo);

    const { rerender } = render(<PdfPreview url="blob:pdf-viejo" nombreArchivo="viejo.pdf" />);
    await waitFor(() => expect(pdfViejo.getPage).toHaveBeenCalledWith(1));

    const pdfNuevo = crearPdfFake(1);
    mockGetDocumentResuelve(pdfNuevo);

    rerender(<PdfPreview url="blob:pdf-nuevo" nombreArchivo="nuevo.pdf" />);

    await waitFor(() => expect(loadingTaskViejo.destroy).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(pdfNuevo.getPage).toHaveBeenCalledWith(1));
  });
});
