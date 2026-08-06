import { useId } from 'react';
import { Field, Input } from '../../design-system/form';
import type { IdentificadorAfiliado } from '../../shared/types/paciente';
import type { FormatoAfiliado } from '../../shared/types/obraSocial';
import { FORMATO_AFILIADO_LABELS } from './formatoAfiliadoOptions';

interface IdentificadorAfiliadoFieldProps {
  value: IdentificadorAfiliado;
  onChange: (value: IdentificadorAfiliado) => void;
  /** Derivado de la obra social elegida (RF-106, RN-ID-02) — `null` si todavía no hay obra
   * social seleccionada. Solo lectura acá: nunca se elige por paciente. */
  formato: FormatoAfiliado | null;
  /** Error de formato del valor (RF-106/RN-ID-02, ver validarIdentificadorAfiliado.ts) — bloquea
   * el guardado, mismo patrón `error?: string` que el resto del formulario de paciente. */
  error?: string;
}

const labelClasses = 'font-body text-[12px] font-semibold text-muted';

// Sub-formulario del identificador de afiliado (RF-106, RN-ID-02/IN-01): el formato es de solo
// lectura, derivado de la obra social elegida en PacienteCoberturaFields — acá solo se edita el
// valor libre.
export function IdentificadorAfiliadoField({ value, onChange, formato, error }: IdentificadorAfiliadoFieldProps) {
  const formId = useId();

  return (
    <fieldset className="flex flex-col gap-md border-none p-0">
      <legend className={labelClasses}>Identificador de afiliado</legend>

      <div className="grid grid-cols-1 gap-md md:grid-cols-2">
        <Field label="Formato" htmlFor={`${formId}-formato`}>
          <Input
            id={`${formId}-formato`}
            density="comfortable"
            value={formato ? FORMATO_AFILIADO_LABELS[formato] : 'Elegí una obra social primero'}
            disabled
            readOnly
          />
        </Field>

        <Field label="Valor" htmlFor={`${formId}-valor`} error={error}>
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
