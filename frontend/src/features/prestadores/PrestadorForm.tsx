import { useId, useState, type FormEvent } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Select } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import type { TipoComprobante } from '../../shared/types/obraSocial';
import { validatePrestadorForm, type PrestadorFormErrors } from './validatePrestadorForm';

export interface PrestadorFormValues {
  razonSocial: string;
  cuit: string;
  /** NULLable en la base (`obra_social.prestadores.direccion`) — cadena vacía = "sin completar",
   * mismo criterio que los campos opcionales de ObraSocialForm. */
  direccion: string;
  /** NULLable en la base (`obra_social.prestadores.telefono`). */
  telefono: string;
  /** Días. Default de la migración `20260801100000_prestadores_condiciones.sql`: 90. */
  plazoCobroDias: number;
  /** A/B/C. Default de la misma migración: 'A'. */
  tipoComprobante: TipoComprobante;
}

// Defaults del formulario (D3/D4 de design.md): mismos valores que el `DEFAULT` de la migración y
// las constantes privadas `DEFAULT_PLAZO_COBRO_DIAS`/`DEFAULT_TIPO_COMPROBANTE` de
// prestadorMapping.ts — no se importan esas (no exportadas a propósito: son el fallback de
// parseo de una fila ya guardada, no el default de un formulario en blanco), se repiten acá como
// literales documentados, mismo criterio que ObraSocialForm.DEFAULT_VALUES.
const DEFAULT_VALUES: PrestadorFormValues = {
  razonSocial: '',
  cuit: '',
  direccion: '',
  telefono: '',
  plazoCobroDias: 90,
  tipoComprobante: 'A',
};

interface PrestadorFormProps {
  // `Partial` (mismo criterio que ObraSocialFormProps.initial): `Prestador` (el tipo real que pasa
  // PrestadorDetail en modo edición) modela `direccion`/`telefono` como opcionales — el form los
  // normaliza a cadena vacía internamente.
  initial?: Partial<PrestadorFormValues>;
  onSubmit: (values: PrestadorFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

// Encabezado de subsección dentro del form — idéntico a ObraSocialForm.FieldGroupHeading (no se
// extrae a un archivo compartido nuevo por 2 usos, YAGNI).
function FieldGroupHeading({ children }: { children: string }) {
  return (
    <div className="mb-lg flex items-baseline gap-sm">
      <h3 className="m-0 font-heading text-[15px] font-bold text-ink">{children}</h3>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// Formulario de alta/edición (spec prestador-crud, tasks.md 4.7). Estado controlado plano — sin
// librería de formularios: son 6 campos, mismo criterio YAGNI que ObraSocialForm. La validación de
// requeridos vive en validatePrestadorForm (función pura) para poder testearla aislada del DOM.
//
// NO incluye todavía el multi-select de ObrasSociales vinculadas (D2 de design.md) — eso es
// tasks.md 5.1, un work unit posterior de esta cadena de PRs (vínculo N:N).
export function PrestadorForm({ initial, onSubmit, onCancel, submitting = false, submitError = null }: PrestadorFormProps) {
  const [values, setValues] = useState<PrestadorFormValues>({ ...DEFAULT_VALUES, ...initial });
  const [errors, setErrors] = useState<PrestadorFormErrors>({});
  const formId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validatePrestadorForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  return (
    <CardForm onSubmit={handleSubmit} gap="xl" radius="sm" padding="lg">
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {/* gateo-obrasocial (design.md D6/spec prestador-crud §Gateo): el envoltorio de solo lectura
          cubre únicamente el bloque de campos, nunca la barra de acciones — Cancelar debe seguir
          operativo para una cuenta de solo lectura. */}
      <CamposSoloLectura>
      <div className="flex flex-col gap-xl">
      <div>
        <FieldGroupHeading>Datos Generales</FieldGroupHeading>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <Field label="Razón social" htmlFor={`${formId}-razon-social`} error={errors.razonSocial}>
            <Input
              id={`${formId}-razon-social`}
              density="comfortable"
              placeholder="Ej. Traslados del Sur S.A."
              value={values.razonSocial}
              onChange={(event) => setValues((prev) => ({ ...prev, razonSocial: event.target.value }))}
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
        </div>
      </div>

      <div>
        <FieldGroupHeading>Condiciones de Facturación</FieldGroupHeading>
        <div className="grid grid-cols-1 gap-md md:grid-cols-2">
          <Field label="Plazo de cobro (días)" htmlFor={`${formId}-plazo-cobro`}>
            <Input
              id={`${formId}-plazo-cobro`}
              type="number"
              min={0}
              density="comfortable"
              value={values.plazoCobroDias}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, plazoCobroDias: Number(event.target.value) }))
              }
            />
          </Field>

          <Field label="Tipo de comprobante" htmlFor={`${formId}-tipo-comprobante`}>
            <Select
              id={`${formId}-tipo-comprobante`}
              density="comfortable"
              value={values.tipoComprobante}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, tipoComprobante: event.target.value as TipoComprobante }))
              }
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </Select>
          </Field>
        </div>
      </div>
      </div>
      </CamposSoloLectura>

      <div className="flex items-center justify-end gap-sm border-t border-border pt-md">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" requiereEscritura>
          {submitting ? 'Guardando…' : 'Guardar prestador'}
        </Button>
      </div>
    </CardForm>
  );
}
