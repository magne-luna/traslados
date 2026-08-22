import { useEffect, useRef, useState } from 'react';
import { Chip, chipColors, InlineIcon, Overlay, ProgressBar, RingProgress } from '../../design-system/components';
import { iconCheck, iconDocumento } from '../../design-system/icons';
import type { ChecklistItem, DocumentoAdjunto } from '../types/documento';
import { elegirVigente, fechaEfectiva } from '../lib/documentos/vigencia';
import { VistaPreviaArchivo, type EstadoPrevisualizacion } from './VistaPreviaArchivo';

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
  /** documentos-transferencia-actividad (design.md Checkpoint (c) VEREDICTO opción A, tasks.md
   * 6.1): reasigna un documento ya cargado a otra agrupación (o a "General") sin volver a
   * subirlo. Prop opcional a propósito — mismo mecanismo opt-in que `mostrarProgreso`: mientras
   * Vehículos/Conductores/Facturas no la pasen, "Transferir" no se renderiza en vez de mostrar un
   * botón sin capacidad real detrás. Solo Pacientes la habilita
   * (`PacienteDocumentosChecklist.tsx`) — los otros 3 dominios no tienen agrupaciones. */
  onTransferir?: (documentoId: string) => void;
  /** documentos-checklist-por-actividad (feedback directo de la usuaria, 2026-08-07): con N
   * instancias montadas (Pacientes, una por actividad), la barra "X de Y cargados" propia de CADA
   * instancia dejó de tener sentido — ya existe un total agregado en `PacienteDocumentos.tsx`
   * (design.md Checkpoint (f)), y mostrar además N barras individuales (una por bloque, incluida
   * "General") es ruido repetido, no información nueva. Opcional con default `true` a propósito:
   * Vehículos/Conductores/Facturas tienen un único checklist por entidad, ahí la barra sigue
   * siendo la única fuente de progreso y no se les pasa este prop — cero cambio de comportamiento
   * para esos tres dominios. */
  mostrarProgreso?: boolean;
  /** checklist-documental-progreso-visual (skill `prototype`, variante "Progreso visual" elegida
   * 2026-08-10): `'ring'` cambia solo el marcador visual de estado de cada ítem — un círculo con
   * check en vez del ícono de documento + Chip — nunca el contrato funcional (Subir/Agregar otro/
   * Quitar, readOnly, Ver, colección de N documentos siguen idénticos, ver DocumentChecklist.test.tsx).
   * Default `'default'` a propósito: Vehículos/Conductores/Facturas no pidieron este look, solo
   * Pacientes lo pasa (PacienteDocumentosChecklist.tsx) — cero cambio visual para los otros tres
   * dominios. */
  variant?: 'default' | 'ring';
}

