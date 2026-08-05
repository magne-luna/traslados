import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Select } from '../../design-system/form';
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
import { PrestadorSelector } from './PrestadorSelector';
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
// valor del km de carga manual (RN-FA-05), tipo de comprobante con default fijo provisorio
// (RN-FA-07, editable — ver TIPO_COMPROBANTE_DEFAULT, design.md D4 de prestadores-crud, SIN
// confirmar con Andrea), asistencias embebidas (AsistenciasEditor, RN-FA-01), días facturables
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
//     con "Siguiente" (gateado: Paso 1→2 requiere `pacienteId`, Paso 2→3 requiere `prestadorId`
//     cuando `obraSocial.modalidadFacturacion === 'por-prestacion'`, ver `faltaElegirPrestador`
//     más abajo — la misma variable que ya gateaba la vista previa desde `factura-por-prestador`)
//     y retrocede con "Atrás", sin perder nada de `values` (el estado vive en el componente, no en
//     el paso visible).
//   - Edición (`initial?.pacienteId` truthy): el wizard se saltea por completo — se renderizan los
//     tres bloques juntos, sin Stepper ni botones de navegación, igual que el formulario plano de
//     antes de este change. No tiene sentido forzar el flujo guiado cuando paciente/obra
//     social/prestador ya están resueltos de entrada; el wizard existe para el caso "no sé
//     todavía qué paciente/prestador es", que en edición no aplica.
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

  const paciente = pacientes.find((p) => p.id === values.pacienteId);
  const obraSocial = obrasSociales.find((o) => o.id === paciente?.obraSocialId);
  // `tipoComprobante` fijo mientras haya un Prestador elegido (change `factura-por-prestador`,
  // design.md D3): se calcula acá (no en FacturaFormEconomicos) porque depende de `prestadorId`,
  // que vive en `values` junto con el resto del form. En modalidad "general" (sin prestador)
  // `values.prestadorId` nunca se setea, así que esto queda `false` y RN-FA-07 sigue rigiendo.
  const tipoComprobanteBloqueado = Boolean(values.prestadorId);

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

  // Gateo por Prestador (change `factura-por-prestador`, design.md D5, corrección post-revisión
  // 2026-08-04): en modalidad "por-prestacion" la plantilla NO se arma hasta elegir un Prestador —
  // es el paso previo, no un dato más de la descripción. En "general" no cambia nada (sin
  // prestador que esperar, se comporta como siempre). Reutilizada por el wizard (más abajo) para
  // gatear "Siguiente" del Paso 2→3: en alta, nunca se llega al Paso 3 (donde vive la vista
  // previa) sin haber elegido prestador cuando la modalidad lo exige, así que en ese modo esta
  // bandera siempre da `false` una vez visible el Paso 3. Sigue pudiendo dar `true` en edición
  // (wizard salteado, todo visible junto) si se limpia el prestador ya elegido.
  const faltaElegirPrestador = obraSocial?.modalidadFacturacion === 'por-prestacion' && !values.prestadorId;

  const previaDescripcion =
    esBorrador && obraSocial && paciente && !faltaElegirPrestador
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

  // Paso 2 — Obra social / Prestador (design.md): la obra social se muestra de solo lectura (se
  // deriva del paciente elegido en el Paso 1, no es un campo editable acá) y `PrestadorSelector`
  // (change `factura-por-prestador`, reusado tal cual) se monta solo si la modalidad lo requiere —
  // idéntica condición que ya usaba antes dentro de FacturaFormDatosBasicos.
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
          <PrestadorSelector
            formId={formId}
            obraSocialId={obraSocial.id}
            prestadorId={values.prestadorId ?? ''}
            onChange={(prestador) => {
              set('prestadorId', prestador?.id);
              if (prestador) set('tipoComprobante', prestador.tipoComprobante);
            }}
          />
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
  const pasoRestoContent: ReactNode = (
    <>
      <CamposSoloLectura>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <FacturaFormDatosBasicos formId={formId} values={values} errors={errors} paciente={paciente} set={set} />

          <FacturaFormEconomicos formId={formId} values={values} errors={errors} tipoComprobanteBloqueado={tipoComprobanteBloqueado} set={set} />
        </div>
      </CamposSoloLectura>

      {values.pacienteId && (
        <div className="flex flex-col gap-xs">
          <span className={labelClasses}>Días facturables sugeridos</span>
          <DiasFacturablesSelector
            mes={values.mesFacturado}
            anio={values.anioFacturado}
            feriados={feriados}
            facturaSabados={values.asistencias.some((a) => a.facturaSabados)}
            onChange={(dias) => set('dias', dias.length)}
          />
        </div>
      )}

      <AlertaCupo resultado={resultadoCupo} />

      <div className="flex flex-col gap-xs">
        <span className={labelClasses}>Asistencias / prestaciones declaradas</span>
        <AsistenciasEditor asistencias={values.asistencias} onChange={(asistencias: AsistenciaPrestacion[]) => set('asistencias', asistencias)} />
      </div>

      {previaDescripcion !== null && (
        <div className="flex flex-col gap-xs rounded-sm border border-border bg-surface-soft p-md">
          <span className={labelClasses}>Vista previa de la descripción</span>
          <pre className="m-0 whitespace-pre-wrap font-body text-[12px] text-text">{previaDescripcion}</pre>
        </div>
      )}
    </>
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

          {paso === 0 && (
            <>
              {pasoPacienteContent}
              <div className="flex items-center justify-end">
                <Button variant="primary" disabled={!values.pacienteId} onClick={() => setPaso(1)}>Siguiente</Button>
              </div>
            </>
          )}

          {paso === 1 && (
            <>
              {pasoObraSocialContent}
              <div className="flex items-center justify-between gap-sm">
                <Button variant="secondary" onClick={() => setPaso(0)}>Atrás</Button>
                <Button variant="primary" disabled={faltaElegirPrestador} onClick={() => setPaso(2)}>Siguiente</Button>
              </div>
            </>
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
