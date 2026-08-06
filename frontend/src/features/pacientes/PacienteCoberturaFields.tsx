import type { ObraSocial } from '../../shared/types/obraSocial';
import { FieldGroupHeading } from '../../design-system/components';
import { Field, Input, Select } from '../../design-system/form';
import { IdentificadorAfiliadoField } from './IdentificadorAfiliadoField';
import type { PacienteFormValues } from './PacienteForm';
import type { PacienteFormErrors } from './validatePacienteForm';

type Cobertura = Pick<
  PacienteFormValues,
  'obraSocialId' | 'numeroAfiliado' | 'amparoJudicial' | 'amparoJudicialAclaracion'
>;

interface PacienteCoberturaFieldsProps {
  formId: string;
  values: Cobertura;
  errors: PacienteFormErrors;
  obrasSociales: ObraSocial[];
  onChange: (patch: Partial<Cobertura>) => void;
}

// Obra social + identificador de afiliado + contacto + amparo judicial del formulario de
// paciente (tasks.md 6.2), extraído de PacienteForm para mantenerlo bajo ~200 líneas
// (react-best-practices).
export function PacienteCoberturaFields({ formId, values, errors, obrasSociales, onChange }: PacienteCoberturaFieldsProps) {
  // Formato derivado de la obra social elegida (RF-106, RN-ID-02) — ya no se guarda en el
  // paciente, ver shared/types/obraSocial.ts.
  const formatoAfiliado = obrasSociales.find((obraSocial) => obraSocial.id === values.obraSocialId)?.formatoAfiliado ?? null;

  return (
    <div>
      <FieldGroupHeading>Cobertura y afiliación</FieldGroupHeading>
      <div className="flex flex-col gap-md">
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Obra social" htmlFor={`${formId}-obra-social`}>
          <Select
            id={`${formId}-obra-social`}
            density="comfortable"
            value={values.obraSocialId ?? ''}
            onChange={(event) => onChange({ obraSocialId: event.target.value === '' ? null : event.target.value })}
          >
            <option value="">Sin obra social</option>
            {obrasSociales.map((obraSocial) => (
              <option key={obraSocial.id} value={obraSocial.id}>
                {obraSocial.nombre}
              </option>
            ))}
          </Select>
        </Field>

        <label
          htmlFor={`${formId}-amparo`}
          className="flex items-center gap-sm self-end pb-2 font-body text-[13px] text-text"
        >
          <input
            id={`${formId}-amparo`}
            type="checkbox"
            checked={values.amparoJudicial}
            onChange={(event) => onChange({ amparoJudicial: event.target.checked })}
          />
          Amparo judicial
        </label>

        {values.amparoJudicial && (
          <div className="md:col-span-2">
            <Field label="Aclaración del amparo" htmlFor={`${formId}-amparo-aclaracion`}>
              <Input
                id={`${formId}-amparo-aclaracion`}
                density="comfortable"
                value={values.amparoJudicialAclaracion ?? ''}
                onChange={(event) => onChange({ amparoJudicialAclaracion: event.target.value })}
              />
            </Field>
          </div>
        )}
      </div>

      <IdentificadorAfiliadoField
        value={values.numeroAfiliado}
        onChange={(numeroAfiliado) => onChange({ numeroAfiliado })}
        formato={formatoAfiliado}
        error={errors.numeroAfiliado}
      />
      </div>
    </div>
  );
}
