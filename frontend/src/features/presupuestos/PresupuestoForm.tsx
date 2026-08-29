import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { AvisoModeloDatos, Button, CamposSoloLectura, FieldGroupHeading, InlineIcon } from '../../design-system/components';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Field, FieldError, Select, Input } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import { iconSubirArchivo } from '../../design-system/icons';
import type { ArchivoAdjunto, DatosTraslado, PresupuestoLinea } from '../../shared/types/presupuesto';
import type { PacienteResumen } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { DiaSemana, RecorridoHabitual } from '../../shared/types/recorridoHabitual';
import type { RecorridoHabitualRepository } from '../../shared/lib/pacientes/RecorridoHabitualRepository';
import { calcularKmMensuales, calcularViajesMensuales } from '../../shared/lib/presupuestos/calculoViajes';
import { construirDatosTrasladoDesdeRecorridos } from './construirDatosTrasladoDesdeRecorridos';
import { PresupuestoLineasEditor, type LineaPresupuesto } from './PresupuestoLineasEditor';
import {
  validatePresupuestoForm,
  validatePresupuestoLoteForm,
  validarRangoVigencia,
  type PresupuestoFormErrors,
  type PresupuestoLoteFormErrors,
} from './validatePresupuestoForm';

export interface PresupuestoFormValues {
  pacienteId: string | null;
  obraSocialId: string | null;
  monto: number;
  fechaEmision: string;
  archivo?: ArchivoAdjunto;
  /**
   * Solo se completa en el submit de la rama `por-prestacion` (uno por ítem del lote,
   * design.md D9). En las ramas `simple`/`general` queda SIEMPRE `undefined` — el desglose de
   * `general` vive en `lineas`.
   */
  prestacionId?: string;
  /**
   * Desglose de la rama `general` (REAPERTURA #13, decisión usuaria 2026-08-16): las líneas del
   * `PresupuestoLineasEditor` SÍ se persisten ahora (antes solo sumaban su monto al campo simple
   * y no viajaban). `orden` es la posición de carga (1-based). `undefined` en las ramas
   * `simple`/`por-prestacion` — la clave queda ausente del payload, nunca se manda vacía.
   */
  lineas?: PresupuestoLinea[];
  /**
   * Período que cubre el presupuesto (presupuestos-vigencia-datos-traslado-vista-previa, tasks.md
   * 8.2, design.md D1). Separado a propósito de `fechaEmision` — es el malentendido que originó
   * el pedido de Andrea: un presupuesto puede emitirse el 30/12 y valer recién desde febrero.
   */
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  /**
   * "Con dependencia" PEDIDO por este presupuesto (tasks.md 8.3, design.md D3). `undefined` = no
   * se cargó (nunca un default `false` implícito); la obra social puede desmarcarlo en la
   * autorización sin que esto cambie (AutorizacionForm, tasks.md 8.8).
   */
  conDependencia?: boolean;
  /**
   * Bloque de datos del formulario de traslado de la obra social (tasks.md 8.4/8.5, design.md D2).
   * `undefined` mientras no se cargó ningún campo del bloque — recién se crea (con `diasSemana: []`)
   * al tocar el primer campo o al usar "Traer de los destinos habituales del paciente".
   */
  datosTraslado?: DatosTraslado;
}

/**
 * Contrato de submit de la bifurcación (design.md D9, tasks.md Fase 8): `PresupuestoForm` no se
 * duplica en dos formularios — resuelve la obra social elegida y bifurca el bloque del monto, pero
 * el submit siempre termina en una de estas dos formas. `modo: 'unico'` cubre "sin obra social",
 * "general" (con o sin líneas) y **toda edición** (D9: "la edición no bifurca"). `modo: 'lote'`
 * solo existe en alta, modalidad `por-prestacion`.
 */
export type PresupuestoFormSubmission =
  | { modo: 'unico'; values: PresupuestoFormValues }
  | { modo: 'lote'; items: PresupuestoFormValues[] };

const DEFAULT_VALUES: PresupuestoFormValues = {
  pacienteId: null,
  obraSocialId: null,
  monto: 0,
  fechaEmision: new Date().toISOString().slice(0, 10),
};