// checklist-documental-progreso-visual: círculo de estado del variant "ring" — lleno con check si
// está cargado, contorno de advertencia con "!" si falta un requerido, contorno tenue con "–" si
// es opcional sin cargar. `data-testid` es solo para test (no afecta el árbol de accesibilidad);
// el ícono es `aria-hidden` porque el texto de estado que lo acompaña (Cargado/Falta/Sin cargar,
// sin cambios) ya lo anuncia — duplicarlo en un aria-label sería ruido para el lector de pantalla.
function EstadoBadge({ cargado, requerido }: { cargado: boolean; requerido: boolean }) {
  if (cargado) {
    return (
      <span
        data-testid="ring-item-badge"
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-success text-white"
      >
        <InlineIcon size={13}>{iconCheck}</InlineIcon>
      </span>
    );
  }
  if (requerido) {
    return (
      <span
        data-testid="ring-item-badge"
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border-2 border-warning font-body text-[10px] font-bold text-warning"
      >
        !
      </span>
    );
  }
  return (
    <span
      data-testid="ring-item-badge"
      aria-hidden="true"
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-pill border-2 border-border-strong font-body text-[10px] font-bold text-faint"
    >
      –
    </span>
  );
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
// `presupuestos-vigencia-datos-traslado-vista-previa` (tasks.md 7.6, design.md D6a): el tipo se
// mudó a `VistaPreviaArchivo.tsx` (reexportado acá) para que ambos consumidores compartan la misma
// forma de estado, sin duplicarla.

// documentos-transferencia-actividad (tasks.md §14): `fechaEfectiva`/`elegirVigente` se movieron a
// `shared/lib/documentos/vigencia.ts` — exportarlas directamente desde este archivo (en su momento
// para que `DocumentacionActividadImprimible.tsx`, el resumen imprimible, las reusara) disparaba
// la advertencia de oxlint `react(only-export-components)` (un archivo de componente que además
// exporta funciones sueltas rompe Fast Refresh). Mudanza tal cual, sin cambiar la lógica. El
// resumen imprimible se REVIRTIÓ por completo el 2026-08-11, pero este archivo se quedó movido —
// `vigencia.ts` sigue siendo la fuente para este componente, sin relación con lo revertido.

// El vigente va primero; el resto se muestra como historial/continuidad, ordenado por la misma
// fecha (más reciente primero).
function ordenarParaMostrar(docs: DocumentoAdjunto[], vigente: DocumentoAdjunto | undefined): DocumentoAdjunto[] {
  if (!vigente) return docs;
  const resto = docs.filter((doc) => doc.id !== vigente.id).sort((a, b) => fechaEfectiva(b).localeCompare(fechaEfectiva(a)));
  return [vigente, ...resto];
}

// documentos-previsualizacion (tasks.md 5.4, design.md Checkpoint (e)) — `presupuestos-vigencia-
// datos-traslado-vista-previa` (tasks.md 7.6): el render de contenido (imagen/PDF/tipo no
// soportado/error/sin-contenido) se extrajo a `VistaPreviaArchivo.tsx`, con sus comentarios de
// pdf.js/sandbox/`min-w-0` conservados ahí — no reimplementar, no duplicar acá.

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
  onTransferir,
  mostrarProgreso = true,
  variant = 'default',
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

  // documentos-transferencia-actividad (design.md Checkpoint (e), VEREDICTO revisado 2026-08-11:
  // opción B implementada antes de archivar en vez de quedar como forma futura): documentos cuyo
  // `itemId` no matchea NINGÚN `item.id` de la lista vigente. Guardia GENÉRICA del componente
  // compartido, no específica de Pacientes ni de transferencia — sin esto, el `items.map()` de
  // abajo simplemente nunca itera sobre ellos y el documento desaparece de la vista sin ningún
  // error, aunque siga intacto en la base. Protege contra cualquier drift futuro entre el
  // `itemId` de un documento y la lista de `items` vigente: un ítem borrado del checklist de una
  // obra social con documentos ya cargados contra él, o —cuando
  // `documentos-checklist-items-por-actividad` cablee `combinarItemsDeActividad()`— un documento
  // transferido (`onTransferir`, más abajo) a una actividad cuyo checklist combinado no lo
  // incluye. No cuenta para `cargados`/`pendientes` de arriba: el progreso sigue siendo por ítem
  // vigente, esto es una vía de visibilidad, no una redefinición del progreso.
  const huerfanos = documentos.filter((doc) => !items.some((item) => item.id === doc.itemId));
  const huerfanoItemIds = Array.from(new Set(huerfanos.map((doc) => doc.itemId)));
  const vigentePorHuerfano = new Map<string, boolean>();
  const huerfanosOrdenados: DocumentoAdjunto[] = huerfanoItemIds.flatMap((itemId) => {
    const docsGrupo = huerfanos.filter((doc) => doc.itemId === itemId);
    const vigenteGrupo = elegirVigente(docsGrupo);
    const ordenados = ordenarParaMostrar(docsGrupo, vigenteGrupo);
    ordenados.forEach((doc) => vigentePorHuerfano.set(doc.id, vigenteGrupo?.id === doc.id));
    return ordenados;
  });

  // Fila de un documento puntual (nombre + fecha + "Vigente" + Ver/Transferir/Quitar). Extraída
  // para reusarse tal cual tanto dentro de cada tarjeta de ítem (abajo) como en la sección "Otros
  // documentos" de huérfanos — mismo markup, sin duplicar el patrón visual existente.
  function renderDocumentoRow(doc: DocumentoAdjunto, itemNombre: string, esVigente: boolean) {
    return (
      // documentos-previsualizacion (feedback de layout, 2026-08-06 — "más intuitivo si aprieto
      // la fila" / "Quitar afuera del hover" / "Ver adentro de la caja con fondo, a la derecha"):
      // la caja con `hover:bg-surface-soft` + click-para-abrir (mismo patrón que las Card
      // clickeables de PacientesList.tsx: `onClick` directo, sin role="button"/tabIndex,
      // mouse-only por diseño) ocupa todo el ancho disponible y usa `justify-between` PARA SÍ
      // MISMA — nombre/Vigente a la izquierda, "Ver" a la derecha DENTRO de esa misma caja
      // (oculto por opacidad, `group-hover` lo revela). "Quitar" queda afuera de la caja, como
      // hermano, sin fondo ni click-to-abrir — la naturaleza de esa acción es distinta (destruir,
      // no ver).
      <div key={doc.id} className="group flex flex-wrap items-center justify-between gap-sm">
        <div
          onClick={onResolverPrevisualizacion ? () => abrirPreview(doc, itemNombre) : undefined}
          className={`flex flex-1 items-center justify-between gap-sm rounded-sm px-3 py-1.5 ${
            onResolverPrevisualizacion ? 'cursor-pointer transition-colors hover:bg-surface-soft' : ''
          }`}
        >
          <span className="font-body text-[11px] text-muted">
            {doc.nombreArchivo} · {new Date(doc.subidoEn).toLocaleDateString('es-AR')}
            {esVigente && (
              // documentos-previsualizacion (feedback "Vigente como texto, sin pill",
              // 2026-08-06): mismo color que tenía el Chip (`chipColors.info.fg`, text-info)
              // pero sin fondo/borde — solo texto.
              <span className={`ml-xs font-body text-[11px] font-semibold ${chipColors.info.fg}`}>
                Vigente
              </span>
            )}
          </span>
          {onResolverPrevisualizacion && (
            // documentos-previsualizacion (tasks.md 5.6, design.md Checkpoint (c)): "Ver" NUNCA
            // se deshabilita con `readOnly` a propósito — `readOnly` gatea ESCRITURA (Subir/
            // Agregar otro/Quitar), y el principio ya escrito en los wrappers de dominio dice
            // que el gateo de cliente nunca debe ser más restrictivo que la RLS del servidor:
            // quien tiene permiso de lectura del módulo puede previsualizar, aunque no pueda
            // cargar ni quitar. Mismo criterio para huérfanos (Checkpoint (e)): siguen siendo
            // documentación real del paciente, solo cambió a qué ítem apuntan.
            <button
              type="button"
              aria-label={`Ver ${itemNombre} - ${doc.nombreArchivo}`}
              onClick={(e) => {
                e.stopPropagation();
                abrirPreview(doc, itemNombre);
              }}
              className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary underline-offset-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:underline"
            >
              Ver
            </button>
          )}
        </div>
        <div className="flex items-center gap-sm">
          {onTransferir && (
            // documentos-transferencia-actividad (tasks.md 6.1, Checkpoint (g)): exige el mismo
            // `readOnly` que "Quitar" — transferir es una escritura. Nunca dispara la
            // previsualización (stopPropagation, mismo criterio que "Quitar"). Un huérfano
            // (Checkpoint (e)) también puede transferirse — es justamente la vía de escape para
            // corregirlo: moverlo a una actividad cuya lista sí lo contenga, o a "General".
            <button
              type="button"
              aria-label={`Transferir ${itemNombre} - ${doc.nombreArchivo}`}
              disabled={readOnly}
              onClick={(e) => {
                e.stopPropagation();
                onTransferir(doc.id);
              }}
              className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
            >
              Transferir
            </button>
          )}
          <button
            type="button"
            aria-label={`Quitar ${itemNombre} - ${doc.nombreArchivo}`}
            disabled={readOnly}
            onClick={() => onRemove(doc.id)}
            className="cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-danger underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
          >
            Quitar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md">
      {mostrarProgreso && items.length > 0 && (variant === 'ring' ? (
        <div
          data-testid="ring-progreso-header"
          className="flex items-center gap-lg rounded-md border border-border bg-surface p-lg"
        >
          <RingProgress pct={pctCargado} kind="success" size="lg">
            <span className="font-heading text-[17px] font-bold text-ink">{Math.round(pctCargado)}%</span>
          </RingProgress>
          <div className="flex flex-1 flex-wrap items-center justify-between gap-sm font-body text-[13px] text-text">
            <span>
              {cargados} de {items.length} documentos cargados
            </span>
            {pendientes > 0 && (
              <Chip kind="warning">
                {pendientes} pendiente{pendientes === 1 ? '' : 's'}
              </Chip>
            )}
          </div>
        </div>
      ) : (
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
      ))}

      <div className={dosColumnas ? 'grid grid-cols-1 gap-sm sm:grid-cols-2' : 'flex flex-col gap-sm'}>
      {items.map((item) => {
        // pacientes-documentos-multiples: un ítem admite 0, 1 o N documentos — `.filter()` en vez
        // de `.find()`, "cargado" sigue siendo "al menos un documento" (tasks.md 4.5).
        const docsItem = documentos.filter((d) => d.itemId === item.id);
        const cargado = docsItem.length > 0;
        const estadoKind = cargado ? 'success' : item.requerido ? 'warning' : 'secondary';
        const vigente = elegirVigente(docsItem);
        const docsOrdenados = ordenarParaMostrar(docsItem, vigente);

        const esRing = variant === 'ring';

        return (
          <div
            key={item.id}
            className={
              esRing
                ? 'flex flex-col gap-sm rounded-md bg-surface-soft px-lg py-md'
                : `flex flex-col gap-sm rounded-md border border-border ${chipColors[estadoKind].borderLeft} border-l-4 bg-surface px-md py-sm`
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-sm">
              <div className="flex items-center gap-sm">
                {esRing ? (
                  <EstadoBadge cargado={cargado} requerido={item.requerido} />
                ) : (
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-pill ${chipColors[estadoKind].bg} ${chipColors[estadoKind].fg}`}>
                    <InlineIcon>{iconDocumento}</InlineIcon>
                  </span>
                )}

                <div className="flex flex-col">
                  <span className="font-body text-[13px] font-semibold text-ink">{item.nombre}</span>
                  {!cargado && (
                    <span className="font-body text-[11px] text-muted">{item.requerido ? 'Requerido' : 'Opcional'}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-sm">
                {esRing ? (
                  <span className="font-body text-[12px] text-muted">
                    {cargado ? 'Cargado' : item.requerido ? 'Falta' : 'Sin cargar'}
                  </span>
                ) : cargado ? (
                  <Chip kind="success">Cargado</Chip>
                ) : (
                  <Chip kind={item.requerido ? 'warning' : 'secondary'}>{item.requerido ? 'Falta' : 'Sin cargar'}</Chip>
                )}
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => fileInputs.current[item.id]?.click()}
                  className={
                    esRing
                      ? // pacientes-checklist-simplificacion (2026-08-11, feedback directo: "no quiero
                        // que sea botón"): mismo tratamiento de link de texto plano que ya usan Ver/
                        // Transferir/Quitar en `renderDocumentoRow` de este archivo — sin caja ni
                        // borde, solo texto subrayado al hover. Solo el variant `ring` (Pacientes);
                        // el variant `default` (Vehículos/Conductores/Facturación) no pidió este
                        // cambio y sigue con su botón de siempre.
                        'cursor-pointer border-none bg-transparent p-0 font-body text-xs font-semibold text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40'
                      : 'cursor-pointer rounded-sm border border-border-strong bg-surface px-md py-xs font-body text-xs font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40'
                  }
                >
                  {cargado ? 'Agregar otro' : 'Subir'}
                </button>
              </div>
            </div>

            {docsOrdenados.length > 0 && (
              <div className={esRing ? 'flex flex-col gap-xs pl-9' : 'flex flex-col gap-xs pl-11'}>
                {docsOrdenados.map((doc) => renderDocumentoRow(doc, item.nombre, vigente?.id === doc.id))}
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

      {huerfanosOrdenados.length > 0 && (
        // documentos-transferencia-actividad (Checkpoint (e), 2026-08-11): sección aparte para
        // documentos cuyo `itemId` ya no corresponde a ningún ítem de esta lista — nunca se
        // ocultan, quedan visibles y corregibles acá. Solo se muestra si hay al menos un
        // huérfano; nunca "0 documentos" fantasma.
        <div className="flex flex-col gap-sm rounded-md border border-dashed border-border-strong bg-surface px-md py-sm">
          <div className="flex items-center gap-sm">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-surface-soft text-muted">
              <InlineIcon>{iconDocumento}</InlineIcon>
            </span>
            <div className="flex flex-col">
              <span className="font-body text-[13px] font-semibold text-ink">Otros documentos</span>
              <span className="font-body text-[11px] text-muted">
                Documentos cargados cuyo ítem ya no forma parte de este checklist. Podés verlos, descargarlos o
                transferirlos para corregirlos.
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-xs pl-11">
            {huerfanosOrdenados.map((doc) => renderDocumentoRow(doc, 'Otros documentos', vigentePorHuerfano.get(doc.id) ?? false))}
          </div>
        </div>
      )}

      <Overlay
        open={enVista !== null}
        onClose={cerrarPreview}
        title={enVista ? `${enVista.itemNombre} - ${enVista.documento.nombreArchivo}` : ''}
      >
        {enVista && (
          <VistaPreviaArchivo
            estado={estadoPreview}
            nombreArchivo={enVista.documento.nombreArchivo}
            tipoMime={enVista.documento.tipoMime}
          />
        )}
      </Overlay>
    </div>
  );
}
