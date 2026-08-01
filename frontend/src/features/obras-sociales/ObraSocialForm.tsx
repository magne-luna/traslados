import { useId, useState, type FormEvent } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Select } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import type { FormatoAfiliado, ModalidadFacturacion } from '../../shared/types/obraSocial';
import { DEFAULT_FORMATO_AFILIADO, FORMATO_AFILIADO_LABELS, FORMATO_AFILIADO_OPTIONS } from '../pacientes/formatoAfiliadoOptions';
import { validateObraSocialForm, type ObraSocialFormErrors } from './validateObraSocialForm';

export interface ObraSocialFormValues {
  nombre: string;
  cuit: string;
  modalidadFacturacion: ModalidadFacturacion;
  admitePagosParciales: boolean;
  /** RF-106/RN-ID-02: formato del número de afiliado de los pacientes de esta obra social. */
  formatoAfiliado: FormatoAfiliado;
  // Los 4 campos del docx (integracion-obra-social D9, discrepancia #11): opcionales, nunca
  // obligatorios (ninguna fuente respalda esa regla — ver validateObraSocialForm.ts). Se modelan
  // como `string` (no `string | undefined`) para que los <Input> queden siempre controlados; una
  // cadena vacía significa "sin completar", igual criterio que el resto del dominio.
  codigo: string;
  direccion: string;
  telefono: string;
  condicionIva: string;
}

const DEFAULT_VALUES: ObraSocialFormValues = {
  nombre: '',
  cuit: '',
  modalidadFacturacion: 'por-prestacion',
  admitePagosParciales: false,
  formatoAfiliado: DEFAULT_FORMATO_AFILIADO,
  codigo: '',
  direccion: '',
  telefono: '',
  condicionIva: '',
};