interface PresupuestoFormProps {
  initial?: PresupuestoFormValues;
  /** Se puebla desde PacienteRepository.list() en el composition root — nunca hardcodeada (design.md Decisión 8). */
  pacientes: PacienteResumen[];
  /** Se puebla desde ObraSocialRepository.list() en el composition root — nunca hardcodeada (design.md Decisión 8). */
  obrasSociales: ObraSocial[];
  /**
   * Botón "Traer de los destinos habituales del paciente" (tasks.md 8.5, design.md D2): solo se
   * usa `list`, nunca `create`/`remove` — este formulario COPIA, nunca escribe contra
   * `pacientes.recorridos`. Repository real ya existe (RF-110, reusado del composition root de
   * Pacientes, `PacientesRoute.tsx`), no un mock nuevo para este change.
   */
  recorridoHabitualRepository: Pick<RecorridoHabitualRepository, 'list'>;
  onSubmit: (submission: PresupuestoFormSubmission) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

/** `datosTraslado` vacío (tasks.md 8.4): `diasSemana: []` nunca `undefined` — la columna real es
 * `NOT NULL DEFAULT '{}'` (design.md D2). */
const DATOS_TRASLADO_VACIO: DatosTraslado = { diasSemana: [] };

const DIAS_SEMANA_OPCIONES: { value: DiaSemana; label: string }[] = [
  { value: 'lunes', label: 'Lunes' },
  { value: 'martes', label: 'Martes' },
  { value: 'miercoles', label: 'Miércoles' },
  { value: 'jueves', label: 'Jueves' },
  { value: 'viernes', label: 'Viernes' },
  { value: 'sabado', label: 'Sábado' },
  { value: 'domingo', label: 'Domingo' },
];

// Mismo criterio que AutorizacionForm/FacturaForm: label suelto (no Label del design system, que
// exige htmlFor sobre un control real) para el bloque de obra social, que a partir de este fix
// (obra social derivada del paciente, ver comentario del componente) ya no es un <select>.
const labelClasses = 'font-body text-[12px] font-semibold text-muted';

function nombrePaciente(paciente: PacienteResumen): string {
  return `${paciente.apellido}, ${paciente.nombre}`;
}

function sumarLineas(lineas: LineaPresupuesto[]): number {
  const suma = lineas.reduce((acc, linea) => acc + (Number.isFinite(linea.monto) ? linea.monto : 0), 0);
  return Math.round(suma * 100) / 100;
}

// Formulario de alta/edición de presupuesto (tasks.md 5.2 a 5.5, 8.1 a 8.9, design.md D9): la
// bifurcación es de RENDER, no de dos formularios (D9) — se resuelve la obra social del paciente
// elegido (fix "la obra social debe derivarse del paciente", no un select propio — ver
// `bloqueadoSinObraSocial`/el efecto que sincroniza `values.obraSocialId`) y se bifurca únicamente
// el bloque del monto. **La edición no bifurca nunca** (D9): con `initial` presente, el bloque
// siempre es el campo `monto` simple, sin importar la `modalidadFacturacion` de la obra social —
// editar un presupuesto existente edita `monto` y `prestacionId` uno a uno, el lote es solo alta.
//
// En ALTA (`initial` ausente):
//  - Sin obra social elegida → campo `monto` simple (comportamiento histórico sin cambios).
//  - `modalidadFacturacion === 'general'` → el campo `monto` simple sigue presente (spec
//    "Modalidad general sin líneas cargadas usa el campo simple") + `PresupuestoLineasEditor`
//    debajo; en cuanto hay al menos una línea, el campo `monto` pasa a mostrar (solo lectura) la
//    suma en vivo — y desde la REAPERTURA #13 (decisión usuaria 2026-08-16) las líneas SÍ viajan
//    en `values.lineas` para persistirse con el presupuesto (antes solo sumaban al `monto` y se
//    descartaban).
//  - `modalidadFacturacion === 'por-prestacion'` → multi-select de `paciente.prestaciones.filter(p
//    => p.activa)` + un monto por cada una marcada; sin prestaciones activas, empty state con
//    enlace a la ficha del paciente y submit bloqueado (spec "Paciente sin prestaciones activas
//    bloquea el submit").
//
// Cambiar de paciente u obra social con líneas/selección ya cargadas resetea ese bloque con aviso
// explícito (spec "Cambiar de paciente u obra social resetea la selección de montos").
export function PresupuestoForm({
  initial,
  pacientes,
  obrasSociales,
  recorridoHabitualRepository,
  onSubmit,
  onCancel,
  submitting = false,
  submitError = null,
}: PresupuestoFormProps) {
  const isEditMode = initial !== undefined;
  const [values, setValues] = useState<PresupuestoFormValues>(initial ?? DEFAULT_VALUES);
  const [lineas, setLineas] = useState<LineaPresupuesto[]>([]);
  const [seleccion, setSeleccion] = useState<Map<string, number>>(new Map());
  const [errors, setErrors] = useState<PresupuestoFormErrors & PresupuestoLoteFormErrors>({});
  const [avisoReset, setAvisoReset] = useState(false);
  const formId = useId();
  const archivoInputRef = useRef<HTMLInputElement>(null);

  // "Traer de los destinos habituales del paciente" (tasks.md 8.5, design.md D2): `null` = todavía
  // no se resolvió nada para este paciente (sin paciente elegido, o pedido en curso);  `[]` =
  // resuelto, el paciente no tiene ninguno cargado. Se refetchea cada vez que cambia el paciente
  // elegido — nunca se comparte estado entre pacientes distintos.
  const [recorridosHabituales, setRecorridosHabituales] = useState<RecorridoHabitual[] | null>(null);
  const [recorridosHabitualesLoading, setRecorridosHabitualesLoading] = useState(false);

  useEffect(() => {
    if (!values.pacienteId) {
      setRecorridosHabituales(null);
      setRecorridosHabitualesLoading(false);
      return;
    }
    let cancelado = false;
    setRecorridosHabitualesLoading(true);
    recorridoHabitualRepository
      .list(values.pacienteId)
      .then((lista) => {
        if (cancelado) return;
        setRecorridosHabituales(lista);
        setRecorridosHabitualesLoading(false);
      })
      .catch(() => {
        // Sin destinos resueltos, el botón queda deshabilitado con motivo (mismo criterio que
        // "paciente sin destinos habituales") — un error de red acá no debe romper el resto del
        // formulario, que sigue siendo 100% editable a mano.
        if (cancelado) return;
        setRecorridosHabituales([]);
        setRecorridosHabitualesLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [values.pacienteId, recorridoHabitualRepository]);

  const esPrimerRender = useRef(true);
  useEffect(() => {
    if (esPrimerRender.current) {
      esPrimerRender.current = false;
      return;
    }
    if (lineas.length > 0 || seleccion.size > 0) {
      setLineas([]);
      setSeleccion(new Map());
      setAvisoReset(true);
    }
    // Reset intencional solo por cambio de paciente/obra social (spec dedicada) — no por cambios
    // de lineas/seleccion en sí, que ya se leen del closure de este mismo render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.pacienteId, values.obraSocialId]);

  const obraSocialSeleccionada = obrasSociales.find((os) => os.id === values.obraSocialId);
  const pacienteSeleccionado = pacientes.find((p) => p.id === values.pacienteId);
  const prestacionesActivas = useMemo(
    () => (pacienteSeleccionado?.prestaciones ?? []).filter((prestacion) => prestacion.activa),
    [pacienteSeleccionado],
  );

  // Fix "la obra social debe derivarse del paciente, no elegirse aparte": `obraSocialId` deja de
  // ser un campo que el usuario tipea — se completa solo con `paciente.obraSocialId` (singular,
  // sin histórico, ver shared/types/paciente.ts) apenas se elige un paciente, mismo patrón que
  // FacturaForm Paso 2 ("obra social de solo lectura, derivada del paciente"). Solo corre en ALTA
  // (`!isEditMode`): en edición el valor persistido no se re-deriva — D9 "la edición no bifurca"
  // aplica también acá, el paciente.obraSocialId pudo cambiar desde que se cargó el presupuesto y
  // no hay por qué pisar lo que ya se guardó.
  useEffect(() => {
    if (isEditMode) return;
    setValues((prev) => ({ ...prev, obraSocialId: pacienteSeleccionado?.obraSocialId ?? null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, pacienteSeleccionado?.obraSocialId]);

  // Paciente elegido sin obra social asignada (obraSocialId: null): el alta queda bloqueada — no
  // hay nada que derivar, y no se ofrece un selector de reemplazo (ver comentario arriba). Solo
  // aplica en alta: en edición el presupuesto ya tiene una obra social persistida.
  const bloqueadoSinObraSocial = !isEditMode && pacienteSeleccionado !== undefined && pacienteSeleccionado.obraSocialId === null;

  const modo: 'simple' | 'general' | 'por-prestacion' =
    !isEditMode && obraSocialSeleccionada?.modalidadFacturacion === 'por-prestacion'
      ? 'por-prestacion'
      : !isEditMode && obraSocialSeleccionada?.modalidadFacturacion === 'general'
        ? 'general'
        : 'simple';

  const totalLineas = useMemo(() => sumarLineas(lineas), [lineas]);
  const montoMostrado = modo === 'general' && lineas.length > 0 ? totalLineas : values.monto;

  // Datos del formulario de la obra social (tasks.md 8.4/8.5, design.md D2): bloque opcional,
  // `datosTraslado` puede seguir `undefined` hasta que se toca el primer campo.
  const datosTraslado = values.datosTraslado ?? DATOS_TRASLADO_VACIO;

  function setDatosTraslado(patch: Partial<DatosTraslado>) {
    setValues((prev) => ({ ...prev, datosTraslado: { ...(prev.datosTraslado ?? DATOS_TRASLADO_VACIO), ...patch } }));
  }

  function toggleDiaSemana(dia: DiaSemana) {
    const yaMarcado = datosTraslado.diasSemana.includes(dia);
    const siguientes = yaMarcado
      ? datosTraslado.diasSemana.filter((d) => d !== dia)
      : DIAS_SEMANA_OPCIONES.map((opcion) => opcion.value).filter(
          (d) => d === dia || datosTraslado.diasSemana.includes(d),
        );
    setDatosTraslado({ diasSemana: siguientes });
  }

  // tieneVuelta se DERIVA de que haya tramo de vuelta cargado — no es una columna aparte
  // (design.md D4): la presencia de cualquiera de los tres campos del tramo de vuelta ya implica
  // que el traslado tiene ida y vuelta.
  const tieneVuelta = Boolean(datosTraslado.origenVuelta || datosTraslado.destinoVuelta || datosTraslado.kmVuelta);

  // Viajes y km mensuales calculados en vivo (tasks.md 8.4, design.md D4): mismo espíritu que el
  // total de PresupuestoLineasEditor — NUNCA se persiste (calculoViajes.ts), solo se muestra.
  // `diasMensuales` negativo lanza `RangeError` (decisión de calculoViajes.ts, tasks.md 4.3): acá
  // se traduce a "sin cálculo" en vez de romper el formulario, la validación real de ese campo es
  // un problema aparte (spec de datos de traslado no exige bloquear el submit por esto).
  const viajesYKmMensuales = useMemo(() => {
    if (datosTraslado.diasMensuales === undefined) return null;
    try {
      return {
        viajes: calcularViajesMensuales({ diasMensuales: datosTraslado.diasMensuales, tieneVuelta }),
        km: calcularKmMensuales({
          diasMensuales: datosTraslado.diasMensuales,
          tieneVuelta,
          kmIda: datosTraslado.kmIda ?? 0,
          kmVuelta: datosTraslado.kmVuelta ?? 0,
        }),
      };
    } catch {
      return null;
    }
  }, [datosTraslado.diasMensuales, datosTraslado.kmIda, datosTraslado.kmVuelta, tieneVuelta]);

  // "Traer de los destinos habituales del paciente" (tasks.md 8.5, design.md D2): copy-on-create,
  // nunca referencia viva — el resultado se mezcla en el estado editable del formulario, no queda
  // ligado al `RecorridoHabitual` de origen.
  const motivoDeshabilitadoTraerDestinos = !pacienteSeleccionado
    ? 'Elegí un paciente para poder traer sus destinos habituales.'
    : recorridosHabitualesLoading
      ? 'Buscando destinos habituales…'
      : recorridosHabituales === null || recorridosHabituales.length === 0
        ? 'Este paciente no tiene destinos habituales cargados.'
        : null;

  function handleTraerDestinosHabituales() {
    if (!pacienteSeleccionado || !recorridosHabituales || recorridosHabituales.length === 0) return;
    const parcial = construirDatosTrasladoDesdeRecorridos(recorridosHabituales, pacienteSeleccionado.direcciones);
    setDatosTraslado(parcial);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const errorVigencia = validarRangoVigencia(values.vigenciaDesde, values.vigenciaHasta);

    if (modo === 'por-prestacion') {
      const items = prestacionesActivas
        .filter((prestacion) => seleccion.has(prestacion.id))
        .map((prestacion) => ({ prestacionId: prestacion.id, monto: seleccion.get(prestacion.id) ?? 0 }));

      const loteErrors: PresupuestoLoteFormErrors & PresupuestoFormErrors = {
        ...validatePresupuestoLoteForm({
          pacienteId: values.pacienteId,
          obraSocialId: values.obraSocialId,
          items,
        }),
        ...(errorVigencia !== undefined ? { vigenciaHasta: errorVigencia } : {}),
      };
      setErrors(loteErrors);
      if (Object.keys(loteErrors).length > 0) return;

      const submissionItems: PresupuestoFormValues[] = items
        .filter((item) => item.monto > 0)
        .map((item) => ({ ...values, monto: item.monto, prestacionId: item.prestacionId }));
      onSubmit({ modo: 'lote', items: submissionItems });
      return;
    }

    const montoFinal = modo === 'general' && lineas.length > 0 ? totalLineas : values.monto;
    const validationErrors = validatePresupuestoForm({
      pacienteId: values.pacienteId,
      obraSocialId: values.obraSocialId,
      monto: montoFinal,
      vigenciaDesde: values.vigenciaDesde,
      vigenciaHasta: values.vigenciaHasta,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    // REAPERTURA #13 (2026-08-16): las líneas de la rama `general` SÍ se persisten — el desglose
    // del editor viaja en `values.lineas` con `orden` = posición de carga (1-based). El id local
    // de cada línea se conserva hasta el mapping (que lo descarta: el servidor asigna los suyos).
    const lineasPayload: PresupuestoLinea[] | undefined =
      modo === 'general' && lineas.length > 0
        ? lineas.map((linea, indice) => ({ id: linea.id, prestacionId: linea.prestacionId, monto: linea.monto, orden: indice + 1 }))
        : undefined;
    onSubmit({ modo: 'unico', values: { ...values, monto: montoFinal, prestacionId: undefined, lineas: lineasPayload } });
  }

  function handleArchivoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const archivo: ArchivoAdjunto = { nombre: file.name, cargadoEn: new Date().toISOString().slice(0, 10) };
    setValues((prev) => ({ ...prev, archivo }));
  }

  function handleToggleSeleccion(prestacionId: string, checked: boolean) {
    setSeleccion((prev) => {
      const next = new Map(prev);
      if (checked) {
        next.set(prestacionId, next.get(prestacionId) ?? 0);
      } else {
        next.delete(prestacionId);
      }
      return next;
    });
  }

  function handleMontoSeleccion(prestacionId: string, monto: number) {
    setSeleccion((prev) => {
      const next = new Map(prev);
      next.set(prestacionId, monto);
      return next;
    });
  }

  return (
    <CardForm onSubmit={handleSubmit}>
      {submitError && <Alert tone="danger">{submitError}</Alert>}
      {avisoReset && (
        <Alert tone="info" role="status">
          Cambiaste el paciente o la obra social: la selección de montos se reinició.
        </Alert>
      )}

      {/* gateo-facturacion (design.md D3, tasks.md 2.3): un solo envoltorio cubre todo el
          bloque de campos (formulario de un solo bloque, sin sub-bloques como PacienteForm).
          NO cubre la barra de acciones de abajo — Cancelar debe seguir operativo. */}
      <CamposSoloLectura>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Paciente" htmlFor={`${formId}-paciente`} error={errors.pacienteId}>
          <Select
            id={`${formId}-paciente`}
            density="comfortable"
            value={values.pacienteId ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, pacienteId: event.target.value || null }))}
          >
            <option value="">Seleccionar paciente…</option>
            {pacientes.map((paciente) => (
              <option key={paciente.id} value={paciente.id}>
                {nombrePaciente(paciente)}
              </option>
            ))}
          </Select>
        </Field>

        {/* Fix "la obra social debe derivarse del paciente": ya no es un <select> propio — se
            muestra de solo lectura, derivada de `pacienteSeleccionado.obraSocialId` (mismo patrón
            que FacturaForm Paso 2, "obra social de solo lectura, derivada del paciente"). Sin
            paciente elegido, un texto neutro invita a elegirlo primero; con paciente pero sin
            obra social asignada, un EmptyState bloqueante con enlace a su ficha. */}
        <div className="flex flex-col gap-xs">
          <span className={labelClasses}>Obra social</span>
          {!pacienteSeleccionado ? (
            <p className="m-0 font-body text-[13px] text-muted">Elegí un paciente para ver su obra social.</p>
          ) : pacienteSeleccionado.obraSocialId === null ? (
            <EmptyState
              message="Este paciente no tiene obra social asignada. Asignala en la ficha del paciente antes de crear un presupuesto."
              action={
                <a href="/pacientes" className="font-body text-[13px] font-semibold text-primary">
                  Ir a la ficha del paciente
                </a>
              }
            />
          ) : (
            <p className="m-0 font-body text-[13px] text-text">
              {obraSocialSeleccionada?.nombre ?? 'No se pudo resolver la obra social del paciente.'}
            </p>
          )}
          <FieldError id={`${formId}-obra-social-error`}>{errors.obraSocialId}</FieldError>
        </div>

        {modo === 'por-prestacion' ? (
          <div className="md:col-span-2 flex flex-col gap-md">
            {/* spec presupuesto-prestacion, "Selector de prestaciones filtra solo activas" y
                "Paciente sin prestaciones activas bloquea el submit": sin prestaciones activas, no
                se ofrece un select vacío — empty state con enlace a la ficha del paciente. */}
            {prestacionesActivas.length === 0 ? (
              <>
                <EmptyState
                  message="Este paciente no tiene prestaciones activas cargadas. Cargalas desde su ficha antes de emitir un presupuesto por prestación."
                  action={
                    <a href="/pacientes" className="font-body text-[13px] font-semibold text-primary">
                      Ir a la ficha del paciente
                    </a>
                  }
                />
                <FieldError id={`${formId}-seleccion-error`}>{errors.items}</FieldError>
              </>
            ) : (
              <div className="flex flex-col gap-sm">
                <span className="font-body text-[12px] font-semibold text-muted">Prestaciones</span>
                {prestacionesActivas.map((prestacion) => {
                  const checked = seleccion.has(prestacion.id);
                  return (
                    <div key={prestacion.id} className="flex flex-wrap items-center gap-md">
                      <label className="flex items-center gap-xs font-body text-[13px] text-text">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => handleToggleSeleccion(prestacion.id, event.target.checked)}
                        />
                        {prestacion.nombre}
                      </label>
                      {checked && (
                        <Input
                          type="number"
                          min={0}
                          density="comfortable"
                          aria-label={`Monto para ${prestacion.nombre}`}
                          value={seleccion.get(prestacion.id) ?? 0}
                          onChange={(event) => handleMontoSeleccion(prestacion.id, Number(event.target.value))}
                        />
                      )}
                    </div>
                  );
                })}
                <FieldError id={`${formId}-seleccion-error`}>{errors.items}</FieldError>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* "Monto" único (docx): estimación funcionalmente anual/por prestación, sin desglose
                estructurado — design.md Discrepancia 4. En modalidad `general` (spec "Modalidad
                general sin líneas cargadas usa el campo simple") sigue siendo la alternativa
                válida; en cuanto hay líneas cargadas pasa a ser de solo lectura y refleja la suma
                en vivo (D9). */}
            <Field label="Monto (estimación del presupuesto)" htmlFor={`${formId}-monto`} error={errors.monto}>
              <Input
                id={`${formId}-monto`}
                type="number"
                min={0}
                density="comfortable"
                readOnly={modo === 'general' && lineas.length > 0}
                value={montoMostrado}
                onChange={(event) => setValues((prev) => ({ ...prev, monto: Number(event.target.value) }))}
              />
            </Field>

            {modo === 'general' && (
              <div className="md:col-span-2 flex flex-col gap-xs">
                <span className="font-body text-[12px] font-semibold text-muted">
                  O cargá el monto por prestación (opcional) — el total reemplaza al campo de arriba
                </span>
                <PresupuestoLineasEditor prestaciones={prestacionesActivas} lineas={lineas} onChange={setLineas} />
              </div>
            )}
          </>
        )}

        <Field label="Fecha de emisión" htmlFor={`${formId}-fecha-emision`}>
          <Input
            id={`${formId}-fecha-emision`}
            type="date"
            density="comfortable"
            value={values.fechaEmision}
            onChange={(event) => setValues((prev) => ({ ...prev, fechaEmision: event.target.value }))}
          />
        </Field>

        <div className="md:col-span-2">
          {/* Fix "input de subir archivo sin estilizar": mismo patrón que AutorizacionForm.tsx
              (dropzone con InlineIcon + botón "Subir un archivo") — el <input type="file"> real
              queda sr-only y se dispara con archivoInputRef.current?.click() desde el div
              estilizado, en vez del <input> nativo suelto de antes. */}
          <div className="flex flex-col gap-xs">
            <label htmlFor={`${formId}-archivo`} className={labelClasses}>
              Archivo
            </label>
            <input
              ref={archivoInputRef}
              id={`${formId}-archivo`}
              type="file"
              onChange={handleArchivoChange}
              className="sr-only"
            />
            <div
              onClick={() => archivoInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center gap-xs rounded-sm border-2 border-dashed border-border-strong bg-surface-soft px-lg py-xl text-center"
            >
              <InlineIcon size={32}>{iconSubirArchivo}</InlineIcon>
              <span className="font-body text-[13px]">
                <span className="font-semibold text-primary">Subir un archivo</span>{' '}
                <span className="text-muted">o arrastrar y soltar</span>
              </span>
              <span className="font-body text-[11px] text-muted">PDF, JPG o PNG hasta 10MB</span>
            </div>
            {values.archivo && (
              <span className="font-body text-xs text-muted">
                {values.archivo.nombre} (cargado {values.archivo.cargadoEn})
              </span>
            )}
            {/* tasks.md 5.1, design.md D5/D13#1 — el cartel más importante del change: el
                archivo elegido todavía no se sube ni se guarda contra la base real (una sola
                columna `archivo_url`, y sin código de subida). Un único cartel agrupa esta
                advertencia con la de "archivo único" preexistente — mismo campo, mismo grupo
                temático. */}
            <AvisoModeloDatos>
              El archivo que subís acá <strong>todavía no se guarda en el servidor</strong>: por
              ahora queda solo en tu navegador, así que si volvés más tarde a este presupuesto no
              lo vas a encontrar. Subir el archivo de verdad va a llegar en un cambio aparte.
              Además, el modelo real (docx) tiene un solo archivo por presupuesto, no un checklist
              multi-documento.
            </AvisoModeloDatos>
          </div>
        </div>

        {/* Vigencia (tasks.md 8.2, design.md D1, Discrepancia 1): a propósito separada — con su
            propio encabezado, línea divisoria y AvisoModeloDatos — de "Fecha de emisión" de más
            arriba. Confundir las dos es exactamente el malentendido que originó el pedido de
            Andrea (un presupuesto puede emitirse el 30/12 y valer recién desde febrero), así que
            nunca van adyacentes ni bajo el mismo título. */}
        <div className="md:col-span-2 mt-md border-t border-border pt-md">
          <FieldGroupHeading>Vigencia del presupuesto</FieldGroupHeading>
          <AvisoModeloDatos>
            El período de vigencia (desde/hasta) no está en el modelo real (docx original, que
            solo modela <code>Monto</code> + <code>Archivo</code>): registra el período que cubre
            este presupuesto, <strong>independiente</strong> de cuándo se emitió.
          </AvisoModeloDatos>
          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <Field label="Vigente desde" htmlFor={`${formId}-vigencia-desde`}>
              <Input
                id={`${formId}-vigencia-desde`}
                type="date"
                density="comfortable"
                value={values.vigenciaDesde ?? ''}
                onChange={(event) => setValues((prev) => ({ ...prev, vigenciaDesde: event.target.value || undefined }))}
              />
            </Field>
            <Field label="Vigente hasta" htmlFor={`${formId}-vigencia-hasta`} error={errors.vigenciaHasta}>
              <Input
                id={`${formId}-vigencia-hasta`}
                type="date"
                density="comfortable"
                value={values.vigenciaHasta ?? ''}
                onChange={(event) => setValues((prev) => ({ ...prev, vigenciaHasta: event.target.value || undefined }))}
              />
            </Field>
          </div>
        </div>

        {/* Datos del formulario de la obra social (tasks.md 8.3/8.4/8.5, design.md D2/D3,
            Discrepancias 3 y 4): CD/SD + el bloque de traslado que hoy solo existe en el papel
            que completa la obra social. */}
        <div className="md:col-span-2 mt-md border-t border-border pt-md">
          <FieldGroupHeading>Datos del formulario de la obra social</FieldGroupHeading>
          <AvisoModeloDatos>
            Este bloque (dependencia y los datos de traslado) no está en el modelo real (docx
            original): replica el formulario en papel que hoy completa la obra social, para no
            perder ese dato en el sistema.
          </AvisoModeloDatos>

          {/* CD/SD (tasks.md 8.3, design.md D3): mismo patrón de checkbox nativo + label que
              VehiculoForm/ConductorForm ("Fuera de servicio") — el design system no tiene un
              componente de checkbox propio, este es el que el repo ya reusa en todos lados. */}
          <label
            htmlFor={`${formId}-con-dependencia`}
            className="mb-md flex w-fit items-center gap-sm font-body text-[13px] text-text"
          >
            <input
              id={`${formId}-con-dependencia`}
              type="checkbox"
              checked={values.conDependencia ?? false}
              onChange={(event) => setValues((prev) => ({ ...prev, conDependencia: event.target.checked }))}
            />
            Con dependencia (CD)
          </label>

          {/* Botón "Traer de los destinos habituales" (tasks.md 8.5, design.md D2): copy-on-create
              — nunca deja de mostrarse, el motivo de deshabilitado siempre queda visible al lado
              (spec "Paciente sin destinos habituales": "no se oculta, para que la usuaria sepa que
              la función existe"). */}
          <div className="mb-md flex flex-wrap items-center gap-sm">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={motivoDeshabilitadoTraerDestinos !== null}
              onClick={handleTraerDestinosHabituales}
            >
              Traer de los destinos habituales del paciente
            </Button>
            {motivoDeshabilitadoTraerDestinos && (
              <span className="font-body text-xs text-muted">{motivoDeshabilitadoTraerDestinos}</span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-md md:grid-cols-2">
            <Field label="Origen (ida)" htmlFor={`${formId}-origen-ida`}>
              <Input
                id={`${formId}-origen-ida`}
                density="comfortable"
                value={datosTraslado.origenIda ?? ''}
                onChange={(event) => setDatosTraslado({ origenIda: event.target.value || undefined })}
              />
            </Field>
            <Field label="Destino (ida)" htmlFor={`${formId}-destino-ida`}>
              <Input
                id={`${formId}-destino-ida`}
                density="comfortable"
                value={datosTraslado.destinoIda ?? ''}
                onChange={(event) => setDatosTraslado({ destinoIda: event.target.value || undefined })}
              />
            </Field>
            <Field label="Origen (vuelta)" htmlFor={`${formId}-origen-vuelta`}>
              <Input
                id={`${formId}-origen-vuelta`}
                density="comfortable"
                value={datosTraslado.origenVuelta ?? ''}
                onChange={(event) => setDatosTraslado({ origenVuelta: event.target.value || undefined })}
              />
            </Field>
            <Field label="Destino (vuelta)" htmlFor={`${formId}-destino-vuelta`}>
              <Input
                id={`${formId}-destino-vuelta`}
                density="comfortable"
                value={datosTraslado.destinoVuelta ?? ''}
                onChange={(event) => setDatosTraslado({ destinoVuelta: event.target.value || undefined })}
              />
            </Field>
            <Field label="Horario de entrada" htmlFor={`${formId}-horario-entrada`}>
              <Input
                id={`${formId}-horario-entrada`}
                type="time"
                density="comfortable"
                value={datosTraslado.horarioEntrada ?? ''}
                onChange={(event) => setDatosTraslado({ horarioEntrada: event.target.value || undefined })}
              />
            </Field>
            <Field label="Horario de salida" htmlFor={`${formId}-horario-salida`}>
              <Input
                id={`${formId}-horario-salida`}
                type="time"
                density="comfortable"
                value={datosTraslado.horarioSalida ?? ''}
                onChange={(event) => setDatosTraslado({ horarioSalida: event.target.value || undefined })}
              />
            </Field>
            <Field label="Km (ida)" htmlFor={`${formId}-km-ida`}>
              <Input
                id={`${formId}-km-ida`}
                type="number"
                min={0}
                step="0.01"
                density="comfortable"
                value={datosTraslado.kmIda ?? ''}
                onChange={(event) =>
                  setDatosTraslado({ kmIda: event.target.value === '' ? undefined : Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Km (vuelta)" htmlFor={`${formId}-km-vuelta`}>
              <Input
                id={`${formId}-km-vuelta`}
                type="number"
                min={0}
                step="0.01"
                density="comfortable"
                value={datosTraslado.kmVuelta ?? ''}
                onChange={(event) =>
                  setDatosTraslado({ kmVuelta: event.target.value === '' ? undefined : Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Días mensuales negociados con la obra social" htmlFor={`${formId}-dias-mensuales`}>
              <Input
                id={`${formId}-dias-mensuales`}
                type="number"
                min={0}
                density="comfortable"
                value={datosTraslado.diasMensuales ?? ''}
                onChange={(event) =>
                  setDatosTraslado({ diasMensuales: event.target.value === '' ? undefined : Number(event.target.value) })
                }
              />
            </Field>
          </div>

          <div className="mt-md flex flex-col gap-xs">
            <span className="font-body text-[12px] font-semibold text-muted">Días de la semana</span>
            <div className="flex flex-wrap gap-xs">
              {DIAS_SEMANA_OPCIONES.map((opcion) => (
                <label
                  key={opcion.value}
                  htmlFor={`${formId}-dia-${opcion.value}`}
                  className="flex items-center gap-xs rounded-sm border border-border px-md py-xs font-body text-[13px] text-text"
                >
                  <input
                    id={`${formId}-dia-${opcion.value}`}
                    type="checkbox"
                    checked={datosTraslado.diasSemana.includes(opcion.value)}
                    onChange={() => toggleDiaSemana(opcion.value)}
                  />
                  {opcion.label}
                </label>
              ))}
            </div>
          </div>

          {/* Viajes/km mensuales calculados en vivo (tasks.md 8.4, design.md D4): mismo espíritu
              que el total de PresupuestoLineasEditor — read-only, nunca se persiste
              (calculoViajes.ts). */}
          <div className="mt-md flex items-center justify-between gap-sm border-t border-border pt-sm">
            <span className="font-body text-[13px] font-semibold text-ink">Viajes / km mensuales (calculado)</span>
            <span className="font-mono text-[14px] font-bold text-ink">
              {viajesYKmMensuales ? `${viajesYKmMensuales.viajes} viajes · ${viajesYKmMensuales.km} km` : '—'}
            </span>
          </div>
        </div>
      </div>
      </CamposSoloLectura>

      <div className="flex justify-end gap-sm">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" requiereEscritura disabled={bloqueadoSinObraSocial}>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </CardForm>
  );
}
