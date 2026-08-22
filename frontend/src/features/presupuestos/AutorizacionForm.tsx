import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AvisoModeloDatos, Button, CamposSoloLectura, InlineIcon, Overlay, buttonClassName } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Select, Input } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import { iconSubirArchivo, iconTacho } from '../../design-system/icons';
import type { ArchivoAdjunto, EstadoAutorizacion } from '../../shared/types/presupuesto';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import { validarAutorizacion, validarVigenciaAutorizacion } from '../../shared/lib/presupuestos/validarAutorizacion';
import { VistaPreviaArchivo, type EstadoPrevisualizacion } from '../../shared/components/VistaPreviaArchivo';
import { inferirTipoMime } from '../../shared/lib/documentos/documentoMapping';

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Ocurrió un error inesperado.';
}

export interface AutorizacionFormValues {
  estado: EstadoAutorizacion;
  montoAutorizado?: number;
  cupoMensualDias?: number;
  cupoMensualKm?: number;
  fechaRespuesta?: string;
  vigenciaDesde?: string;
  /**
   * Completa el par pedido/concedido con `Presupuesto.vigenciaHasta` (tasks.md 8.8, design.md D1):
   * la obra social puede autorizar un período más corto que el pedido.
   */
  vigenciaHasta?: string;
  /**
   * "Con dependencia" CONCEDIDO (tasks.md 8.8, design.md D3) — **desmarcable aunque el presupuesto
   * lo tenga marcado**: es el requisito literal de la usuaria ("lo carga ella, pero la obra social
   * puede denegarlo"). `undefined` = no se cargó, `false` = SD decidido.
   */
  conDependencia?: boolean;
  archivo?: ArchivoAdjunto;
}

const DEFAULT_VALUES: AutorizacionFormValues = { estado: 'pendiente' };

const ESTADO_OPTIONS: { value: EstadoAutorizacion; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'autorizada', label: 'Autorizada' },
  { value: 'judicializada', label: 'Judicializada' },
  { value: 'rechazada', label: 'Rechazada' },
];

