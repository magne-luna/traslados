import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert, EmptyState } from '../../design-system/feedback';
import { Field, Select } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import { Stepper, type StepperStep } from '../../design-system/stepper';
import type { AsistenciaPrestacion, Factura } from '../../shared/types/factura';
import type { CupoAutorizado } from '../../shared/types/presupuesto';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import type { PresupuestoRepository } from '../../shared/lib/presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../../shared/lib/presupuestos/AutorizacionRepository';
import { AlertaCupo } from './AlertaCupo';
import { AlertaMontoAutorizado } from './AlertaMontoAutorizado';
import { AsistenciasEditor } from './AsistenciasEditor';
import { DiasFacturablesSelector } from './DiasFacturablesSelector';
import { FacturaFormDatosBasicos } from './FacturaFormDatosBasicos';
import { FacturaFormEconomicos } from './FacturaFormEconomicos';
import { ResumenPasoWizard } from './ResumenPasoWizard';
import { SeccionPlegable } from './SeccionPlegable';
import { autorizacionesPendientes, type AutorizacionPendiente } from '../../shared/lib/facturacion/autorizacionesPendientes';
import { construirDatosDescripcion } from '../../shared/lib/facturacion/construirDatosDescripcion';
import { TIPO_COMPROBANTE_DEFAULT } from '../../shared/lib/facturacion/constantes';
import { calcularTotalFactura } from '../../shared/lib/facturacion/totalesFactura';
import { cupoConsumido } from '../../shared/lib/facturacion/cupoConsumido';
import { etiquetaAutorizacion, prestacionRealAutorizacion } from '../../shared/lib/facturacion/etiquetaAutorizacion';
import { montoConsumido } from '../../shared/lib/facturacion/montoConsumido';
import { renderDescripcionFactura } from '../../shared/lib/facturacion/renderDescripcionFactura';
import { validarCupoFacturacion } from '../../shared/lib/facturacion/validarCupoFacturacion';
import { validarMontoAutorizado } from '../../shared/lib/facturacion/validarMontoAutorizado';
import { validateFacturaForm, type FacturaFormErrors } from './validateFacturaForm';

export type FacturaFormValues = Omit<Factura, 'id' | 'estado' | 'identificadorFactura' | 'fechaFactura' | 'fechaEstimadaCobro'>;

function valoresPorDefecto(): FacturaFormValues {
  const ahora = new Date();
  return {
    pacienteId: '',
    descripcion: '',
    dias: 0,
    valorKm: 0,
    monto: 0,
    fechaInicial: ahora.toISOString().slice(0, 10),
    fechaTope: ahora.toISOString().slice(0, 10),
    tipoComprobante: TIPO_COMPROBANTE_DEFAULT,
    cantidadKm: 0,
    prestacion: '',
    mesFacturado: ahora.getMonth() + 1,
    anioFacturado: ahora.getFullYear(),
    dependenciaYRetorno: '',
    domicilioId: '',
    asistencias: [],
  };
}

