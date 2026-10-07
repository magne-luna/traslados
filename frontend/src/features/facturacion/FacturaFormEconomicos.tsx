import { useState } from 'react';
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
// Fix directo (sin change SDD): los inputs eran `type="number"` controlados con un `number`, así
// que mostraban el 0 inicial ("05", no se podían vaciar) y no aceptaban decimales — al tipear
// "150," o "150." el navegador entrega "" y el form lo pisaba con 0. Ahora `CampoNumerico` es un
// input de texto con teclado decimal que guarda lo tipeado como texto y sólo propaga el número
// parseado. El separador decimal es el punto (pedido del usuario 2026-10-07): una coma tipeada
// (teclado numérico es-AR) se convierte en punto al vuelo. El total se completa con el botón "Calcular"
// (`calcularTotalFactura`: días × km × valor del km) y sigue editable a mano.
const PATRON_DECIMAL = /^\d*(\.\d{0,2})?$/;
const PATRON_ENTERO = /^\d*$/;

function textoANumero(texto: string): number {
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : 0;
}

function numeroATexto(valor: number): string {
  return valor === 0 ? '' : String(valor);
}

function CampoNumerico({ id, value, onChange, decimal = true }: { id: string; value: number; onChange: (valor: number) => void; decimal?: boolean }) {
  const [texto, setTexto] = useState(() => numeroATexto(value));
  const [valorPrevio, setValorPrevio] = useState(value);

  // Si el valor cambia desde afuera (ej. "Calcular", carga en edición), se refleja en el texto
  // — salvo que ya coincida con lo tipeado ("150," sigue siendo 150 y no se pisa).
  if (value !== valorPrevio) {
    setValorPrevio(value);
    if (textoANumero(texto) !== value) setTexto(numeroATexto(value));
  }

  return (
    <Input
      id={id}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder="0"
      value={texto}
      onChange={(e) => {
        const nuevo = e.target.value.trim().replace(',', '.');
        if (!(decimal ? PATRON_DECIMAL : PATRON_ENTERO).test(nuevo)) return;
        setTexto(nuevo);
        const numero = textoANumero(nuevo);
        onChange(numero);
      }}
    />
  );
}

export function FacturaFormEconomicos({ formId, values, errors, set }: FacturaFormEconomicosProps) {
  return (
    <>
      <div className="md:col-span-2">
        <FieldGroupHeading>Datos económicos</FieldGroupHeading>
      </div>

      <Field label="Valor del km" htmlFor={`${formId}-valorkm`} error={errors.valorKm}>
        <CampoNumerico id={`${formId}-valorkm`} value={values.valorKm} onChange={(valor) => set('valorKm', valor)} />
      </Field>
      <Field label="Cantidad de km" htmlFor={`${formId}-cantkm`}>
        <CampoNumerico id={`${formId}-cantkm`} value={values.cantidadKm} onChange={(valor) => set('cantidadKm', valor)} />
      </Field>
      <Field label="Cantidad de días" htmlFor={`${formId}-dias`} error={errors.dias}>
        <CampoNumerico id={`${formId}-dias`} decimal={false} value={values.dias} onChange={(valor) => set('dias', valor)} />
      </Field>
      <Field label="Total" htmlFor={`${formId}-monto`}>
        <div className="flex items-center gap-sm">
          <CampoNumerico id={`${formId}-monto`} value={values.monto} onChange={(valor) => set('monto', valor)} />
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
