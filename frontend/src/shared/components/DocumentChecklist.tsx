import { useRef } from 'react';
import { Chip, chipColors, InlineIcon, ProgressBar } from '../../design-system/components';
import { iconDocumento, iconTacho } from '../../design-system/icons';
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
}

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

// Componente reutilizable de checklist documental (RF-900 a RF-902). Un solo componente para
// Pacientes, Vehículos, Conductores y Facturas — lo único que cambia entre pantallas es la lista
// de `items` (el checklist configurado por obra social, RF-305) y la entidad que se le pasa al
// hook useDocumentChecklist. Resumen de progreso (X de Y cargados, % + pendientes) arriba de la
// lista; cada fila con ícono de estado, nombre + requerido/opcional, y Subir/Reemplazar/Quitar.
export function DocumentChecklist({ items, documentos, onUpload, onRemove, readOnly = false }: DocumentChecklistProps) {
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

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
    </div>
  );
}
