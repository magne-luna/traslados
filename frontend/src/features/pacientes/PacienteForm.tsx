import { useId, useState, type FormEvent } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Alert } from '../../design-system/feedback';
import { CardForm } from '../../design-system/layout';
import type { ObraSocial } from '../../shared/types/obraSocial';
import type { AccesorioMovilidad } from '../../shared/types/vehiculo';
import type { IdentificadorAfiliado } from '../../shared/types/paciente';
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
  numeroAfiliado: { valor: '' },
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

  // Mismo criterio de derivación que PacienteCoberturaFields.tsx (RF-106, RN-ID-02): el formato
  // no vive en el paciente, se resuelve acá también porque validatePacienteForm es una función
  // pura que no tiene acceso a `obrasSociales`.
  const formatoAfiliado = obrasSociales.find((obraSocial) => obraSocial.id === values.obraSocialId)?.formatoAfiliado ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validatePacienteForm({ ...values, formato: formatoAfiliado });
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onSubmit(values);
  }

  return (
    <CardForm onSubmit={handleSubmit} gap="md" radius="sm" padding="lg">
      {submitError && <Alert tone="danger">{submitError}</Alert>}

      {/* gateo-pacientes (design.md D1): una sola inserción cubre los dos bloques de campos —
          PacienteDatosPersonalesFields y PacienteCoberturaFields (que a su vez compone
          IdentificadorAfiliadoField) — sin que ninguno de los tres reciba una prop nueva. El
          <div gap-md> interno reproduce el espaciado que CardForm aplicaba entre estos dos
          hijos directos antes de agruparlos (el <fieldset> no hereda el `gap` del flex de
          CardForm). El envoltorio NO cubre la barra de acciones: Cancelar debe seguir operativo
          para una cuenta de solo lectura. */}
      <CamposSoloLectura>
      <div className="flex flex-col gap-md">
      <PacienteDatosPersonalesFields
        formId={formId}
        values={values}
        errors={errors}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
      />

      <PacienteCoberturaFields
        formId={formId}
        values={values}
        errors={errors}
        obrasSociales={obrasSociales}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
      />
      </div>
      </CamposSoloLectura>

      <div className="flex items-center justify-end gap-sm">
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" variant="primary" requiereEscritura>
          {submitting ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </CardForm>
  );
}
