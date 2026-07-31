import { useId } from 'react';
import { Field, Input, Select } from '../../design-system/form';
import type { FormatoAfiliado, IdentificadorAfiliado } from '../../shared/types/paciente';
import { FORMATO_AFILIADO_LABELS, FORMATO_AFILIADO_OPTIONS } from './formatoAfiliadoOptions';

interface IdentificadorAfiliadoFieldProps {
  value: IdentificadorAfiliado;
  onChange: (value: IdentificadorAfiliado) => void;
}

const labelClasses = 'font-body text-[12px] font-semibold text-muted';

// Sub-formulario del identificador de afiliado (tasks.md 6.3, RN-ID-02/IN-01): select de
// `formato` (unión cerrada) + input libre de `valor`. Cambiar el formato NUNCA borra ni fuerza
// el valor — son dos campos independientes del mismo objeto, cada `onChange` solo toca el campo
// que el usuario editó.
export function IdentificadorAfiliadoField({ value, onChange }: IdentificadorAfiliadoFieldProps) {
  const formId = useId();

  return (
    <fieldset className="flex flex-col gap-md border-none p-0">
      <legend className={labelClasses}>Identificador de afiliado</legend>

      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Formato" htmlFor={`${formId}-formato`}>
          <Select
            id={`${formId}-formato`}
            density="comfortable"
            value={value.formato}
            onChange={(event) => onChange({ ...value, formato: event.target.value as FormatoAfiliado })}
          >
            {FORMATO_AFILIADO_OPTIONS.map((formato) => (
              <option key={formato} value={formato}>
                {FORMATO_AFILIADO_LABELS[formato]}
              </option>
            ))}
          </Select>
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