interface AutorizacionFormProps {
  initial?: AutorizacionFormValues;
  /** Monto del presupuesto asociado — contra el que se valida RN-PA-01 (tasks.md 6.3). */
  montoPresupuesto: number;
  /**
   * Vigencia PEDIDA por el presupuesto asociado (tasks.md 8.6/8.8, design.md D1) — contra la que
   * se valida que el período autorizado esté contenido (`validarVigenciaAutorizacion`), nunca
   * usada para pre-cargar `vigenciaDesde`/`vigenciaHasta` (esos campos, una vez cargados, son
   * independientes — mismo criterio que `montoPresupuesto` con `montoAutorizado`). Opcional: si el
   * presupuesto no tiene vigencia cargada, no hay contra qué validar.
   */
  presupuestoVigenciaDesde?: string;
  presupuestoVigenciaHasta?: string;
  /**
   * "Con dependencia" PEDIDO por el presupuesto asociado (tasks.md 8.8, design.md D3) — a
   * diferencia de `montoAutorizado`/vigencia, este SÍ se usa como valor sugerido inicial **solo en
   * alta** (sin `initial`): refleja lo que Andrea pidió, y el checkbox queda desmarcable de ahí en
   * más — nunca queda bloqueado ni se vuelve a derivar en edición.
   */
  presupuestoConDependencia?: boolean;
  /**
   * id de la autorización ya persistida (integracion-documentos-autorizaciones, tasks.md 4.1/4.2).
   * `undefined` solo en alta manual sin fila creada todavía (caso legado — ver comentario de
   * `PresupuestoDetail.tsx` sobre `found === null`). Sin id no hay contra qué llamar
   * `uploadArchivo`/`removeArchivo` (D3: operaciones de I/O propias de la fila, separadas de
   * create/update) — elegir un archivo sin id avisa que hay que guardar la autorización primero.
   */
  autorizacionId?: string;
  /**
   * Subida/quita real del archivo (design.md D3/D5 de integracion-documentos-autorizaciones):
   * opera directo contra Storage + la Edge Function `autorizaciones`, independiente del submit de
   * los campos planos de más abajo — el archivo sube apenas se elige, no espera al botón "Guardar
   * respuesta".
   */
  /**
   * `getUrlArchivo` (presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 7.8, design.md
   * D6b): resuelve la URL firmada de vista previa (`'inline'`) que consume el botón "Ver
   * documento" de más abajo — separada de `uploadArchivo`/`removeArchivo` (esas mutan la fila;
   * esta solo lee).
   */
  repository: Pick<AutorizacionRepository, 'uploadArchivo' | 'removeArchivo' | 'getUrlArchivo'>;
  onSubmit: (values: AutorizacionFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

// NOTA (tasks.md 13.1, sección 17): el campo de monto autorizado con prefijo "$" (más abajo)
// sigue con su label y clases nativas — no se migra a Field/Label acá, es el mismo candidato a
// sección 17 catalogado junto con el ícono-prefijo de CudFields.tsx (design.md §Casos que
// requerirían cambio visual). labelClasses se conserva solo para ese campo.
const labelClasses = 'font-body text-[12px] font-semibold text-muted';

function toOptionalNumber(raw: string): number | undefined {
  if (raw === '') return undefined;
  return Number(raw);
}

// Formulario de autorización ligado a un presupuesto (tasks.md 6.1 a 6.4, 9.2 a 9.4): selector de
// estado (unión cerrada, Decisión 6), montoAutorizado validado contra RN-PA-01 (`validarAutorizacion`,
// Decisión 4), vigenciaDesde independiente de fechaRespuesta para carga retroactiva (RN-PA-02,
// Decisión 5) y archivo único (Decisión 3). Estado controlado plano, mismo criterio que
// PresupuestoForm/VehiculoForm.
export function AutorizacionForm({
  initial,
  montoPresupuesto,
  presupuestoVigenciaDesde,
  presupuestoVigenciaHasta,
  presupuestoConDependencia,
  autorizacionId,
  repository,
  onSubmit,
  onCancel,
  submitting = false,
  submitError = null,
}: AutorizacionFormProps) {
  // `presupuestoConDependencia` SOLO se usa como sugerencia inicial en ALTA (`initial` ausente,
  // tasks.md 8.8, design.md D3) — en edición el valor persistido no se re-deriva, mismo criterio
  // que `PresupuestoForm` con `obraSocialId` (D9 "la edición no bifurca"/no re-deriva).
  const [values, setValues] = useState<AutorizacionFormValues>(
    initial ?? { ...DEFAULT_VALUES, conDependencia: presupuestoConDependencia },
  );
  const [montoError, setMontoError] = useState<string | null>(null);
  const [vigenciaError, setVigenciaError] = useState<string | null>(null);
  // integracion-documentos-autorizaciones (tasks.md 4.1/4.2, design.md D3/D5): estado propio de la
  // subida/quita del archivo, independiente de `submitting`/`submitError` (que son del submit de
  // los campos planos vía `onSubmit`) — son dos operaciones de I/O separadas a propósito.
  const [archivoBusy, setArchivoBusy] = useState(false);
  const [archivoError, setArchivoError] = useState<string | null>(null);
  const formId = useId();
  const archivoInputRef = useRef<HTMLInputElement>(null);

  // "Ver documento" (tasks.md 7.8, design.md D6b/D6): overlay con VistaPreviaArchivo, mismo patrón
  // de estado que DocumentChecklist.tsx (5.3) — `previewAbierto` separado de `estadoPreview` para
  // poder mostrar el título del Overlay incluso mientras la URL sigue "cargando".
  const [previewAbierto, setPreviewAbierto] = useState(false);
  const [estadoPreview, setEstadoPreview] = useState<EstadoPrevisualizacion>({ status: 'cargando' });
  // Descarta resoluciones obsoletas (se cerró el overlay antes de que la promesa resolviera) y
  // guarda la URL abierta para poder revocarla al cerrar/desmontar. `URL.revokeObjectURL` es un
  // no-op inofensivo si la URL no vino de `URL.createObjectURL` (mock in-memory, D6b tasks.md 7.4)
  // — contra la URL firmada real de Supabase (SupabaseAutorizacionRepository) no hace nada, mismo
  // criterio documentado en `useDocumentChecklist.ts`.
  const previewVigenteRef = useRef(false);
  const urlAbiertaRef = useRef<string | null>(null);

  function abrirPreview() {
    if (!autorizacionId || !values.archivo) return;
    previewVigenteRef.current = true;
    setPreviewAbierto(true);
    setEstadoPreview({ status: 'cargando' });
    repository
      .getUrlArchivo(autorizacionId, 'inline')
      .then((url) => {
        if (!previewVigenteRef.current) return;
        if (url === null) {
          setEstadoPreview({ status: 'sin-contenido' });
        } else {
          urlAbiertaRef.current = url;
          setEstadoPreview({ status: 'lista', url });
        }
      })
      .catch(() => {
        if (!previewVigenteRef.current) return;
        setEstadoPreview({ status: 'error' });
      });
  }

  function cerrarPreview() {
    previewVigenteRef.current = false;
    if (urlAbiertaRef.current) {
      URL.revokeObjectURL(urlAbiertaRef.current);
      urlAbiertaRef.current = null;
    }
    setPreviewAbierto(false);
  }

  useEffect(() => {
    return () => {
      if (urlAbiertaRef.current) {
        URL.revokeObjectURL(urlAbiertaRef.current);
        urlAbiertaRef.current = null;
      }
    };
  }, []);

  // Fallback por extensión (tasks.md 7.9, design.md D6 "Fallback acotado"): SOLO para archivos sin
  // `tipoMime` persistido — filas subidas antes de que existiera `archivo_tipo_mime` (bucket vivo
  // desde 2026-08-18, comentario de `ArchivoAdjunto.tipoMime` en presupuesto.ts). Reusa
  // `inferirTipoMime` (documentoMapping.ts), no reimplementa el criterio. Si tampoco se puede
  // inferir, queda `undefined` y `VistaPreviaArchivo` cae sola en su rama de "no se puede
  // previsualizar acá" + descarga (mismo criterio que ya usa el checklist documental).
  const tipoMimeEfectivo = values.archivo && (values.archivo.tipoMime ?? inferirTipoMime(values.archivo.nombre));

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const resultadoMonto = validarAutorizacion({ montoAutorizado: values.montoAutorizado, montoPresupuesto });
    if (!resultadoMonto.ok) {
      setMontoError(resultadoMonto.error);
      return;
    }
    setMontoError(null);

    // tasks.md 8.6, design.md D1: período autorizado ⊆ período pedido — regla distinta de
    // RN-PA-01 (monto), con su propio mensaje (spec "el mensaje distingue este caso del de
    // RN-PA-01").
    const resultadoVigencia = validarVigenciaAutorizacion({
      vigenciaDesde: values.vigenciaDesde,
      vigenciaHasta: values.vigenciaHasta,
      presupuestoVigenciaDesde,
      presupuestoVigenciaHasta,
    });
    if (!resultadoVigencia.ok) {
      setVigenciaError(resultadoVigencia.error);
      return;
    }
    setVigenciaError(null);

    onSubmit(values);
  }

  // Sube DIRECTO al elegir el archivo (D3/D5): nunca fabrica `nombre`/`cargadoEn` desde el
  // navegador (bug que este change corrige, design.md D4) — el `archivo` que queda en `values` es
  // siempre el que devuelve `repository.uploadArchivo`, ya persistido.
  async function handleArchivoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!autorizacionId) {
      setArchivoError('Guardá la autorización antes de adjuntar un archivo.');
      return;
    }

