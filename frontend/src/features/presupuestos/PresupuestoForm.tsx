import { useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { AvisoModeloDatos, Button } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { Field, Select, Input } from '../../design-system/form';
import { CardForm } from '../../design-system/layout';
import type { ArchivoAdjunto } from '../../shared/types/presupuesto';
import type { Paciente } from '../../shared/types/paciente';
import type { ObraSocial } from '../../shared/types/obraSocial';
import { validatePresupuestoForm, type PresupuestoFormErrors } from './validatePresupuestoForm';

export interface PresupuestoFormValues {
  pacienteId: string | null;
  obraSocialId: string | null;
  monto: number;
  fechaEmision: string;
  archivo?: ArchivoAdjunto;
}

const DEFAULT_VALUES: PresupuestoFormValues = {
  pacienteId: null,
  obraSocialId: null,
  monto: 0,
  fechaEmision: new Date().toISOString().slice(0, 10),
};

interface PresupuestoFormProps {
  initial?: PresupuestoFormValues;
  /** Se puebla desde PacienteRepository.list() en el composition root — nunca hardcodeada (design.md Decisión 8). */
  pacientes: Paciente[];
  /** Se puebla desde ObraSocialRepository.list() en el composition root — nunca hardcodeada (design.md Decisión 8). */
  obrasSociales: ObraSocial[];
  onSubmit: (values: PresupuestoFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

function nombrePaciente(paciente: Paciente): string {
  return `${paciente.apellido}, ${paciente.nombre}`;
}

// Formulario de alta/edición de presupuesto (tasks.md 5.2 a 5.5, 9.1): selectores de paciente y
// obra social inyectados (guarda solo los ids, design.md Decisión 8), monto, fecha de emisión y
// archivo único (Decisión 3, Discrepancia 1 — NO DocumentChecklist). Estado controlado plano,
// mismo criterio YAGNI que VehiculoForm/PacienteForm.
export function PresupuestoForm({
  initial,
  pacientes,
  obrasSociales,
  onSubmit,
  onCancel,
  submitting = false,
  submitError = null,
}: PresupuestoFormProps) {
  const [values, setValues] = useState<PresupuestoFormValues>(initial ?? DEFAULT_VALUES);
  const [errors, setErrors] = useState<PresupuestoFormErrors>({});
  const formId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validatePresupuestoForm({
      pacienteId: values.pacienteId,
      obraSocialId: values.obraSocialId,
      monto: values.monto,
    });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  function handleArchivoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const archivo: ArchivoAdjunto = { nombre: file.name, cargadoEn: new Date().toISOString().slice(0, 10) };
    setValues((prev) => ({ ...prev, archivo }));
  }

  return (
    <CardForm onSubmit={handleSubmit}>
      {submitError && <Alert tone="danger">{submitError}</Alert>}

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

        <Field label="Obra social" htmlFor={`${formId}-obra-social`} error={errors.obraSocialId}>
          <Select
            id={`${formId}-obra-social`}
            density="comfortable"
            value={values.obraSocialId ?? ''}
            onChange={(event) => setValues((prev) => ({ ...prev, obraSocialId: event.target.value || null }))}
          >
            <option value="">Seleccionar obra social…</option>
            {obrasSociales.map((obraSocial) => (
              <option key={obraSocial.id} value={obraSocial.id}>
                {obraSocial.nombre}
              </option>
            ))}
          </Select>
        </Field>

        {/* "Monto" único (docx): estimación funcionalmente anual/por prestación, sin desglose
            estructurado — design.md Discrepancia 4. */}
        <Field label="Monto (estimación del presupuesto)" htmlFor={`${formId}-monto`} error={errors.monto}>
          <Input
            id={`${formId}-monto`}
            type="number"
            min={0}
            density="comfortable"
            value={values.monto}
            onChange={(event) => setValues((prev) => ({ ...prev, monto: Number(event.target.value) }))}
          />
        </Field>

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
          <Field label="Archivo" htmlFor={`${formId}-archivo`}>
            <input id={`${formId}-archivo`} type="file" onChange={handleArchivoChange} className="font-body text-[13px] text-text" />
            {values.archivo && (
              <span className="font-body text-xs text-muted">
                {values.archivo.nombre} (cargado {values.archivo.cargadoEn})
              </span>
            )}
            <AvisoModeloDatos>
              El modelo real (docx) tiene un solo archivo por presupuesto, no un checklist
              multi-documento.
            </AvisoModeloDatos>
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-sm">
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