interface ObraSocialFormProps {
  // `Partial` (D9): `ObraSocial` (el tipo real que pasa ObraSocialDetail en modo edición) modela
  // los 4 campos del docx como opcionales (`codigo?: string`, NULLable en la base) — el form los
  // normaliza a cadena vacía internamente, así que no exige que el caller ya los traiga completos.
  initial?: Partial<ObraSocialFormValues>;
  onSubmit: (values: ObraSocialFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

// Encabezado de subsección dentro del form (título + línea divisoria) — variante más liviana
// de <Section> (design-system/components.tsx): esa lleva además un label mono superior que acá
// no aplica, son agrupaciones de campos dentro de una sola card, no secciones de página.
function FieldGroupHeading({ children }: { children: string }) {
  return (
    <div className="mb-lg flex items-baseline gap-sm">
      <h3 className="m-0 font-heading text-[15px] font-bold text-ink">{children}</h3>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// Formulario de alta/edición (tasks.md 4.2/4.3). Estado controlado plano — sin librería de
// formularios: son 6 campos, React Hook Form/Zod serían sobre-ingeniería (YAGNI, ver
// senior-frontend compact rules). La validación de requeridos vive en validateObraSocialForm
// (función pura) para poder testearla aislada del DOM.
export function ObraSocialForm({ initial, onSubmit, onCancel, submitting = false, submitError = null }: ObraSocialFormProps) {
  const [values, setValues] = useState<ObraSocialFormValues>({ ...DEFAULT_VALUES, ...initial });
  const [errors, setErrors] = useState<ObraSocialFormErrors>({});
  const formId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateObraSocialForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  return (
    <CardForm onSubmit={handleSubmit} gap="xl" radius="sm" padding="lg">
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {/* gateo-obrasocial (design.md D3/riesgos): el envoltorio de solo lectura cubre únicamente
          el bloque de campos, nunca la barra de acciones — Cancelar (más abajo) debe seguir
          operativo para una cuenta de solo lectura. El <div gap-xl> interno reproduce el mismo
          espaciado que CardForm aplicaba entre estos dos bloques antes de agruparlos en un único
          hijo directo (el <fieldset> no hereda el `gap` del flex de CardForm). */}
      <CamposSoloLectura>
      <div className="flex flex-col gap-xl">
      <div>
        <FieldGroupHeading>Datos Principales</FieldGroupHeading>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <Field label="Nombre" htmlFor={`${formId}-nombre`} error={errors.nombre}>
            <Input
              id={`${formId}-nombre`}
              density="comfortable"
              placeholder="Ej. OSDE"
              value={values.nombre}
              onChange={(event) => setValues((prev) => ({ ...prev, nombre: event.target.value }))}
            />
          </Field>

          <Field label="CUIT" htmlFor={`${formId}-cuit`} error={errors.cuit}>
            <Input
              id={`${formId}-cuit`}
              density="comfortable"
              placeholder="Ej. 30-12345678-9"
              value={values.cuit}
              onChange={(event) => setValues((prev) => ({ ...prev, cuit: event.target.value }))}
            />
          </Field>

          <Field label="Código" htmlFor={`${formId}-codigo`}>
            <Input
              id={`${formId}-codigo`}
              density="comfortable"
              value={values.codigo}
              onChange={(event) => setValues((prev) => ({ ...prev, codigo: event.target.value }))}
            />
          </Field>

          <Field label="Dirección" htmlFor={`${formId}-direccion`}>
            <Input
              id={`${formId}-direccion`}
              density="comfortable"
              value={values.direccion}
              onChange={(event) => setValues((prev) => ({ ...prev, direccion: event.target.value }))}
            />
          </Field>

          <Field label="Teléfono" htmlFor={`${formId}-telefono`}>
            <Input
              id={`${formId}-telefono`}
              density="comfortable"
              value={values.telefono}
              onChange={(event) => setValues((prev) => ({ ...prev, telefono: event.target.value }))}
            />
          </Field>

          <Field label="Condición frente al IVA" htmlFor={`${formId}-condicion-iva`}>
            <Input
              id={`${formId}-condicion-iva`}
              density="comfortable"
              value={values.condicionIva}
              onChange={(event) => setValues((prev) => ({ ...prev, condicionIva: event.target.value }))}
            />
          </Field>

          <Field label="Formato del número de afiliado" htmlFor={`${formId}-formato-afiliado`}>
            <Select
              id={`${formId}-formato-afiliado`}
              density="comfortable"
              value={values.formatoAfiliado}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, formatoAfiliado: event.target.value as FormatoAfiliado }))
              }
            >
              {FORMATO_AFILIADO_OPTIONS.map((formato) => (
                <option key={formato} value={formato}>
                  {FORMATO_AFILIADO_LABELS[formato]}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <div>
        <FieldGroupHeading>Facturación y Cobros</FieldGroupHeading>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <Field label="Modalidad de facturación" htmlFor={`${formId}-modalidad`}>
            <Select
              id={`${formId}-modalidad`}
              density="comfortable"
              value={values.modalidadFacturacion}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, modalidadFacturacion: event.target.value as ModalidadFacturacion }))
              }
            >
              <option value="por-prestacion">Por prestación</option>
              <option value="general">Factura general</option>
            </Select>
          </Field>

          <label
            htmlFor={`${formId}-parciales`}
            className="flex items-center gap-sm self-end pb-2 font-body text-[13px] text-text"
          >
            <input
              id={`${formId}-parciales`}
              type="checkbox"
              checked={values.admitePagosParciales}
              onChange={(event) => setValues((prev) => ({ ...prev, admitePagosParciales: event.target.checked }))}
            />
            Admite pagos parciales / por lote
          </label>
        </div>
      </div>
      </div>
      </CamposSoloLectura>

      <div className="flex items-center justify-end gap-sm border-t border-border pt-md">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" requiereEscritura>
          {submitting ? 'Guardando…' : 'Guardar obra social'}
        </Button>
      </div>
    </CardForm>
  );
}