    setArchivoError(null);
    setArchivoBusy(true);
    try {
      const actualizada = await repository.uploadArchivo(autorizacionId, file);
      setValues((prev) => ({ ...prev, archivo: actualizada.archivo }));
    } catch (err) {
      setArchivoError(toErrorMessage(err));
    } finally {
      setArchivoBusy(false);
    }
  }

  async function handleQuitarArchivo() {
    if (!autorizacionId) return;
    setArchivoError(null);
    setArchivoBusy(true);
    try {
      const actualizada = await repository.removeArchivo(autorizacionId);
      setValues((prev) => ({ ...prev, archivo: actualizada.archivo }));
    } catch (err) {
      setArchivoError(toErrorMessage(err));
    } finally {
      setArchivoBusy(false);
    }
  }

  return (
    <CardForm onSubmit={handleSubmit}>
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {/* tasks.md 5.2/5.3, design.md D5/D13#1/D13#6. Migrado desde un bloque hand-rolled
          (<div role="note">…</div> con lista propia) a dos AvisoModeloDatos agrupados por tema —
          la regla dura de la sección 5 de tasks.md prohíbe markup de alerta propio. Se mantienen
          agrupados (no un cartel por campo): uno para el archivo adjunto y uno para
          montoAutorizado/vigenciaDesde (misma fila de discrepancia, D13#6).
          integracion-documentos-autorizaciones (tasks.md 4.3, spec autorizacion-gestion Scenario
          "El archivo adjunto se guarda en el servidor"): se retira la parte de "todavía no se
          guarda en el servidor" — ya no es cierto, el archivo se sube de verdad (D3/D5). Lo que
          sigue vigente (y sigue siendo una discrepancia real con lo que asumía CHANGES.md) es que
          el docx modela un solo "Archivo" por autorización, no un checklist multi-documento. */}
      <AvisoModeloDatos>
        El modelo real (docx) tiene un solo archivo por autorización, no un checklist
        multi-documento como asumía originalmente <code>CHANGES.md</code>.
      </AvisoModeloDatos>

      {/* tasks.md 5.3, design.md D13#6: montoAutorizado/vigenciaDesde ya NO son "pendientes de
          confirmar con backend" — son columnas reales desde C-06. Lo que sigue vigente es que el
          docx no las modela (se agregaron para validar RN-PA-01/RN-PA-02). */}
      <AvisoModeloDatos>
        <strong>Monto autorizado</strong> y <strong>Fecha de vigencia</strong> no existen en el
        docx original (que solo modela Fecha de respuesta): se agregaron para poder validar
        RN-PA-01 y RN-PA-02. Ya son columnas reales en la base desde <code>C-06</code>, así que
        quedaron confirmadas con backend — el frontend no las está inventando.
      </AvisoModeloDatos>

      {/* tasks.md 9.3, design.md §Discrepancias #2/#3/#5 (presupuestos-vigencia-datos-traslado-
          vista-previa): tres campos nuevos de este change, ninguno en el docx original — agrupados
          en un solo cartel, mismo criterio que los dos de arriba. `PresupuestoForm` ya tiene sus
          carteles equivalentes desde la Fase 8 de ese change. */}
      <AvisoModeloDatos>
        <strong>Vigencia hasta</strong>, <strong>Con dependencia (CD)</strong> y el{' '}
        <strong>tipo de archivo</strong> del adjunto tampoco están en el docx original: completan
        el par pedido/concedido de vigencia y dependencia con el presupuesto, y el tipo de archivo
        permite previsualizar el adjunto sin adivinarlo por la extensión del nombre.
      </AvisoModeloDatos>

      {/* gateo-facturacion (design.md D3, tasks.md 3.2): un solo envoltorio cubre todo el bloque
          de campos. NO cubre la barra de acciones — Cancelar debe seguir operativo. */}
      <CamposSoloLectura>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Estado" htmlFor={`${formId}-estado`}>
          <Select
            id={`${formId}-estado`}
            density="comfortable"
            value={values.estado}
            onChange={(event) => setValues((prev) => ({ ...prev, estado: event.target.value as EstadoAutorizacion }))}
          >
            {ESTADO_OPTIONS.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex flex-col gap-xs">
          <label htmlFor={`${formId}-monto-autorizado`} className={labelClasses}>
            Monto autorizado
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-md font-body text-[13px] text-muted">
              $
            </span>
            <input
              id={`${formId}-monto-autorizado`}
              type="number"
              min={0}
              className="w-full rounded-sm border border-border-strong bg-surface py-2 pl-xl pr-md font-body text-[13px] text-text"
              value={values.montoAutorizado ?? ''}
              onChange={(event) => setValues((prev) => ({ ...prev, montoAutorizado: toOptionalNumber(event.target.value) }))}
            />
          </div>
          {montoError && <span className="font-body text-xs text-danger">{montoError}</span>}
        </div>

        <Field label="Cupo mensual de días" htmlFor={`${formId}-cupo-dias`}>
          <Input
            id={`${formId}-cupo-dias`}
            type="number"
            min={0}
            density="comfortable"
            value={values.cupoMensualDias ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, cupoMensualDias: toOptionalNumber(event.target.value) }))}
          />
        </Field>

        <Field label="Cupo mensual de km" htmlFor={`${formId}-cupo-km`}>
          <Input
            id={`${formId}-cupo-km`}
            type="number"
            min={0}
            density="comfortable"
            value={values.cupoMensualKm ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, cupoMensualKm: toOptionalNumber(event.target.value) }))}
          />
        </Field>

        <Field label="Fecha de respuesta" htmlFor={`${formId}-fecha-respuesta`}>
          <Input
            id={`${formId}-fecha-respuesta`}
            type="date"
            density="comfortable"
            value={values.fechaRespuesta ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, fechaRespuesta: event.target.value || undefined }))}
          />
        </Field>

        <Field label="Vigencia desde" htmlFor={`${formId}-vigencia-desde`}>
          <Input
            id={`${formId}-vigencia-desde`}
            type="date"
            density="comfortable"
            value={values.vigenciaDesde ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, vigenciaDesde: event.target.value || undefined }))}
          />
        </Field>

        {/* tasks.md 8.8, design.md D1: completa el par pedido/concedido de vigencia — la obra
            social puede autorizar un período más corto que el pedido (`presupuesto.vigenciaHasta`). */}
        <Field label="Vigencia hasta" htmlFor={`${formId}-vigencia-hasta`} error={vigenciaError ?? undefined}>
          <Input
            id={`${formId}-vigencia-hasta`}
            type="date"
            density="comfortable"
            value={values.vigenciaHasta ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, vigenciaHasta: event.target.value || undefined }))}
          />
        </Field>

        {/* CD/SD CONCEDIDO (tasks.md 8.8, design.md D3): mismo patrón de checkbox nativo + label
            que PresupuestoForm/VehiculoForm/ConductorForm — **siempre editable/desmarcable**,
            nunca `disabled` en función de `presupuestoConDependencia` (requisito literal de la
            usuaria: "lo carga ella, pero la obra social puede denegarlo"). Ese valor solo influye
            en el estado INICIAL de alta (ver el `useState` de más arriba), nunca en si el control
            se puede tocar. */}
        <label
          htmlFor={`${formId}-con-dependencia`}
          className="flex w-fit items-center gap-sm self-end pb-2 font-body text-[13px] text-text"
        >
          <input
            id={`${formId}-con-dependencia`}
            type="checkbox"
            checked={values.conDependencia ?? false}
            onChange={(event) => setValues((prev) => ({ ...prev, conDependencia: event.target.checked }))}
          />
          Con dependencia (CD)
        </label>

        <div className="flex flex-col gap-xs md:col-span-2">
          <label htmlFor={`${formId}-archivo`} className={labelClasses}>
            Archivo
          </label>
          <input
            ref={archivoInputRef}
            id={`${formId}-archivo`}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={handleArchivoChange}
            disabled={archivoBusy}
            className="sr-only"
          />
          <div
            onClick={() => {
              if (archivoBusy) return;
              archivoInputRef.current?.click();
            }}
            className="flex cursor-pointer flex-col items-center gap-xs rounded-sm border-2 border-dashed border-border-strong bg-surface-soft px-lg py-xl text-center"
          >
            <InlineIcon size={32}>{iconSubirArchivo}</InlineIcon>
            <span className="font-body text-[13px]">
              <span className="font-semibold text-primary">{archivoBusy ? 'Subiendo…' : 'Subir un archivo'}</span>{' '}
              <span className="text-muted">o arrastrar y soltar</span>
            </span>
            <span className="font-body text-[11px] text-muted">PDF, JPG o PNG hasta 10MB</span>
          </div>
          {values.archivo && (
            <div className="flex items-center justify-between gap-sm">
              <span className="font-body text-xs text-muted">
                {values.archivo.nombre} (cargado {values.archivo.cargadoEn})
              </span>
              <Button variant="danger" size="sm" requiereEscritura disabled={archivoBusy} onClick={handleQuitarArchivo}>
                <InlineIcon>{iconTacho}</InlineIcon>
                Quitar archivo
              </Button>
            </div>
          )}
          {archivoError && <span className="font-body text-xs text-danger">{archivoError}</span>}
        </div>
      </div>
      </CamposSoloLectura>

      {/* "Ver documento" (tasks.md 7.8, design.md D6b/D6 "Permisos de lectura gobiernan la vista
          previa"): a propósito FUERA de `CamposSoloLectura` — es una acción de LECTURA, no de
          escritura, y el `<fieldset disabled>` de ese envoltorio deshabilitaría cualquier <button>
          adentro sin importar `requiereEscritura`. El mismo criterio que ya usa "Ver" en
          `DocumentChecklist.tsx` (nunca se deshabilita con `readOnly`): el gateo real de lectura lo
          impone la RLS del bucket del lado del servidor (spec `autorizacion-archivo-vista-previa`,
          escenario "Permisos de lectura gobiernan la vista previa"), no un `disabled` de cliente
          más restrictivo que eso. */}
      {values.archivo && autorizacionId && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={abrirPreview}>
            Ver documento
          </Button>
        </div>
      )}

      <Overlay
        open={previewAbierto}
        onClose={cerrarPreview}
        title={values.archivo ? `Vista previa - ${values.archivo.nombre}` : 'Vista previa'}
      >
        {/* design.md D6, "Ubicación en UI": el <a target="_blank"> apunta a la MISMA url `inline`
            ya resuelta para el Overlay — no dispara una segunda firma. rel="noopener noreferrer"
            (higiene estándar de pestañas nuevas: la pestaña abierta no puede referenciar `window.opener`
            de esta). */}
        {estadoPreview.status === 'lista' && (
          <div className="mb-sm flex justify-end">
            <a
              href={estadoPreview.url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClassName('secondary', 'sm')}
            >
              Abrir en otra pestaña
            </a>
          </div>
        )}
        <VistaPreviaArchivo
          estado={estadoPreview}
          nombreArchivo={values.archivo?.nombre ?? ''}
          tipoMime={tipoMimeEfectivo}
        />
      </Overlay>

      <div className="flex justify-end gap-sm">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" requiereEscritura>
          {submitting ? 'Guardando…' : 'Guardar respuesta'}
        </Button>
      </div>
    </CardForm>
  );
}
