import type { FacturaFormErrors } from './validateFacturaForm';
import type { FacturaFormValues } from './FacturaForm';
import { calcularTotalFactura } from '../../shared/lib/facturacion/totalesFactura';
import { Button, FieldGroupHeading } from '../../design-system/components';
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
//
// Fix directo (sin change SDD): los inputs numéricos mostraban el `0` inicial, así que al
// tipear quedaba "05"/"0150" y al borrar el campo volvía a aparecer el 0. Ahora un 0 se
// muestra vacío (con placeholder "0") — `numeroOVacio`/`aNumero`. Y el total ya no se propone
// solo al enfocar el campo (sólo funcionaba si estaba en 0): el botón "Calcular" lo completa
// con `calcularTotalFactura` (días × km × valor del km) y el campo sigue editable a mano.
function numeroOVacio(valor: number): number | '' {
  return valor === 0 ? '' : valor;
}

function aNumero(texto: string): number {
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

export function FacturaFormEconomicos({ formId, values, errors, set }: FacturaFormEconomicosProps) {
  return (
    <>
      <div className="md:col-span-2">
        <FieldGroupHeading>Datos económicos</FieldGroupHeading>
      </div>

      <Field label="Valor del km" htmlFor={`${formId}-valorkm`} error={errors.valorKm}>
        <Input id={`${formId}-valorkm`} type="number" min={0} step="any" placeholder="0" value={numeroOVacio(values.valorKm)} onChange={(e) => set('valorKm', aNumero(e.target.value))} />
      </Field>
      <Field label="Cantidad de km" htmlFor={`${formId}-cantkm`}>
        <Input id={`${formId}-cantkm`} type="number" min={0} step="any" placeholder="0" value={numeroOVacio(values.cantidadKm)} onChange={(e) => set('cantidadKm', aNumero(e.target.value))} />
      </Field>
      <Field label="Cantidad de días" htmlFor={`${formId}-dias`} error={errors.dias}>
        <Input id={`${formId}-dias`} type="number" min={0} placeholder="0" value={numeroOVacio(values.dias)} onChange={(e) => set('dias', aNumero(e.target.value))} />
      </Field>
      <Field label="Total" htmlFor={`${formId}-monto`}>
        <div className="flex items-center gap-sm">
          <Input id={`${formId}-monto`} type="number" min={0} step="any" placeholder="0" value={numeroOVacio(values.monto)} onChange={(e) => set('monto', aNumero(e.target.value))} />
          <Button
            variant="secondary"
            requiereEscritura
            onClick={() => set('monto', calcularTotalFactura({ valorKm: values.valorKm, cantidadKm: values.cantidadKm, dias: values.dias }))}
          >
            Calcular
          </Button>
        </div>
      </Field>
    </>
  );
}
