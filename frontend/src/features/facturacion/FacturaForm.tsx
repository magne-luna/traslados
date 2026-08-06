import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Select } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import { Stepper, type StepperStep } from '../../design-system/stepper';
import type { AsistenciaPrestacion, Factura } from '../../shared/types/factura';
import type { CupoAutorizado } from '../../shared/types/presupuesto';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import { AlertaCupo } from './AlertaCupo';
import { AsistenciasEditor } from './AsistenciasEditor';
import { DiasFacturablesSelector } from './DiasFacturablesSelector';
import { FacturaFormDatosBasicos } from './FacturaFormDatosBasicos';
import { FacturaFormEconomicos } from './FacturaFormEconomicos';
import { ResumenPasoWizard } from './ResumenPasoWizard';
import { SeccionPlegable } from './SeccionPlegable';
import { construirDatosDescripcion } from '../../shared/lib/facturacion/construirDatosDescripcion';
import { TIPO_COMPROBANTE_DEFAULT } from '../../shared/lib/facturacion/constantes';
import { cupoConsumido } from '../../shared/lib/facturacion/cupoConsumido';
import { renderDescripcionFactura } from '../../shared/lib/facturacion/renderDescripcionFactura';
import { validarCupoFacturacion } from '../../shared/lib/facturacion/validarCupoFacturacion';
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
  /** Resuelve el CupoAutorizado del paciente vía PresupuestoRepository + AutorizacionRepository +
   * derivarCupoAutorizado (tasks.md 8.2) — sin reimplementar la derivación acá. */
  resolverCupoAutorizado: (pacienteId: string) => Promise<CupoAutorizado | undefined>;
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
  { label: 'Obra social / Prestador' },
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
//     con "Siguiente" (gateado: Paso 1→2 requiere `pacienteId`, Paso 2→3 requiere completar
//     nombre y domicilio del prestador cuando `obraSocial.modalidadFacturacion ===
//     'por-prestacion'`, ver `faltaCompletarPrestador` más abajo — misma variable que gatea la
//     vista previa) y retrocede con "Atrás", sin perder nada de `values` (el estado vive en el
//     componente, no en el paso visible).
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
    resolverCupoAutorizado(values.pacienteId).then((resultado) => {
      if (!cancelled) setCupo(resultado);
    });
    return () => {
      cancelled = true;
    };
  }, [values.pacienteId, resolverCupoAutorizado]);

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

  // Gateo por datos del prestador (change `sacar-prestadores`, design.md D2 — revierte
  // `factura-por-prestador`): en modalidad "por-prestacion" la plantilla NO se arma hasta
  // completar nombre Y domicilio del prestador (texto libre, sin entidad) — es el paso previo, no
  // un dato más de la descripción. En "general" no cambia nada (sin nada que completar, se
  // comporta como siempre). Reutilizada por el wizard (más abajo) para gatear "Siguiente" del
  // Paso 2→3: en alta, nunca se llega al Paso 3 (donde vive la vista previa) sin haber completado
  // ambos campos cuando la modalidad lo exige, así que en ese modo esta bandera siempre da
  // `false` una vez visible el Paso 3. Sigue pudiendo dar `true` en edición (wizard salteado,
  // todo visible junto) si se borra lo ya cargado.
  const faltaCompletarPrestador =
    obraSocial?.modalidadFacturacion === 'por-prestacion' &&
    (!values.prestadorNombre?.trim() || !values.prestadorDomicilio?.trim());

  const previaDescripcion =
    esBorrador && obraSocial && paciente && !faltaCompletarPrestador
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

  // Paso 2 — Obra social / Prestador (design.md, change `sacar-prestadores` D4 — revierte
  // `factura-por-prestador`): la obra social se muestra de solo lectura (se deriva del paciente
  // elegido en el Paso 1, no es un campo editable acá) y, cuando la modalidad lo requiere, dos
  // campos de texto libre ("Nombre"/"Domicilio" del prestador que hizo la prestación) — sin
  // entidad ni repository detrás, cargados a mano por factura.
  const pasoObraSocialContent: ReactNode = (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs">
        <span className={labelClasses}>Obra social</span>
        <p className="m-0 font-body text-[13px] text-text">
          {obraSocial ? obraSocial.nombre : 'El paciente elegido no tiene una obra social asociada.'}
        </p>
      </div>

      {obraSocial?.modalidadFacturacion === 'por-prestacion' && (
        <CamposSoloLectura>
          <div className="flex flex-col gap-md">
            <Field label="Nombre" htmlFor={`${formId}-prestador-nombre`}>
              <Input
                id={`${formId}-prestador-nombre`}
                type="text"
                value={values.prestadorNombre ?? ''}
                onChange={(e) => set('prestadorNombre', e.target.value)}
              />
            </Field>
            <Field label="Domicilio" htmlFor={`${formId}-prestador-domicilio`}>
              <Input
                id={`${formId}-prestador-domicilio`}
                type="text"
                value={values.prestadorDomicilio ?? ''}
                onChange={(e) => set('prestadorDomicilio', e.target.value)}
              />
            </Field>
          </div>
        </CamposSoloLectura>
      )}
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
              <FacturaFormDatosBasicos formId={formId} values={values} errors={errors} paciente={paciente} set={set} />

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
          prestadorNombre={values.prestadorNombre}
          prestadorDomicilio={values.prestadorDomicilio}
          datosFactura={{ dias: values.dias, total: values.monto }}
        />
        <AlertaCupo resultado={resultadoCupo} />
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
              <ResumenPasoWizard paciente={paciente} obraSocial={obraSocial} prestadorNombre={values.prestadorNombre} prestadorDomicilio={values.prestadorDomicilio} />
            </div>
          )}

          {paso === 1 && (
            <div className="grid grid-cols-1 gap-xl lg:grid-cols-[minmax(0,320px)_1fr]">
              <div className="flex flex-col gap-md">
                {pasoObraSocialContent}
                <div className="flex items-center justify-between gap-sm">
                  <Button variant="secondary" onClick={() => setPaso(0)}>Atrás</Button>
                  <Button variant="primary" disabled={faltaCompletarPrestador} onClick={() => setPaso(2)}>Siguiente</Button>
                </div>
              </div>
              <ResumenPasoWizard paciente={paciente} obraSocial={obraSocial} prestadorNombre={values.prestadorNombre} prestadorDomicilio={values.prestadorDomicilio} />
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
