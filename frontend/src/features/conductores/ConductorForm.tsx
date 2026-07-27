import { useId, useState, type FormEvent } from 'react';
import { Button, Chip } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Input, Textarea } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import type { EstadoConductor, RestriccionConductor } from '../../shared/types/conductor';
import { RESTRICCION_CONDUCTOR_LABELS, RESTRICCION_CONDUCTOR_OPTIONS } from './restriccionConductorOptions';
import { validateConductorForm, type ConductorFormErrors } from './validateConductorForm';

export interface ConductorFormValues {
  apellido: string;
  nombre: string;
  documento: string;
  telefono: string;
  fechaNacimiento: string;
  domicilio: string;
  cuil: string;
  estado: EstadoConductor;
  restricciones: RestriccionConductor[];
  observaciones: string;
}

const DEFAULT_VALUES: ConductorFormValues = {
  apellido: '',
  nombre: '',
  documento: '',
  telefono: '',
  fechaNacimiento: '',
  domicilio: '',
  cuil: '',
  estado: 'operando',
  restricciones: [],
  observaciones: '',
};

interface ConductorFormProps {
  initial?: ConductorFormValues;
  onSubmit: (values: ConductorFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

// Formulario de alta/edición de conductor (tasks.md 5.2 a 5.6, 9.1, 9.3): apellido, nombre y
// documento obligatorios; teléfono, fecha de nacimiento, domicilio y CUIL opcionales (sumados
// 2026-07-24 para alinear con 04_modelo_de_datos.md §Conductor — sin validación bloqueante,
// mismo criterio que modelo/tipo en VehiculoForm); selector tipado de restricciones de perfil +
// observaciones libres; toggle de Estado (operando/fuera de servicio, mismo patrón que
// VehiculoForm). Sin ningún campo de credencial/acceso (RN-GL-03, design.md Decisión 2) — es
// puramente un formulario de datos administrativos.
export function ConductorForm({ initial, onSubmit, onCancel, submitting = false, submitError = null }: ConductorFormProps) {
  const [values, setValues] = useState<ConductorFormValues>(initial ?? DEFAULT_VALUES);
  const [errors, setErrors] = useState<ConductorFormErrors>({});
  const formId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateConductorForm({
      apellido: values.apellido,
      nombre: values.nombre,
      documento: values.documento,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  function toggleRestriccion(restriccion: RestriccionConductor) {
    setValues((prev) => ({
      ...prev,
      restricciones: prev.restricciones.includes(restriccion)
        ? prev.restricciones.filter((r) => r !== restriccion)
        : [...prev.restricciones, restriccion],
    }));
  }

  return (
    <CardForm onSubmit={handleSubmit} gap="md" radius="sm" padding="lg">
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Apellido" htmlFor={`${formId}-apellido`} error={errors.apellido}>
          <Input
            id={`${formId}-apellido`}
            density="comfortable"
            value={values.apellido}
            onChange={(event) => setValues((prev) => ({ ...prev, apellido: event.target.value }))}
          />
        </Field>

        <Field label="Nombre" htmlFor={`${formId}-nombre`} error={errors.nombre}>
          <Input
            id={`${formId}-nombre`}
            density="comfortable"
            value={values.nombre}
            onChange={(event) => setValues((prev) => ({ ...prev, nombre: event.target.value }))}
          />
        </Field>

        <Field label="Documento" htmlFor={`${formId}-documento`} error={errors.documento}>
          <Input
            id={`${formId}-documento`}
            density="comfortable"
            value={values.documento}
            onChange={(event) => setValues((prev) => ({ ...prev, documento: event.target.value }))}
          />
        </Field>

        <Field label="CUIL (opcional)" htmlFor={`${formId}-cuil`}>
          <Input
            id={`${formId}-cuil`}
            density="comfortable"
            value={values.cuil}
            onChange={(event) => setValues((prev) => ({ ...prev, cuil: event.target.value }))}
          />
        </Field>

        <Field label="Teléfono (opcional)" htmlFor={`${formId}-telefono`}>
          <Input
            id={`${formId}-telefono`}
            density="comfortable"
            value={values.telefono}
            onChange={(event) => setValues((prev) => ({ ...prev, telefono: event.target.value }))}
          />
        </Field>

        <Field label="Fecha de nacimiento (opcional)" htmlFor={`${formId}-fecha-nacimiento`}>
          <Input
            id={`${formId}-fecha-nacimiento`}
            type="date"
            density="comfortable"
            value={values.fechaNacimiento}
            onChange={(event) => setValues((prev) => ({ ...prev, fechaNacimiento: event.target.value }))}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Domicilio (opcional)" htmlFor={`${formId}-domicilio`}>
            <Input
              id={`${formId}-domicilio`}
              density="comfortable"
              value={values.domicilio}
              onChange={(event) => setValues((prev) => ({ ...prev, domicilio: event.target.value }))}
            />
          </Field>
        </div>

        <label
          htmlFor={`${formId}-fuera-servicio`}
          className="flex items-center gap-sm self-end pb-2 font-body text-[13px] text-text"
        >
          <input
            id={`${formId}-fuera-servicio`}
            type="checkbox"
            checked={values.estado === 'fuera-de-servicio'}
            onChange={(event) =>
              setValues((prev) => ({ ...prev, estado: event.target.checked ? 'fuera-de-servicio' : 'operando' }))
            }
          />
          Fuera de servicio
        </label>
      </div>

      <Chip kind="warning">⚠️ Pendiente de confirmar con el cliente: datos personales mínimos obligatorios del alta</Chip>

      <fieldset className="flex flex-col gap-xs border-none p-0">
        {/* <legend>, no <label>: agrupa varios checkboxes, no un único control — Label/Field no
            aplican (design.md Decisión 3, el checkbox se deja fuera del patrón Field). Mismas
            clases que Label por ser el mismo estilo de rótulo. */}
        <legend className="font-body text-[12px] font-semibold text-muted">Restricciones de perfil</legend>
        <Chip kind="warning">⚠️ Pendiente de confirmar con el cliente: catálogo cerrado de restricciones</Chip>
        <div className="flex flex-wrap gap-md">
          {RESTRICCION_CONDUCTOR_OPTIONS.map((restriccion) => (
            <label
              key={restriccion}
              htmlFor={`${formId}-restriccion-${restriccion}`}
              className="flex items-center gap-xs font-body text-[13px] text-text"
            >
              <input
                id={`${formId}-restriccion-${restriccion}`}
                type="checkbox"
                checked={values.restricciones.includes(restriccion)}
                onChange={() => toggleRestriccion(restriccion)}
              />
              {RESTRICCION_CONDUCTOR_LABELS[restriccion]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field label="Observaciones (opcional)" htmlFor={`${formId}-observaciones`}>
        <Textarea
          id={`${formId}-observaciones`}
          density="comfortable"
          value={values.observaciones}
          onChange={(event) => setValues((prev) => ({ ...prev, observaciones: event.target.value }))}
        />
      </Field>

      <div className="flex items-center justify-end gap-sm">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary">
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </CardForm>
  );
}
