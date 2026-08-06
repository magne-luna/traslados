import { useEffect, useRef, useState } from 'react';
import { Chip, chipColors, InlineIcon, Overlay, ProgressBar } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { iconDocumento, iconOjo, iconTacho } from '../../design-system/icons';
import type { ChecklistItem, DocumentoAdjunto } from '../types/documento';

interface DocumentChecklistProps {
  items: ChecklistItem[];
  documentos: DocumentoAdjunto[];
  onUpload: (itemId: string, file: File) => void;
  /** pacientes-documentos-multiples (design.md D1): apunta al documento puntual por su `id`, no
   * al `itemId` — con colección, "quitar el documento de este ítem" deja de tener sentido. */
  onRemove: (documentoId: string) => void;
  /** Vista previa de solo lectura (ChecklistEditor de obras-sociales-ui): deshabilita Subir/
   * Agregar otro/Quitar en vez de dispararlos con handlers noop, para no abrir el selector de
   * archivos del SO sin que la selección vaya a ningún lado. */
  readOnly?: boolean;
  /** documentos-previsualizacion (design.md D2/D3, tasks.md 5.1): resuelve una URL efímera para
   * mostrar el documento en la ventana "Ver". Prop opcional a propósito — mientras los 6 puntos
   * de montaje (tasks.md §6, fuera de alcance de esta pasada) no la pasen, la acción "Ver" no se
   * renderiza en vez de mostrar un botón sin capacidad real detrás. */
  onResolverPrevisualizacion?: (documentoId: string) => Promise<string | null>;
  /** documentos-previsualizacion (tasks.md 5.3/5.7, useDocumentChecklist.ts): revoca la URL
   * efímera que devolvió `onResolverPrevisualizacion` (p. ej. `URL.revokeObjectURL`) al cerrar la
   * ventana o al desmontar `DocumentChecklist` con la ventana todavía abierta. El hook no la
   * revoca solo — es este componente el que sabe cuándo terminó de usarla (D3). */
  onRevocarPrevisualizacion?: (url: string) => void;
}

// documentos-previsualizacion (tasks.md 5.3, design.md D3): el documento que se está mostrando
// en el overlay ahora mismo, junto con el nombre del ítem (para el título del overlay y el
// aria-label ya usado por "Ver"/"Quitar"). `null` = overlay cerrado.
interface DocumentoEnVista {
  documento: DocumentoAdjunto;
  itemNombre: string;
}

// documentos-previsualizacion (tasks.md 5.4/5.5, design.md D5/Checkpoint (e)): los cuatro
// desenlaces posibles de resolver el contenido de un documento. `sin-contenido` es el `null` del
// contrato D2 (documento sin binario resoluble, caso normal para documentos previos a este
// change) — distinto de `error` (403/404/expirado: un fallo real, no "no hay nada que ver").
type EstadoPrevisualizacion =
  | { status: 'cargando' }
  | { status: 'lista'; url: string }
  | { status: 'sin-contenido' }
  | { status: 'error' };

// pacientes-documentos-multiples (design.md Checkpoint (b) / D2): "vigente" se deriva como el
// documento con `vigenciaDesde` más reciente que no sea futuro (fallback a `subidoEn` si no se
// cargó `vigenciaDesde`) — lógica de presentación, no se persiste como flag aparte para no tener
// dos fuentes de verdad.
function fechaEfectiva(doc: DocumentoAdjunto): string {
  return doc.vigenciaDesde ?? doc.subidoEn;
}

function esFechaFutura(fecha: string, ahora: Date): boolean {
  const parsed = new Date(fecha);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > ahora.getTime();
}

function elegirVigente(docs: DocumentoAdjunto[]): DocumentoAdjunto | undefined {
  if (docs.length === 0) return undefined;
  const ahora = new Date();
  const noFuturos = docs.filter((doc) => !esFechaFutura(fechaEfectiva(doc), ahora));
  const candidatos = noFuturos.length > 0 ? noFuturos : docs;
  return [...candidatos].sort((a, b) => fechaEfectiva(b).localeCompare(fechaEfectiva(a)))[0];
}

// El vigente va primero; el resto se muestra como historial/continuidad, ordenado por la misma
// fecha (más reciente primero).
function ordenarParaMostrar(docs: DocumentoAdjunto[], vigente: DocumentoAdjunto | undefined): DocumentoAdjunto[] {
  if (!vigente) return docs;
  const resto = docs.filter((doc) => doc.id !== vigente.id).sort((a, b) => fechaEfectiva(b).localeCompare(fechaEfectiva(a)));
  return [vigente, ...resto];
}

