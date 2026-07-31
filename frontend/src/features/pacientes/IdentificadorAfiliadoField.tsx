import { useId } from 'react';
import { Field, Input } from '../../design-system/form';
import type { FormatoAfiliado } from '../../shared/types/obraSocial';
import type { IdentificadorAfiliado } from '../../shared/types/paciente';
import { FORMATO_AFILIADO_LABELS } from './formatoAfiliadoOptions';

interface IdentificadorAfiliadoFieldProps {
  value: IdentificadorAfiliado;
  onChange: (value: IdentificadorAfiliado) => void;
  /** Formato esperado, derivado de la obra social seleccionada del paciente (RN-ID-02, IN-01) —
   * `null` cuando el paciente todavía no tiene obra social elegida. Solo se muestra como texto
   * informativo, nunca editable acá: el formato es una propiedad de la obra social, no del
   * paciente (ver shared/types/obraSocial.ts). */
  formato: FormatoAfiliado | null;
}

const labelClasses = 'font-body text-[12px] font-semibold text-muted';

// Sub-formulario del identificador de afiliado (tasks.md 6.3, RN-ID-02/IN-01): input libre de
// `valor` + formato de solo lectura derivado de la obra social del paciente. El formato ya no se
// guarda en el paciente (antes vivía en `numeroAfiliado.formato`, editable y sin persistir en
// backend — knowledge-base/10_preguntas_abiertas.md IN-01). Se muestra con un <Input disabled> en
// vez de texto plano para participar del mismo gateo de <CamposSoloLectura> (fieldset nativo,
// design-system/components.tsx) que el resto de los campos del formulario, y para permanecer no
// editable aun con permiso de escritura — a diferencia de esos campos, este nunca se habilita.
export function IdentificadorAfiliadoField({ value, onChange, formato }: IdentificadorAfiliadoFieldProps) {
  const formId = useId();

  return (
    <fieldset className="flex flex-col gap-md border-none p-0">
      <legend className={labelClasses}>Identificador de afiliado</legend>

      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Formato" htmlFor={`${formId}-formato`}>
          <Input
            id={`${formId}-formato`}
            density="comfortable"
            value={formato ? FORMATO_AFILIADO_LABELS[formato] : 'Elegí una obra social'}
            disabled
            readOnly
          />
        </Field>

        <Field label="Valor" htmlFor={`${formId}-valor`}>
          <Input
            id={`${formId}-valor`}
            density="comfortable"
            value={value.valor}
            onChange={(event) => onChange({ ...value, valor: event.target.value })}
          />
        </Field>
      </div>
    </fieldset>
  );
}
