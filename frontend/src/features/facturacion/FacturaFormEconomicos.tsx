import type { FacturaFormErrors } from './validateFacturaForm';
import type { FacturaFormValues } from './FacturaForm';
import { calcularTotalFactura } from '../../shared/lib/facturacion/totalesFactura';
import { FieldGroupHeading } from '../../design-system/components';
import { Field, Input } from '../../design-system/form';

interface FacturaFormEconomicosProps {
  formId: string;
  values: FacturaFormValues;
  errors: FacturaFormErrors;
  set: <K extends keyof FacturaFormValues>(key: K, value: FacturaFormValues[K]) => void;
}

// Bloque de campos económicos del formulario de factura (tasks.md 7.2, 7.3): valor del km de
// carga manual (RN-FA-05), cantidad de km, cantidad de días y total propuesto (editable).
// Extraído de FacturaForm para mantener ambos componentes bajo las ~200 líneas (tasks.md 12.3).
//
// WU2 de `facturacion-cambios-ui` (2026-08-16): se retira el campo "Tipo de comprobante" (y con
// él `TIPOS_COMPROBANTE` y los imports de `TipoComprobante`/`Select`). El valor sigue viviendo en
// `values.tipoComprobante` — el form lo precarga automáticamente al guardar una factura NUEVA
// desde la obra social cuando está configurado (RF-306, `sacar-prestadores`) y respeta el valor
// ya guardado en edición; el operador ya no lo edita a mano.
//
// Migrado a Field/Input/Select (tasks.md 16.1, design.md Decisión 3) — cero cambio de
// comportamiento: cálculos y validaciones intactos.
//
// Wizard de 3 pasos (change `facturacion-wizard-paciente-prestador`, design.md): este componente
// no cambió — sigue recibiendo las mismas props de siempre — pero ahora se monta dentro del Paso
// 3 ("el resto") de `FacturaForm.tsx`, nunca en los pasos 1/2.
//
// `tipoComprobanteBloqueado` (change `factura-por-prestador`) se removió (change
// `sacar-prestadores`, design.md D2): sin `Prestador`, no hay ninguna fuente que fije el tipo de
// comprobante — el `<Select>` vuelve a ser siempre editable, mismo comportamiento que ya tenía la
// modalidad "general" (retirado a su vez en WU2, ver arriba).
export function FacturaFormEconomicos({ formId, values, errors, set }: FacturaFormEconomicosProps) {
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
          onFocus={() => { if (values.monto === 0) set('monto', calcularTotalFactura({ valorKm: values.valorKm, cantidadKm: values.cantidadKm, dias: values.dias })); }}
        />
      </Field>
    </>
  );
}
