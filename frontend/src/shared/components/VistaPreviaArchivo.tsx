import { buttonClassName } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { PdfPreview } from './PdfPreview';

// Componente extraído de `DocumentChecklist.tsx` (`ContenidoPreview`, privado) por
// `presupuestos-vigencia-datos-traslado-vista-previa` (tasks.md 7.6, design.md D6a, spec
// `autorizacion-archivo-vista-previa`) para que la vista previa de Autorizaciones lo reuse sin
// reimplementar sus lecciones ya pagadas. **Refactor sin cambio de comportamiento** (tasks.md
// 7.6/7.7): `DocumentChecklist` sigue pasando exactamente por los mismos 5 desenlaces, cubiertos
// por su propia batería de tests (`DocumentChecklist.test.tsx`), sin que ese archivo tenga que
// conocer esta mudanza.
//
// Generalización de props (D6a): donde `ContenidoPreview` recibía `documento: DocumentoAdjunto`
// (tipo propio del dominio de checklists multi-documento), este componente recibe solo los tres
// campos que en verdad usa — `nombreArchivo`/`tipoMime`, primitivos — para poder servir también a
// `Autorizacion.archivo` (`ArchivoAdjunto`, un tipo DISTINTO, ver presupuesto.ts). `estado` sigue
// siendo el mismo estado de máquina (`EstadoPrevisualizacion`, exportado acá) que ya traía la
// `url` en la rama `'lista'` — no hacía falta separarla en un prop propio.
export type EstadoPrevisualizacion =
  | { status: 'cargando' }
  | { status: 'lista'; url: string }
  | { status: 'sin-contenido' }
  | { status: 'error' };

interface VistaPreviaArchivoProps {
  estado: EstadoPrevisualizacion;
  nombreArchivo: string;
  tipoMime?: string;
}

// documentos-previsualizacion (tasks.md 5.4, design.md Checkpoint (e)): decide qué elemento
// renderizar según `tipoMime` y el desenlace de resolver la vista previa. `<iframe>` va SIEMPRE
// sandboxeado, sin `allow-scripts` — un PDF/SVG subido por un usuario nunca puede ejecutar script
// en el origen de la app, en mock o contra una URL firmada real el día de mañana. No es opcional.
//
// **Corrección (2026-08-06, hallada en §8.2 de tasks.md, verificación manual)**: `sandbox=""`
// (sin `allow-same-origin`) deja al iframe con origen opaco, y los navegadores bloquean cargar
// `blob:` ahí — el `ObjectURL` del mock nunca resolvía, mostraba el ícono roto de "no se pudo
// cargar" del navegador. Se agrega `allow-same-origin` para permitir esa carga. Sigue siendo
// seguro: el escape de sandbox conocido necesita `allow-scripts` + `allow-same-origin` juntos —
// con `allow-same-origin` solo, sin `allow-scripts`, nada puede ejecutar código aunque el iframe
// tenga identidad de origen. Contra una URL firmada real (https, no blob) esta restricción no
// aplicaría de todos modos, pero se deja igual por consistencia entre mock y real.
//
// **Corrección (2026-08-06, verificación manual en dos navegadores — Arc y otro Chromium)**: el
// `<iframe>` de arriba se REEMPLAZA por completo para PDF. Con `sandbox="allow-same-origin"` la
// `blob:` sí cargaba (fix anterior), pero el visor nativo de PDF del navegador se niega a correr
// dentro de CUALQUIER iframe sandboxeado, sin importar la combinación de tokens — confirmado
// sacando el `sandbox` por completo como diagnóstico (ya revertido): sin sandbox el PDF cargaba
// perfecto, con cualquier sandbox no. No existe una combinación de `sandbox` que sea segura y
// funcional a la vez: el visor nativo necesitaría `allow-scripts` + `allow-same-origin` juntos
// (el escape de sandbox conocido) para poder correr, y eso es exactamente lo que no se puede
// conceder a contenido subido por un usuario. Se agrega `pdfjs-dist` como dependencia nueva
// (decisión explícita del usuario, ver `design.md` Checkpoint (e) y `tasks.md`) y se renderiza el
// PDF a un `<canvas>` con `PdfPreview` (`./PdfPreview.tsx`) en vez de con el visor nativo: pdf.js
// parsea el archivo y dibuja gráficos/texto vía la API de canvas, no ejecuta nada del contenido
// del PDF como si fuera HTML/script de la página — sin iframe, sin plugin del navegador, sin
// browsing context separado, por lo tanto sin necesidad de `sandbox` en absoluto para este caso.
export function VistaPreviaArchivo({ estado, nombreArchivo, tipoMime }: VistaPreviaArchivoProps) {
  if (estado.status === 'cargando') {
    return <p className="font-body text-sm text-muted">Cargando previsualización…</p>;
  }

  // tasks.md 5.5 / design.md D5: mensaje comprensible, nunca el mensaje crudo del error real
  // (403/404/expirado) — mismo requisito duro que el resto de la serie de integración.
  if (estado.status === 'error') {
    return <Alert tone="danger">No se pudo cargar la previsualización. Probá de nuevo en un momento.</Alert>;
  }

  if (estado.status === 'sin-contenido') {
    return <Alert tone="secondary">Este documento no tiene contenido para previsualizar.</Alert>;
  }

  // A partir de acá `estado.status === 'lista'`: hay una url válida (mock: ObjectURL; real
  // mañana: URL firmada), así que "Descargar" siempre tiene sentido — incluida la rama de tipo no
  // soportado más abajo, que es justo el caso donde más falta hace (no hay preview inline al que
  // recurrir). `download={nombreArchivo}` conserva el nombre original, no el id interno ni el
  // nombre que el navegador le pondría a una blob: URL por defecto.
  let contenido;
  if (tipoMime?.startsWith('image/')) {
    contenido = (
      <img
        src={estado.url}
        alt={nombreArchivo}
        className="max-h-[70vh] w-full rounded-sm object-contain"
      />
    );
  } else if (tipoMime === 'application/pdf') {
    contenido = <PdfPreview url={estado.url} nombreArchivo={nombreArchivo} />;
  } else {
    contenido = (
      <Alert tone="secondary">
        Este tipo de archivo no se puede previsualizar acá. Nombre: {nombreArchivo}
      </Alert>
    );
  }

  return (
    // min-w-0 (fix "el zoom agranda toda la tarjeta", 2026-08-06): propaga la posibilidad de
    // achicarse a través de toda la cadena de flex items entre el <canvas> de PdfPreview y el
    // `max-w-[640px]` del diálogo de Overlay — sin esto en cada nivel, un flex item no se achica
    // por debajo del ancho de su contenido, sea cual sea el `overflow-auto` que tenga adentro.
    <div className="flex w-full min-w-0 flex-col gap-sm">
      <div className="flex w-full min-w-0 flex-col items-center gap-sm">{contenido}</div>
      {/* documentos-previsualizacion (feedback de ubicación, 2026-08-06): "Descargar" va abajo,
          alineado a la derecha — separado de los controles de zoom/paginación de PdfPreview
          (que quedan centrados arriba de esta fila), no mezclado en la misma torre de botones. */}
      <div className="flex w-full justify-end">
        <a href={estado.url} download={nombreArchivo} className={buttonClassName('secondary', 'sm')}>
          Descargar
        </a>
      </div>
    </div>
  );
}
