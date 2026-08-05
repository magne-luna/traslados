import type { TipoComprobante } from '../../shared/types/factura';
import { calcularTotalFactura } from '../../shared/lib/facturacion/totalesFactura';
import type { FacturaFormErrors } from './validateFacturaForm';
import type { FacturaFormValues } from './FacturaForm';
import { FieldGroupHeading } from '../../design-system/components';
import { Field, Input, Select } from '../../design-system/form';

interface FacturaFormEconomicosProps {
  formId: string;
  values: FacturaFormValues;
  errors: FacturaFormErrors;
  /** `true` mientras haya un `Prestador` elegido (change `factura-por-prestador`, design.md D3):
   * el `<Select>` de tipo de comprobante pasa a solo lectura, con el valor tomado del prestador.
   * En modalidad "general" (sin prestador) siempre es `false` — RN-FA-07 no cambia. */
  tipoComprobanteBloqueado: boolean;
  set: <K extends keyof FacturaFormValues>(key: K, value: FacturaFormValues[K]) => void;
}

const TIPOS_COMPROBANTE: TipoComprobante[] = ['A', 'B', 'C'];

// Bloque de campos económicos del formulario de factura (tasks.md 7.2, 7.3): valor del km de
// carga manual (RN-FA-05), cantidad de km, cantidad de días, total propuesto (editable) y tipo
// de comprobante precargado desde la obra social (RN-FA-07). Extraído de FacturaForm para
// mantener ambos componentes bajo las ~200 líneas (tasks.md 12.3).
//
// Migrado a Field/Input/Select (tasks.md 16.1, design.md Decisión 3) — cero cambio de
// comportamiento: cálculos y validaciones intactos.
//
// Wizard de 3 pasos (change `facturacion-wizard-paciente-prestador`, design.md): este componente
// no cambió — sigue recibiendo las mismas props de siempre — pero ahora se monta dentro del Paso
// 3 ("el resto") de `FacturaForm.tsx`, nunca en los pasos 1/2.
export function FacturaFormEconomicos({ formId, values, errors, tipoComprobanteBloqueado, set }: FacturaFormEconomicosProps) {
  return (
    <>
      <div className="md:col-span-2">
        <FieldGroupHeading>Datos económicos</FieldGroupHeading>
      </div>

      <Field label="Valor del km" htmlFor={`${formId}-valorkm`} error={errors.valorKm}>
        <Input id={`${formId}-valorkm`} type="number" min={0} value={values.valorKm} onChange={(e) => set('valorKm', Number(e.target.value))} />
      </Field>
      <Field label="Cantidad de km" htmlFor={`${formId}-cantkm`}>
        <Input id={`${formId}-cantkm`} type="number" min={0} value={values.cantidadKm} onChange={(e) => set('cantidadKm', Number(e.target.value))} />
      </Field>
      <Field label="Cantidad de días" htmlFor={`${formId}-dias`} error={errors.dias}>
        <Input id={`${formId}-dias`} type="number" min={0} value={values.dias} onChange={(e) => set('dias', Number(e.target.value))} />
      </Field>
      <Field label="Total" htmlFor={`${formId}-monto`}>
        <Input
          id={`${formId}-monto`}
          type="number"
          value={values.monto}
          onChange={(e) => set('monto', Number(e.target.value))}
          onFocus={() => { if (values.monto === 0) set('monto', calcularTotalFactura({ valorKm: values.valorKm, cantidadKm: values.cantidadKm })); }}
        />
      </Field>
      <Field label="Tipo de comprobante" htmlFor={`${formId}-tipo`}>
        <Select
          id={`${formId}-tipo`}
          value={values.tipoComprobante}
          disabled={tipoComprobanteBloqueado}
          onChange={(e) => set('tipoComprobante', e.target.value as TipoComprobante)}
        >
          {TIPOS_COMPROBANTE.map((tipo) => <option key={tipo} value={tipo}>{tipo}</option>)}
        </Select>
      </Field>
    </>
  );
}
