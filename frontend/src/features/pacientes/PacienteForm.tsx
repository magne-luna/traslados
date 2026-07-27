import { useId, useState, type FormEvent } from 'react';
import { Button } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { CardForm } from '../../design-system/layout';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { AccesorioMovilidad } from '../../shared/types/vehiculo';
import type { IdentificadorAfiliado } from '../../shared/types/paciente';
import { DEFAULT_FORMATO_AFILIADO } from './formatoAfiliadoOptions';
import { PacienteCoberturaFields } from './PacienteCoberturaFields';
import { PacienteDatosPersonalesFields } from './PacienteDatosPersonalesFields';
import { validatePacienteForm, type PacienteFormErrors } from './validatePacienteForm';

export interface PacienteFormValues {
  apellido: string;
  segundoApellido?: string;
  nombre: string;
  segundoNombre?: string;
  fechaNacimiento: string;
  dni: string;
  cuilTitular: string;
  diagnostico: string;
  condicion?: string;
  accesorioMovilidad: AccesorioMovilidad[];
  obraSocialId: string | null;
  numeroAfiliado: IdentificadorAfiliado;
  amparoJudicial: boolean;
  amparoJudicialAclaracion?: string;
}

const DEFAULT_VALUES: PacienteFormValues = {
  apellido: '',
  nombre: '',
  fechaNacimiento: '',
  dni: '',
  cuilTitular: '',
  diagnostico: '',
  accesorioMovilidad: [],
  obraSocialId: null,
  // Default documentado y editable (design.md Decisión 1) — nunca fijo en la lógica de dominio.
  numeroAfiliado: { formato: DEFAULT_FORMATO_AFILIADO, valor: '' },
  amparoJudicial: false,
};

interface PacienteFormProps {
  initial?: PacienteFormValues;
  /** Se puebla desde ObraSocialRepository.list() en el composition root — nunca hardcodeada. */
  obrasSociales: ObraSocial[];
  onSubmit: (values: PacienteFormValues) => void;
  onCancel: () => void;
  submitting?: boolean;
  submitError?: string | null;
}

// Formulario de alta/edición de paciente (tasks.md 6.2/6.5): datos personales, clínicos,
// accesorio de movilidad, obra social + identificador de afiliado adaptable, teléfono
// alternativo y amparo judicial. Estado controlado plano — sin librería de formularios, mismo
// criterio que ObraSocialForm/VehiculoForm (FE-2, YAGNI). El CUD y las personas a cargo NO
// viven acá: son secciones propias editadas por separado (design.md — sensibilidad de datos).
export function PacienteForm({
  initial,
  obrasSociales,
  onSubmit,
  onCancel,
  submitting = false,
  submitError = null,
}: PacienteFormProps) {
  const [values, setValues] = useState<PacienteFormValues>(initial ?? DEFAULT_VALUES);
  const [errors, setErrors] = useState<PacienteFormErrors>({});
  const formId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validatePacienteForm(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  return (
    <CardForm onSubmit={handleSubmit} gap="md" radius="sm" padding="lg">
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      <PacienteDatosPersonalesFields
        formId={formId}
        values={values}
        errors={errors}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
      />

      <PacienteCoberturaFields
        formId={formId}
        values={values}
        obrasSociales={obrasSociales}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
      />

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