// documentos-previsualizacion (tasks.md 5.4, design.md Checkpoint (e)): decide qué elemento
// renderizar según `tipoMime` y el desenlace de `resolverPrevisualizacion`. `<iframe>` va SIEMPRE
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
function ContenidoPreview({ estado, documento }: { estado: EstadoPrevisualizacion; documento: DocumentoAdjunto }) {
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

  if (documento.tipoMime?.startsWith('image/')) {
    return (
      <img
        src={estado.url}
        alt={documento.nombreArchivo}
        className="max-h-[70vh] w-full rounded-sm object-contain"
      />
    );
  }

  if (documento.tipoMime === 'application/pdf') {
    return (
      <iframe
        src={estado.url}
        title={documento.nombreArchivo}
        sandbox="allow-same-origin"
        className="h-[70vh] w-full rounded-sm border border-border"
      />
    );
  }

  return (
    <Alert tone="secondary">
      Este tipo de archivo no se puede previsualizar acá. Nombre: {documento.nombreArchivo}
    </Alert>
  );
}

// Componente reutilizable de checklist documental (RF-900 a RF-902). Un solo componente para
// Pacientes, Vehículos, Conductores y Facturas — lo único que cambia entre pantallas es la lista
// de `items` (el checklist configurado por obra social, RF-305) y la entidad que se le pasa al
// hook useDocumentChecklist. Resumen de progreso (X de Y cargados, % + pendientes) arriba de la
// lista; cada fila con ícono de estado, nombre + requerido/opcional, y Subir/Reemplazar/Quitar.
export function DocumentChecklist({
  items,
  documentos,
  onUpload,
  onRemove,
  readOnly = false,
  onResolverPrevisualizacion,
  onRevocarPrevisualizacion,
}: DocumentChecklistProps) {
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  // documentos-previsualizacion (tasks.md 5.3, design.md D3): estado de "qué documento estoy
  // viendo" vive acá, igual que el useRef de los file inputs — no en los wrappers.
  const [enVista, setEnVista] = useState<DocumentoEnVista | null>(null);
  const [estadoPreview, setEstadoPreview] = useState<EstadoPrevisualizacion>({ status: 'cargando' });
  // Descarta resoluciones obsoletas (se cerró la ventana o se abrió otro documento antes de que
  // la promesa anterior resolviera) y guarda la URL abierta para poder revocarla al cerrar o
  // desmontar sin depender de que `estadoPreview` esté actualizado en el cleanup.
  const vistaIdRef = useRef<string | null>(null);
  const urlAbiertaRef = useRef<string | null>(null);

  function abrirPreview(documento: DocumentoAdjunto, itemNombre: string) {
    if (!onResolverPrevisualizacion) return;
    vistaIdRef.current = documento.id;
    setEnVista({ documento, itemNombre });
    setEstadoPreview({ status: 'cargando' });
    onResolverPrevisualizacion(documento.id)
      .then((url) => {
        if (vistaIdRef.current !== documento.id) return;
        if (url === null) {
          setEstadoPreview({ status: 'sin-contenido' });
        } else {
          urlAbiertaRef.current = url;
          setEstadoPreview({ status: 'lista', url });
        }
      })
      .catch(() => {
        if (vistaIdRef.current !== documento.id) return;
        setEstadoPreview({ status: 'error' });
      });
  }

  function cerrarPreview() {
    vistaIdRef.current = null;
    if (urlAbiertaRef.current) {
      onRevocarPrevisualizacion?.(urlAbiertaRef.current);
      urlAbiertaRef.current = null;
    }
    setEnVista(null);
  }

  // documentos-previsualizacion (tasks.md 5.3/5.7): si el componente se desmonta con la ventana
  // todavía abierta (navegación fuera de la pantalla, no un cierre explícito), la URL igual se
  // revoca — el hook (useDocumentChecklist.ts) documenta esta responsabilidad como de
  // DocumentChecklist, no suya.
  useEffect(() => {
    return () => {
      if (urlAbiertaRef.current) {
        onRevocarPrevisualizacion?.(urlAbiertaRef.current);
        urlAbiertaRef.current = null;
      }
    };
  }, [onRevocarPrevisualizacion]);

  const cargados = items.filter((item) => documentos.some((doc) => doc.itemId === item.id)).length;
  const pendientes = items.length - cargados;
  const pctCargado = items.length === 0 ? 0 : (cargados / items.length) * 100;
  // A partir de 6 ítems, dos columnas para aprovechar el ancho disponible en vez de una lista
  // angosta y muy larga.
  const dosColumnas = items.length > 5;

  return (
    <div className="flex flex-col gap-md">
      {items.length > 0 && (
        <div className="flex flex-col gap-xs rounded-md border border-border bg-surface p-lg">
          <div className="flex flex-wrap items-center justify-between gap-sm font-body text-[13px] text-text">
            <span>
              {cargados} de {items.length} documentos cargados ·{' '}
              <span className="font-semibold text-success">{Math.round(pctCargado)}%</span>
            </span>
            {pendientes > 0 && (
              <Chip kind="warning">
                {pendientes} pendiente{pendientes === 1 ? '' : 's'}
              </Chip>
            )}
          </div>
          <ProgressBar pct={pctCargado} kind="success" />
        </div>
      )}

      <div className={dosColumnas ? 'grid grid-cols-1 gap-sm sm:grid-cols-2' : 'flex flex-col gap-sm'}>
      {items.map((item) => {
        // pacientes-documentos-multiples: un ítem admite 0, 1 o N documentos — `.filter()` en vez
        // de `.find()`, "cargado" sigue siendo "al menos un documento" (tasks.md 4.5).
        const docsItem = documentos.filter((d) => d.itemId === item.id);
        const cargado = docsItem.length > 0;
        const estadoKind = cargado ? 'success' : item.requerido ? 'warning' : 'secondary';
        const vigente = elegirVigente(docsItem);
        const docsOrdenados = ordenarParaMostrar(docsItem, vigente);

        return (
          <div
            key={item.id}
            className={`flex flex-col gap-sm rounded-md border border-border ${chipColors[estadoKind].borderLeft} border-l-4 bg-surface px-md py-sm`}
          >
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <div className="flex items-center gap-sm">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill ${chipColors[estadoKind].bg} ${chipColors[estadoKind].fg}`}>
                  <InlineIcon>{iconDocumento}</InlineIcon>
                </span>

                <div className="flex flex-col">
                  <span className="font-body text-[13px] font-semibold text-ink">{item.nombre}</span>
                  {!cargado && (
                    <span className="font-body text-[11px] text-muted">{item.requerido ? 'Requerido' : 'Opcional'}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-sm">
                {cargado ? (
                  <Chip kind="success">Cargado</Chip>
                ) : (
                  <Chip kind={item.requerido ? 'warning' : 'secondary'}>{item.requerido ? 'Falta' : 'Sin cargar'}</Chip>
                )}
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => fileInputs.current[item.id]?.click()}
                  className="cursor-pointer rounded-sm border border-border-strong bg-surface px-md py-xs font-body text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {cargado ? 'Agregar otro' : 'Subir'}
                </button>
              </div>
            </div>

            {docsOrdenados.length > 0 && (
              <div className="flex flex-col gap-xs pl-11">
                {docsOrdenados.map((doc) => (
                  <div key={doc.id} className="flex flex-wrap items-center justify-between gap-sm">
                    <span className="font-body text-[11px] text-muted">
                      {doc.nombreArchivo} · {new Date(doc.subidoEn).toLocaleDateString('es-AR')}
                      {vigente?.id === doc.id && (
                        <span className="ml-xs inline-block align-middle">
                          <Chip kind="info">Vigente</Chip>
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-sm">
                      {onResolverPrevisualizacion && (
                        // documentos-previsualizacion (tasks.md 5.6, design.md Checkpoint (c)):
                        // "Ver" NUNCA se deshabilita con `readOnly` a propósito — `readOnly` gatea
                        // ESCRITURA (Subir/Agregar otro/Quitar), y el principio ya escrito en los
                        // wrappers de dominio dice que el gateo de cliente nunca debe ser más
                        // restrictivo que la RLS del servidor: quien tiene permiso de lectura del
                        // módulo puede previsualizar, aunque no pueda cargar ni quitar.
                        <button
                          type="button"
                          aria-label={`Ver ${item.nombre} - ${doc.nombreArchivo}`}
                          onClick={() => abrirPreview(doc, item.nombre)}
                          className="cursor-pointer border-none bg-transparent p-0 text-primary"
                        >
                          <InlineIcon>{iconOjo}</InlineIcon>
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Quitar ${item.nombre} - ${doc.nombreArchivo}`}
                        disabled={readOnly}
                        onClick={() => onRemove(doc.id)}
                        className="cursor-pointer border-none bg-transparent p-0 text-danger disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <InlineIcon>{iconTacho}</InlineIcon>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={(el) => {
                fileInputs.current[item.id] = el;
              }}
              type="file"
              accept="image/*,.pdf"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUpload(item.id, file);
                event.target.value = '';
              }}
            />
          </div>
        );
      })}
      </div>

      <Overlay
        open={enVista !== null}
        onClose={cerrarPreview}
        title={enVista ? `${enVista.itemNombre} - ${enVista.documento.nombreArchivo}` : ''}
      >
        {enVista && <ContenidoPreview estado={estadoPreview} documento={enVista.documento} />}
      </Overlay>
    </div>
  );
}