interface FacturaFormProps {
  initial?: FacturaFormValues;
  /** Solo lectura (design.md Decisión 15): puebla el selector de paciente. */
  pacientes: Paciente[];
  /** Solo lectura: resuelve la plantilla de descripción del paciente. */
  obrasSociales: ObraSocial[];
  /** Todas las facturas existentes (para validar cupo del período, excluyendo la propia). */
  facturasExistentes: Factura[];
  facturaIdEnEdicion: string | null;
  /** Catálogo de feriados inyectado — ver feriadosFixture.ts. */
  feriados: string[];
  /** Insumo del Paso 2 (change `facturacion-seleccion-autorizacion`, design.md D3): reusados tal
   * cual para derivar `autorizacionesPendientes(pacienteId, ...)`, sin métodos nuevos. */
  presupuestoRepository: PresupuestoRepository;
  autorizacionRepository: AutorizacionRepository;
  /** Resuelve el CupoAutorizado de la autorización ELEGIDA (change `facturacion-seleccion-autorizacion`,
   * design.md D6): ya no adivina — recibe también `autorizacionId`. Sin autorización elegida
   * (facturas anteriores a este change) resuelve `undefined`. */
  resolverCupoAutorizado: (pacienteId: string, autorizacionId: string | undefined) => Promise<CupoAutorizado | undefined>;
  /** `true` mientras la factura sigue en `a-facturar` (design.md Decisión 5, tasks.md 7.6): solo
   * en ese estado se muestra la vista previa en vivo — una vez emitida, la descripción está
   * congelada y no se recalcula. Default `true` (alta de una factura nueva). */
  esBorrador?: boolean;
  onSubmit: (values: FacturaFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

const labelClasses = 'font-body text-[12px] font-semibold text-muted';

// Pasos del wizard de alta (change `facturacion-wizard-paciente-prestador`, design.md): Paciente
// → Obra social/Prestador → el resto del formulario. Solo se usa en modo alta (ver `esEdicion`
// más abajo) — en edición el wizard se saltea por completo.
const PASOS_WIZARD: StepperStep[] = [
  { label: 'Paciente' },
  { label: 'Autorización' },
  { label: 'Datos de la factura' },
];

// Formulario de alta/edición de factura (tasks.md 7.1 a 7.6): selector de paciente y de domicilio
// inyectados (guardan solo el id), período estructurado (design.md Decisión 4), económicos con
// valor del km de carga manual (RN-FA-05), tipo de comprobante con default fijo, siempre editable
// a mano (RN-FA-07 — ver TIPO_COMPROBANTE_DEFAULT), asistencias embebidas (AsistenciasEditor, RN-FA-01), días facturables
// sugeridos (DiasFacturablesSelector) y alerta de cupo persistente (AlertaCupo). Componentes
// pesados extraídos aparte para mantenerse bajo las ~200 líneas (tasks.md 12.3).
//
// Migrado a CardForm/Alert (tasks.md 16.2, design.md Decisión 4/5): CardForm con sus defaults
// (radius='sm', padding='lg', gap='md') reproduce `rounded-sm border border-border bg-surface
// p-lg` + `gap-md` byte a byte; Alert(tone="danger") default reproduce la caja de error actual.
// `labelClasses` sigue local: las dos leyendas de acá abajo ("Días facturables sugeridos",
// "Asistencias / prestaciones declaradas") son `<span>` sueltos sin `htmlFor` — no son labels de
// un control (Label del design system exige htmlFor y renderiza <label>) — cambiar el tag
// cambiaría la semántica, y no está pedido por 16.2.
//
// Wizard de 3 pasos en modo alta (change `facturacion-wizard-paciente-prestador`, design.md,
// aprobado por Enzo): el mismo `values`/`set`/lógica de siempre, solo se reorganiza DÓNDE se
// renderiza cada bloque. `esEdicion` (Boolean(initial?.pacienteId)) decide entre dos modos de
// render sobre el MISMO árbol de contenido (`pasoPacienteContent`/`pasoObraSocialContent`/
// `pasoRestoContent`, definidos más abajo):
//   - Alta (sin `initial`): wizard real — un paso visible a la vez, `paso` (estado local) avanza
//     con "Siguiente" (Paso 1→2 requiere `pacienteId`; Paso 2→3 requiere `values.autorizacionId` —
//     change `facturacion-seleccion-autorizacion`, design.md D4, reemplaza al gateo por datos de
//     prestador `faltaCompletarPrestador` retirado en D5) y retrocede con "Atrás", sin perder nada
//     de `values` (el estado vive en el componente, no en el paso visible).
//   - Edición (`initial?.pacienteId` truthy): el wizard se saltea por completo — se renderizan los
//     tres bloques juntos, sin Stepper ni botones de navegación, igual que el formulario plano de
//     antes de este change. No tiene sentido forzar el flujo guiado cuando paciente/obra social ya
//     están resueltos de entrada; el wizard existe para el caso "no sé todavía qué paciente es",
//     que en edición no aplica.
export function FacturaForm({
  initial,
  pacientes,
  obrasSociales,
  facturasExistentes,
  facturaIdEnEdicion,
  feriados,
  presupuestoRepository,
  autorizacionRepository,
  resolverCupoAutorizado,
  esBorrador = true,
  onSubmit,
  onCancel,
  submitting = false,
  submitError = null,
}: FacturaFormProps) {
  const [values, setValues] = useState<FacturaFormValues>(initial ?? valoresPorDefecto());
  const [errors, setErrors] = useState<FacturaFormErrors>({});
  const [cupo, setCupo] = useState<CupoAutorizado | undefined>(undefined);
  // Autorizaciones pendientes del paciente elegido (D3/D4, tasks.md 2.6/3.1): `null` = todavía no
  // se resolvió (o no hay paciente elegido) — distinto de `[]` (resuelto, sin resultados), que
  // dispara el estado vacío bloqueante.
  const [autorizaciones, setAutorizaciones] = useState<AutorizacionPendiente[] | null>(null);
  const formId = useId();

  // Editar una factura existente saltea el wizard (ver comentario de arriba del componente):
  // arranca directo en el último paso, con todo visible. Nunca cambia durante la vida del
  // componente (depende solo de la prop `initial` con la que se montó).
  const esEdicion = Boolean(initial?.pacienteId);
  const [paso, setPaso] = useState<0 | 1 | 2>(esEdicion ? 2 : 0);

  // Secciones colapsables del Paso 3 / modo edición (integración del prototipo "Plegable +
  // calendario", 2026-08-05, feedback de la usuaria sobre el formulario ya completo): arrancan
  // abiertas para no cambiar lo que se ve al montar — colapsar es una acción del operador, nunca
  // el estado inicial, así que ningún test ni comportamiento existente necesita interactuar para
  // ver un campo por primera vez.
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({ datos: true, dias: true, asistencias: true });
  function toggleSeccion(key: keyof typeof seccionesAbiertas) {
    setSeccionesAbiertas((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const paciente = pacientes.find((p) => p.id === values.pacienteId);
  const obraSocial = obrasSociales.find((o) => o.id === paciente?.obraSocialId);

  useEffect(() => {
    let cancelled = false;
    resolverCupoAutorizado(values.pacienteId, values.autorizacionId).then((resultado) => {
      if (!cancelled) setCupo(resultado);
    });
    return () => {
      cancelled = true;
    };
  }, [values.pacienteId, values.autorizacionId, resolverCupoAutorizado]);

  // Autorizaciones pendientes del paciente elegido (D3, insumo del Paso 2 — D4): se resuelve en
  // cuanto hay `pacienteId`, sin esperar a llegar al Paso 2, para no hacerle esperar al operador.
  useEffect(() => {
    if (!values.pacienteId) {
      setAutorizaciones(null);
      return;
    }
    let cancelled = false;
    autorizacionesPendientes(values.pacienteId, presupuestoRepository, autorizacionRepository).then((resultado) => {
      if (!cancelled) setAutorizaciones(resultado);
    });
    return () => {
      cancelled = true;
    };
  }, [values.pacienteId, presupuestoRepository, autorizacionRepository]);

  const autorizacionSeleccionada = autorizaciones?.find((item) => item.autorizacion.id === values.autorizacionId);
  const autorizacionLabel = autorizacionSeleccionada ? etiquetaAutorizacion(autorizacionSeleccionada, paciente) : undefined;
  // Gateo del Paso 2 en modo alta (D4): bloqueado mientras no se resolvió la lista, si está vacía,
  // o si todavía no se eligió ninguna. En edición el paso no bifurca (D4) — nunca bloquea acá.
  const bloqueaAutorizacion = autorizaciones === null || autorizaciones.length === 0 || !values.autorizacionId;

  // Derivar "Prestación" desde la autorización elegida (feature `facturacion-derivar-prestacion`):
  // reusa `prestacionRealAutorizacion` (mismo criterio de resolución que ya usa
  // `etiquetaAutorizacion` en el selector del Paso 2) — solo modalidad `por-prestacion` resuelve
  // una `Prestacion` real; `general` (o un catálogo desactualizado) devuelve `undefined` y el
  // campo sigue siendo texto libre, sin ningún cambio de comportamiento.
  const prestacionDerivada = autorizacionSeleccionada ? prestacionRealAutorizacion(autorizacionSeleccionada, paciente) : undefined;

  useEffect(() => {
    if (!prestacionDerivada) return;
    setValues((prev) => (prev.prestacion === prestacionDerivada.nombre ? prev : { ...prev, prestacion: prestacionDerivada.nombre }));
    // Re-deriva cada vez que cambia la autorización elegida (o el paciente/catálogo detrás de
    // ella) — nunca queda pegado al valor de una autorización anterior.
  }, [values.autorizacionId, prestacionDerivada]);

  const resultadoCupo = useMemo(() => {
    const consumido = cupoConsumido(facturasExistentes, values.pacienteId, values.mesFacturado, values.anioFacturado, {
      excluirFacturaId: facturaIdEnEdicion ?? undefined,
    });
    return validarCupoFacturacion({
      diasFacturados: consumido.dias + values.dias,
      kmFacturados: consumido.km + values.cantidadKm,
      cupo,
    });
  }, [facturasExistentes, values.pacienteId, values.mesFacturado, values.anioFacturado, values.dias, values.cantidadKm, facturaIdEnEdicion, cupo]);

  // Validación de monto autorizado ANUAL (fix directo, corrección del usuario a mitad de la tarea
  // original — `Autorizacion.montoAutorizado` es un tope del AÑO, no de una sola factura): solo
  // aplica cuando hay `autorizacionId` elegido — facturas legacy sin autorización asociada no
  // tienen contra qué validar.
  const resultadoMonto = useMemo(() => {
    if (!values.autorizacionId) return null;
    const consumido = montoConsumido(facturasExistentes, values.autorizacionId, values.anioFacturado, {
      excluirFacturaId: facturaIdEnEdicion ?? undefined,
    });
    const montoNuevo = calcularTotalFactura({ dias: values.dias, cantidadKm: values.cantidadKm, valorKm: values.valorKm });
    return validarMontoAutorizado({
      montoConsumidoAnual: consumido,
      montoNuevo,
      montoAutorizado: autorizacionSeleccionada?.autorizacion.montoAutorizado,
    });
  }, [
    facturasExistentes,
    values.autorizacionId,
    values.anioFacturado,
    values.dias,
    values.cantidadKm,
    values.valorKm,
    facturaIdEnEdicion,
    autorizacionSeleccionada,
  ]);

  // Vista previa de la descripción (change `facturacion-seleccion-autorizacion`, design.md D4/D5):
  // ya no depende de ningún dato de prestador (`faltaCompletarPrestador` se retiró junto con
  // `prestadorNombre`/`prestadorDomicilio`, D5) — arma apenas hay paciente + obra social, igual en
  // las dos modalidades, sin esperar a que se elija una autorización.
  const previaDescripcion =
    esBorrador && obraSocial && paciente
      ? renderDescripcionFactura(obraSocial.plantillaFactura, construirDatosDescripcion(values, paciente))
      : null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateFacturaForm({
      pacienteId: values.pacienteId || null,
      mesFacturado: values.mesFacturado,
      anioFacturado: values.anioFacturado,
      valorKm: values.valorKm,
      dias: values.dias,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  function set<K extends keyof FacturaFormValues>(key: K, value: FacturaFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  // Paso 1 — Paciente (design.md): antes vivía como primer campo de FacturaFormDatosBasicos, se
  // mudó acá para que sea lo único visible hasta elegirlo. Gateado igual que el resto de los
  // campos de escritura (gateo-facturacion) — antes quedaba cubierto por el envoltorio único que
  // rodeaba DatosBasicos+Economicos; al separarse en pasos, cada paso gatea su propio contenido.
  const pasoPacienteContent: ReactNode = (
    <CamposSoloLectura>
      <Field label="Paciente" htmlFor={`${formId}-paciente`} error={errors.pacienteId}>
        <Select id={`${formId}-paciente`} value={values.pacienteId} onChange={(e) => set('pacienteId', e.target.value)}>
          <option value="">Seleccionar paciente…</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
          ))}
        </Select>
      </Field>
    </CamposSoloLectura>
  );

  // Paso 2 — Autorización (design.md de `facturacion-seleccion-autorizacion`, D4/D5): la obra
  // social se muestra de solo lectura (se deriva del paciente elegido en el Paso 1, no es un
  // campo editable acá). Los dos campos de texto libre de prestador (change `sacar-prestadores`,
  // que a su vez revertía `factura-por-prestador`) se retiraron por completo — no tenían columna
  // real en producción (D5). En su lugar, un selector de las autorizaciones PENDIENTES del
  // paciente elegido (`autorizacionesPendientes`, D3): estado vacío bloqueante si no hay ninguna
  // (con link a Presupuestos), y en modo edición la autorización ya persistida se muestra de solo
  // lectura — no se puede recambiar (D4: "la edición no bifurca").
  const pasoObraSocialContent: ReactNode = (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <span className={labelClasses}>Obra social</span>
        <p className="m-0 font-body text-[13px] text-text">
          {obraSocial ? obraSocial.nombre : 'El paciente elegido no tiene una obra social asociada.'}
        </p>
      </div>

      <div className="flex flex-col gap-xs">
        <span className={labelClasses}>Autorización</span>
        {esEdicion ? (
          <p className="m-0 font-body text-[13px] text-text">
            {autorizacionLabel ??
              (values.autorizacionId ? 'No se pudo resolver la autorización elegida.' : 'Esta factura no tiene una autorización asociada.')}
          </p>
        ) : autorizaciones === null ? (
          <p className="m-0 font-body text-[13px] text-muted">Buscando autorizaciones pendientes…</p>
        ) : autorizaciones.length === 0 ? (
          <EmptyState
            message="Este paciente no tiene autorizaciones pendientes de facturar. Cargalas desde Presupuestos antes de emitir la factura."
            action={
              <a href="/presupuestos" className="font-body text-[13px] font-semibold text-primary">
                Ir a Presupuestos
              </a>
            }
          />
        ) : (
          <CamposSoloLectura>
            <Field label="Autorización" htmlFor={`${formId}-autorizacion`}>
              <Select
                id={`${formId}-autorizacion`}
                value={values.autorizacionId ?? ''}
                onChange={(e) => set('autorizacionId', e.target.value || undefined)}
              >
                <option value="">Seleccionar autorización…</option>
                {autorizaciones.map((item) => (
                  <option key={item.autorizacion.id} value={item.autorizacion.id}>
                    {etiquetaAutorizacion(item, paciente)}
                  </option>
                ))}
              </Select>
            </Field>
          </CamposSoloLectura>
        )}
      </div>
    </div>
  );

  // Paso 3 — el resto (design.md): todo lo que ya existía antes de este change, sin tocar qué
  // computa ni cómo se gatea — solo se agrupó en un único bloque reusable entre el wizard (alta)
  // y la vista plana (edición). `gateo-facturacion` (design.md D3, tasks.md 4.3): una sola
  // inserción sigue cubriendo los dos bloques de campos (FacturaFormDatosBasicos +
  // FacturaFormEconomicos) — ninguno de los dos recibe una prop nueva por este change. Las
  // acciones no-CRUD de abajo (DiasFacturablesSelector, AsistenciasEditor) se gatean por separado
  // en sus propios componentes (design.md D2, tasks.md sección 5) — este envoltorio NO las cubre.
  // Paso 3 (y edición) en la misma línea de concepto que los Pasos 1-2 (integración
  // 2026-08-05, feedback de la usuaria: "quiero mantener el wizard como está, integremos el
  // paso 3 con esa misma línea de concepto"): dos columnas, campos a la izquierda (siguen
  // organizados en `SeccionPlegable` — acá SÍ hay varios grupos de campos que declutterear,
  // a diferencia de los Pasos 1-2 que eran un único campo) y `ResumenPasoWizard` a la derecha,
  // ahora con `datosFactura` para mostrar días/total — el mismo panel que ya acompañaba
  // paciente/obra social/prestador, sin duplicar otro componente de resumen. `AlertaCupo` y la
  // vista previa se mudan a esa columna (antes vivían sueltas en el flujo de la izquierda).
  const pasoRestoContent: ReactNode = (
    <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-md">
        <SeccionPlegable
          titulo="Datos de la factura"
          resumen={`Comprobante ${values.tipoComprobante} · $${values.monto.toLocaleString('es-AR')}`}
          abierta={seccionesAbiertas.datos}
          onToggle={() => toggleSeccion('datos')}
        >
          <CamposSoloLectura>
            <div className="grid grid-cols-1 gap-md md:grid-cols-2">
              <FacturaFormDatosBasicos
                formId={formId}
                values={values}
                errors={errors}
                paciente={paciente}
                set={set}
                prestacionBloqueada={prestacionDerivada !== undefined}
              />

              <FacturaFormEconomicos formId={formId} values={values} errors={errors} set={set} />
            </div>
          </CamposSoloLectura>
        </SeccionPlegable>

        <SeccionPlegable
          titulo="Días facturables sugeridos"
          resumen={`${values.dias} días seleccionados`}
          abierta={seccionesAbiertas.dias}
          onToggle={() => toggleSeccion('dias')}
        >
          {values.pacienteId && (
            <DiasFacturablesSelector
              mes={values.mesFacturado}
              anio={values.anioFacturado}
              feriados={feriados}
              facturaSabados={values.asistencias.some((a) => a.facturaSabados)}
              onChange={(dias) => set('dias', dias.length)}
            />
          )}
        </SeccionPlegable>

        <SeccionPlegable
          titulo="Asistencias / prestaciones declaradas"
          resumen={`${values.asistencias.length} cargadas`}
          abierta={seccionesAbiertas.asistencias}
          onToggle={() => toggleSeccion('asistencias')}
        >
          <AsistenciasEditor asistencias={values.asistencias} onChange={(asistencias: AsistenciaPrestacion[]) => set('asistencias', asistencias)} />
        </SeccionPlegable>
      </div>

      <div className="flex flex-col gap-md lg:sticky lg:top-xl lg:self-start">
        <ResumenPasoWizard
          paciente={paciente}
          obraSocial={obraSocial}
          autorizacionLabel={autorizacionLabel}
          datosFactura={{ dias: values.dias, total: values.monto }}
        />
        <AlertaCupo resultado={resultadoCupo} />
        {resultadoMonto !== null && <AlertaMontoAutorizado resultado={resultadoMonto} />}
        {previaDescripcion !== null && (
          <div className="flex flex-col gap-xs rounded-sm border border-border bg-surface-soft p-md">
            <span className={labelClasses}>Vista previa de la descripción</span>
            <pre className="m-0 whitespace-pre-wrap font-body text-[12px] text-text">{previaDescripcion}</pre>
          </div>
        )}
      </div>
    </div>
  );

  // Cancelar/Guardar: mismo botón de siempre, solo se movió a un fragmento separado de
  // `pasoRestoContent` porque en edición (todo el form visible junto) y en el Paso 3 del wizard
  // (alta) es el único lugar donde aparece — nunca en los Pasos 1/2, que solo tienen
  // "Siguiente"/"Atrás".
  const accionesFinales: ReactNode = (
    <div className="flex items-center justify-end gap-sm">
      <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
      <Button type="submit" variant="primary" requiereEscritura>{submitting ? 'Guardando…' : 'Guardar'}</Button>
    </div>
  );

  return (
    <CardForm onSubmit={handleSubmit}>
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {esEdicion ? (
        <>
          {pasoPacienteContent}
          {pasoObraSocialContent}
          {pasoRestoContent}
          {accionesFinales}
        </>
      ) : (
        <>
          <Stepper steps={PASOS_WIZARD} currentStep={paso} />

          {/* Pasos 1 y 2 (integración "Con contexto", 2026-08-05): a diferencia del Paso 3 y de
              edición (donde la card ya está llena de campos), acá el paso trae un único bloque
              angosto — sin este layout de dos columnas, ese bloque se estira a todo el ancho de
              la card y queda vacío. La columna derecha (`ResumenPasoWizard`) llena ese espacio
              con lo que ya se sabe de la factura en vez de dejarlo en blanco. Nunca se usa en
              edición: ahí `pasoPacienteContent`/`pasoObraSocialContent` siguen renderizando
              planos, como siempre. */}
          {paso === 0 && (
            <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,320px)_1fr]">
              <div className="flex flex-col gap-md">
                {pasoPacienteContent}
                <div className="flex items-center justify-end">
                  <Button variant="primary" disabled={!values.pacienteId} onClick={() => setPaso(1)}>Siguiente</Button>
                </div>
              </div>
              <ResumenPasoWizard paciente={paciente} obraSocial={obraSocial} />
            </div>
          )}

          {paso === 1 && (
            <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,320px)_1fr]">
              <div className="flex flex-col gap-md">
                {pasoObraSocialContent}
                <div className="flex items-center justify-between gap-sm">
                  <Button variant="secondary" onClick={() => setPaso(0)}>Atrás</Button>
                  <Button variant="primary" disabled={bloqueaAutorizacion} onClick={() => setPaso(2)}>Siguiente</Button>
                </div>
              </div>
              <ResumenPasoWizard paciente={paciente} obraSocial={obraSocial} autorizacionLabel={autorizacionLabel} />
            </div>
          )}

          {paso === 2 && (
            <>
              {pasoRestoContent}
              <div className="flex items-center justify-between gap-sm">
                <Button variant="secondary" onClick={() => setPaso(1)}>Atrás</Button>
                {accionesFinales}
              </div>
            </>
          )}
        </>
      )}
    </CardForm>
  );
}
