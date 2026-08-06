import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist';
// documentos-previsualizacion (corrección 2026-08-06, ver DocumentChecklist.tsx y design.md
// Checkpoint (e)): patrón estándar de pdf.js + Vite — el worker se importa como URL de asset
// (`?url`, tipado por `vite/client` en tsconfig.app.json) y se asigna a `workerSrc`. Confirmado
// contra los tipos instalados de `pdfjs-dist@6.2.108` (`GlobalWorkerOptions.workerSrc: string`) y
// contra el build real de Vite (no solo dev) — ver evidencia en tasks.md.
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Button, InlineIcon } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { iconMas, iconMenos } from '../../design-system/icons';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

// documentos-previsualizacion (corrección 2026-08-06): los mismos cuatro desenlaces que
// `ContenidoPreview` ya modela para el contrato de nivel superior (D5), pero acá el "sin
// contenido" no aplica — `PdfPreview` solo se monta cuando ya hay una `url` resuelta. `cargando`
// cubre tanto el parseo del documento como el render de cada página nueva.
type EstadoPdf = { status: 'cargando' } | { status: 'lista'; numPaginas: number } | { status: 'error' };

export function PdfPreview({ url, nombreArchivo }: { url: string; nombreArchivo: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  // documentos-previsualizacion (corrección 2026-08-06): `PDFDocumentProxy` (el objeto resuelto
  // de la promesa) NO tiene `destroy()` — confirmado contra los tipos instalados de
  // `pdfjs-dist@6.2.108` (`tsc -b --noEmit` lo marcó en rojo al asumir lo contrario). El
  // `destroy()` real vive en `PDFDocumentLoadingTask`, el objeto que `getDocument()` devuelve
  // SINCRÓNICAMENTE (antes de que `.promise` resuelva) — por eso se guarda acá, no en `pdfRef`,
  // y por eso el cleanup lo puede llamar sin importar si la carga ya terminó o sigue en vuelo
  // ("Abort all network requests and destroy the worker", según su propio doc comment).
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const [estado, setEstado] = useState<EstadoPdf>({ status: 'cargando' });
  const [pagina, setPagina] = useState(1);
  // documentos-previsualizacion (feedback post-implementación, 2026-08-06): la implementación
  // anterior (iframe nativo) permitía zoom "gratis" vía los controles del navegador; el canvas
  // propio no tiene eso, así que se agrega acá. Topes 50%–300%, paso 25 puntos — arbitrarios pero
  // razonables (no vino un valor pedido por la clienta); el zoom se mantiene al cambiar de página
  // (no se resetea en el efecto de `pagina`, solo en el de `url`, ver abajo).
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 3;
  const ZOOM_PASO = 0.25;
  const [scale, setScale] = useState(1);

  // Carga (y descarta) el documento cada vez que cambia `url` — un documento nuevo o el mismo
  // componente reutilizado para otro archivo. `cancelado` evita setState sobre una carga
  // obsoleta (mismo patrón que `vistaIdRef` en DocumentChecklist.tsx), y el cleanup es también el
  // punto único de `loadingTask.destroy()`, sea por desmontaje o por cambio de `url` (tasks.md,
  // requisito de limpieza).
  useEffect(() => {
    let cancelado = false;
    setEstado({ status: 'cargando' });
    setPagina(1);
    setScale(1);

    const loadingTask = pdfjsLib.getDocument({ url });
    loadingTaskRef.current = loadingTask;

    loadingTask.promise
      .then((pdf) => {
        if (cancelado) return;
        pdfRef.current = pdf;
        setEstado({ status: 'lista', numPaginas: pdf.numPages });
      })
      .catch(() => {
        if (!cancelado) setEstado({ status: 'error' });
      });

    return () => {
      cancelado = true;
      pdfRef.current = null;
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
    };
  }, [url]);

  // Renderiza la página actual al canvas — corre cuando el documento terminó de cargar o cuando
  // cambia `pagina` (Anterior/Siguiente). D5 (mensaje genérico, nunca el error crudo) aplica acá
  // también: un fallo de `getPage`/`render` transiciona al mismo estado de error que un fallo de
  // `getDocument`.
  useEffect(() => {
    if (estado.status !== 'lista') return;
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;

    let cancelado = false;

    pdf
      .getPage(pagina)
      .then((page) => {
        if (cancelado) return undefined;
        const viewport = page.getViewport({ scale });
        // Nitidez en pantallas HiDPI (fix "se ve borroso", 2026-08-06): `viewport.width/height`
        // es el tamaño "lógico" (CSS px). Sin esto, el canvas se renderiza a esa resolución tal
        // cual, y una pantalla Retina (devicePixelRatio 2) necesita el doble de píxeles reales
        // para verse nítida — por eso se veía borroso. El backing store (`canvas.width/height`)
        // se infla por `devicePixelRatio`, pero el tamaño VISIBLE (`canvas.style.width/height`)
        // se deja en el tamaño lógico — así ocupa el mismo lugar en pantalla, solo que con más
        // detalle. `transform` es la matriz que pdf.js necesita para que el contenido dibujado
        // llene ese backing store más grande (patrón estándar de la propia documentación de
        // pdf.js para HiDPI).
        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
        return page.render({ canvas, viewport, transform }).promise;
      })
      .catch(() => {
        if (!cancelado) setEstado({ status: 'error' });
      });

    return () => {
      cancelado = true;
    };
  }, [estado.status, pagina, scale]);

  if (estado.status === 'cargando') {
    return <p className="font-body text-sm text-muted">Cargando previsualización…</p>;
  }

  if (estado.status === 'error') {
    return <Alert tone="danger">No se pudo cargar la previsualización. Probá de nuevo en un momento.</Alert>;
  }

  const { numPaginas } = estado;

  return (
    <div className="flex w-full min-w-0 flex-col items-center gap-sm">
      {/* documentos-previsualizacion (fix estiramiento, 2026-08-06): el <canvas>, a diferencia de
          <img>, no respeta `object-fit` de forma confiable — forzar su ancho vía CSS (`w-full`)
          mientras el alto quedaba capado por separado (`max-h-[70vh]`) deformaba la imagen. Acá
          el canvas se deja en su tamaño natural (el que le dan `canvas.width`/`canvas.height` de
          arriba, sin clases de tamaño), y es el contenedor el que scrollea si el zoom lo hace más
          grande que el espacio disponible — mismo comportamiento que un visor de PDF nativo.
          `min-w-0` (fix "el zoom agranda toda la tarjeta", 2026-08-06): sin esto, un flex item
          nunca se achica por debajo del ancho de su contenido — con el canvas más ancho por el
          zoom, en vez de scrollear adentro de esta caja empujaba el diálogo entero más allá de su
          `max-w-[640px]`. Bug clásico de flexbox, no específico de pdf.js. */}
      <div className="max-h-[70vh] w-full min-w-0 overflow-auto rounded-sm border border-border">
        <canvas ref={canvasRef} role="img" aria-label={nombreArchivo} className="mx-auto block" />
      </div>
      {/* documentos-previsualizacion (feedback de layout, 2026-08-06): el zoom flotando ENCIMA
          del contenido tapaba texto al scrollear — se saca del visor y pasa a su propia fila,
          debajo, alineada a la derecha (mismo criterio que "Descargar" más abajo). */}
      <div className="flex w-full items-center justify-end gap-xs">
        <button
          type="button"
          aria-label="Alejar"
          disabled={scale <= ZOOM_MIN}
          onClick={() => setScale((s) => Math.max(ZOOM_MIN, Number((s - ZOOM_PASO).toFixed(2))))}
          className="cursor-pointer rounded-sm border-none bg-transparent p-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <InlineIcon size={16}>{iconMenos}</InlineIcon>
        </button>
        <span className="font-body text-xs text-muted">{Math.round(scale * 100)}%</span>
        <button
          type="button"
          aria-label="Acercar"
          disabled={scale >= ZOOM_MAX}
          onClick={() => setScale((s) => Math.min(ZOOM_MAX, Number((s + ZOOM_PASO).toFixed(2))))}
          className="cursor-pointer rounded-sm border-none bg-transparent p-xs text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
        >
          <InlineIcon size={16}>{iconMas}</InlineIcon>
        </button>
      </div>
      {numPaginas > 1 && (
        <div className="flex items-center justify-center gap-sm">
          <Button variant="secondary" size="sm" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
            Anterior
          </Button>
          <span className="font-body text-xs text-muted">
            página {pagina} de {numPaginas}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pagina >= numPaginas}
            onClick={() => setPagina((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}
