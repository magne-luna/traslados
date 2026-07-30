import { useEffect, useId, useMemo, useState, type FormEvent } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { CardForm } from '../../design-system/layout';
import type { AsistenciaPrestacion, Factura } from '../../shared/types/factura';
import type { CupoAutorizado } from '../../shared/types/presupuesto';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { Paciente } from '../../shared/types/paciente';
import { AlertaCupo } from './AlertaCupo';
import { AsistenciasEditor } from './AsistenciasEditor';
import { DiasFacturablesSelector } from './DiasFacturablesSelector';
import { FacturaFormDatosBasicos } from './FacturaFormDatosBasicos';
import { FacturaFormEconomicos } from './FacturaFormEconomicos';
import { construirDatosDescripcion } from '../../shared/lib/facturacion/construirDatosDescripcion';
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
    tipoComprobante: 'A',
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
  /** Solo lectura: resuelve la plantilla y el tipo de comprobante por defecto del paciente. */
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

// Formulario de alta/edición de factura (tasks.md 7.1 a 7.6): selector de paciente y de domicilio
// inyectados (guardan solo el id), período estructurado (design.md Decisión 4), económicos con
// valor del km de carga manual (RN-FA-05), tipo de comprobante precargado desde la obra social
// (RN-FA-07, editable), asistencias embebidas (AsistenciasEditor, RN-FA-01), días facturables
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

  // Tipo de comprobante precargado desde la obra social del paciente (RN-FA-07), editable — solo
  // se aplica al elegir el paciente por primera vez en un formulario nuevo (no pisa un valor ya
  // editado a mano en una edición existente).
  useEffect(() => {
    if (initial !== undefined) return;
    if (obraSocial) setValues((prev) => ({ ...prev, tipoComprobante: obraSocial.tipoComprobante }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraSocial?.id]);

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

  return (
    <CardForm onSubmit={handleSubmit}>
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {/* gateo-facturacion (design.md D3, tasks.md 4.3): una sola inserción cubre los dos
          bloques de campos (FacturaFormDatosBasicos + FacturaFormEconomicos) — ninguno de los
          dos recibe una prop nueva. Las acciones no-CRUD de abajo (DiasFacturablesSelector,
          AsistenciasEditor) se gatean por separado en sus propios componentes (design.md D2,
          tasks.md sección 5) — este envoltorio NO las cubre. */}
      <CamposSoloLectura>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <FacturaFormDatosBasicos formId={formId} values={values} errors={errors} pacientes={pacientes} paciente={paciente} set={set} />

        <FacturaFormEconomicos formId={formId} values={values} errors={errors} set={set} />
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

      <div className="flex items-center justify-end gap-sm">
        <Button variant="secondary" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" variant="primary" requiereEscritura>{submitting ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </CardForm>
  );
}
