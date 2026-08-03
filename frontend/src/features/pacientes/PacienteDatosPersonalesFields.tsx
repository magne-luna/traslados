import {
  ACCESORIO_MOVILIDAD_ICONS,
  ACCESORIO_MOVILIDAD_LABELS,
  ACCESORIO_MOVILIDAD_OPTIONS,
} from '../vehiculos/accesorioMovilidadOptions';
import type { AccesorioMovilidad } from '../../shared/types/vehiculo';
import { ChecklistOption, FieldGroupHeading } from '../../design-system/components';
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
  // FE-2 — reutiliza el catálogo de `accesorioMovilidadOptions.ts` y el `ChecklistOption` del
  // design system, mismo componente que usa `VehiculoForm.tsx` para su propio selector de
  // accesorios).
  function toggleAccesorio(accesorio: AccesorioMovilidad) {
    onChange({
      accesorioMovilidad: values.accesorioMovilidad.includes(accesorio)
        ? values.accesorioMovilidad.filter((a) => a !== accesorio)
        : [...values.accesorioMovilidad, accesorio],
    });
  }

  return (
    <>
      <div>
      <FieldGroupHeading>Datos personales</FieldGroupHeading>
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
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
      </div>
      </div>

      <div>
      <FieldGroupHeading>Datos clínicos</FieldGroupHeading>

      {/* Comparten fila (feedback de usuario: "que compartan la misma fila"): grid propio de 2
          columnas en vez de dos `md:col-span-2` sueltos, así quedan siempre uno al lado del otro
          sin importar la paridad de campos que los preceden en la grilla de arriba. */}
      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Diagnóstico" htmlFor={`${formId}-diagnostico`}>
          <Textarea
            id={`${formId}-diagnostico`}
            density="comfortable"
            value={values.diagnostico}
            onChange={(event) => onChange({ diagnostico: event.target.value })}
          />
        </Field>

        <Field label="Condición" htmlFor={`${formId}-condicion`}>
          <Textarea
            id={`${formId}-condicion`}
            density="comfortable"
            value={values.condicion ?? ''}
            onChange={(event) => onChange({ condicion: event.target.value })}
          />
        </Field>
      </div>

      <fieldset className="mt-md flex flex-col gap-xs border-none p-0">
        <legend className="mb-lg flex w-full items-baseline gap-sm">
          <span className="font-heading text-[15px] font-bold text-ink">Accesorios de movilidad</span>
          <span className="h-px flex-1 bg-border" />
        </legend>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
          {ACCESORIO_MOVILIDAD_OPTIONS.map((accesorio) => (
            <ChecklistOption
              key={accesorio}
              id={`${formId}-accesorio-${accesorio}`}
              label={ACCESORIO_MOVILIDAD_LABELS[accesorio]}
              icon={ACCESORIO_MOVILIDAD_ICONS[accesorio]}
              selected={values.accesorioMovilidad.includes(accesorio)}
              onChange={() => toggleAccesorio(accesorio)}
            />
          ))}
        </div>
      </fieldset>
      </div>
    </>
  );
}
