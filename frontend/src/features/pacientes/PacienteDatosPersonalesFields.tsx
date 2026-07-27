import { ACCESORIO_MOVILIDAD_LABELS, ACCESORIO_MOVILIDAD_OPTIONS } from '../vehiculos/accesorioMovilidadOptions';
import type { AccesorioMovilidad } from '../../shared/types/vehiculo';
import { Field, Input, Textarea } from '../../design-system/form';
import type { PacienteFormErrors } from './validatePacienteForm';
import type { PacienteFormValues } from './PacienteForm';

type DatosPersonales = Pick<
  PacienteFormValues,
  | 'apellido'
  | 'segundoApellido'
  | 'nombre'
  | 'segundoNombre'
  | 'fechaNacimiento'
  | 'dni'
  | 'cuilTitular'
  | 'diagnostico'
  | 'condicion'
  | 'accesorioMovilidad'
>;

interface PacienteDatosPersonalesFieldsProps {
  formId: string;
  values: DatosPersonales;
  errors: PacienteFormErrors;
  onChange: (patch: Partial<DatosPersonales>) => void;
}

// Datos personales y clínicos del formulario de paciente (tasks.md 6.2), extraído de
// PacienteForm para mantenerlo bajo ~200 líneas (react-best-practices).
export function PacienteDatosPersonalesFields({ formId, values, errors, onChange }: PacienteDatosPersonalesFieldsProps) {
  // Multi-selección (docx: tabla de vínculo Paciente-Accesorio, igual que Vehiculo-Accesorio en
  // FE-2 — mismo patrón de checkboxes que `VehiculoForm.tsx`, sin extraer un componente
  // compartido porque tampoco existe uno ahí: YAGNI, se reutiliza el catálogo de
  // `accesorioMovilidadOptions.ts` pero no una UI en común).
  function toggleAccesorio(accesorio: AccesorioMovilidad) {
    onChange({
      accesorioMovilidad: values.accesorioMovilidad.includes(accesorio)
        ? values.accesorioMovilidad.filter((a) => a !== accesorio)
        : [...values.accesorioMovilidad, accesorio],
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Apellido" htmlFor={`${formId}-apellido`} error={errors.apellido}>
          <Input
            id={`${formId}-apellido`}
            density="comfortable"
            value={values.apellido}
            onChange={(event) => onChange({ apellido: event.target.value })}
          />
        </Field>

        <Field label="Segundo apellido" htmlFor={`${formId}-segundo-apellido`}>
          <Input
            id={`${formId}-segundo-apellido`}
            density="comfortable"
            value={values.segundoApellido ?? ''}
            onChange={(event) => onChange({ segundoApellido: event.target.value })}
          />
        </Field>

        <Field label="Nombre" htmlFor={`${formId}-nombre`} error={errors.nombre}>
          <Input
            id={`${formId}-nombre`}
            density="comfortable"
            value={values.nombre}
            onChange={(event) => onChange({ nombre: event.target.value })}
          />
        </Field>

        <Field label="Segundo nombre" htmlFor={`${formId}-segundo-nombre`}>
          <Input
            id={`${formId}-segundo-nombre`}
            density="comfortable"
            value={values.segundoNombre ?? ''}
            onChange={(event) => onChange({ segundoNombre: event.target.value })}
          />
        </Field>

        <Field label="Fecha de nacimiento" htmlFor={`${formId}-fecha-nacimiento`}>
          <Input
            id={`${formId}-fecha-nacimiento`}
            type="date"
            density="comfortable"
            value={values.fechaNacimiento}
            onChange={(event) => onChange({ fechaNacimiento: event.target.value })}
          />
        </Field>

        <Field label="DNI" htmlFor={`${formId}-dni`} error={errors.dni}>
          <Input
            id={`${formId}-dni`}
            density="comfortable"
            value={values.dni}
            onChange={(event) => onChange({ dni: event.target.value })}
          />
        </Field>

        <Field label="CUIL del titular" htmlFor={`${formId}-cuil-titular`}>
          <Input
            id={`${formId}-cuil-titular`}
            density="comfortable"
            value={values.cuilTitular}
            onChange={(event) => onChange({ cuilTitular: event.target.value })}
          />
        </Field>

        <div className="md:col-span-2">
          <Field label="Diagnóstico" htmlFor={`${formId}-diagnostico`}>
            <Textarea
              id={`${formId}-diagnostico`}
              density="comfortable"
              value={values.diagnostico}
              onChange={(event) => onChange({ diagnostico: event.target.value })}
            />
          </Field>
        </div>

        <div className="md:col-span-2">
          <Field label="Condición" htmlFor={`${formId}-condicion`}>
            <Textarea
              id={`${formId}-condicion`}
              density="comfortable"
              value={values.condicion ?? ''}
              onChange={(event) => onChange({ condicion: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <fieldset className="flex flex-col gap-xs border-none p-0">
        <legend className="font-body text-[12px] font-semibold text-muted">Accesorios de movilidad</legend>
        <div className="flex flex-wrap gap-md">
          {ACCESORIO_MOVILIDAD_OPTIONS.map((accesorio) => (
            <label
              key={accesorio}
              htmlFor={`${formId}-accesorio-${accesorio}`}
              className="flex items-center gap-xs font-body text-[13px] text-text"
            >
              <input
                id={`${formId}-accesorio-${accesorio}`}
                type="checkbox"
                checked={values.accesorioMovilidad.includes(accesorio)}
                onChange={() => toggleAccesorio(accesorio)}
              />
              {ACCESORIO_MOVILIDAD_LABELS[accesorio]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
