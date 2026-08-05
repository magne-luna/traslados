import type { Paciente } from '../../shared/types/paciente';
import type { FacturaFormErrors } from './validateFacturaForm';
import type { FacturaFormValues } from './FacturaForm';
import { FieldGroupHeading } from '../../design-system/components';
import { Field, Input, Select } from '../../design-system/form';

interface FacturaFormDatosBasicosProps {
  formId: string;
  values: FacturaFormValues;
  errors: FacturaFormErrors;
  paciente: Paciente | undefined;
  set: <K extends keyof FacturaFormValues>(key: K, value: FacturaFormValues[K]) => void;
}

// Bloque de datos básicos del formulario de factura (tasks.md 7.1): período estructurado,
// prestación, domicilio (guarda solo el id) y dependencia/retorno. Extraído de FacturaForm para
// mantener ambos componentes bajo las ~200 líneas (tasks.md 12.3).
//
// Migrado a Field/Input/Select (tasks.md 16.1, design.md Decisión 3) — cero cambio de
// comportamiento: cálculos, validaciones y armado de descripción por plantilla intactos.
// El error de `periodo` (mes+anio combinados) NO usa el mecanismo de error de Field porque el
// original agrega `md:col-span-2` — una clase que FieldError no puede emitir (prohíbe className
// extra por tipo) — así que sigue siendo un `<span>` nativo aparte, igual que antes.
//
// Reorganizado en un wizard de 3 pasos (change `facturacion-wizard-paciente-prestador`,
// design.md): el campo "Paciente" (antes acá, primero del bloque) se mudó al Paso 1 del wizard
// en `FacturaForm.tsx` — el paciente ahora se elige ANTES de ver el resto de estos campos, no
// junto con ellos. `PrestadorSelector` (antes acá, condicionado a
// `obraSocial.modalidadFacturacion === 'por-prestacion'`, insertado justo después de
// "Prestación" — change `factura-por-prestador`, design.md D2/D3) también se mudó, al Paso 2.
// Este componente ya NO recibe `pacientes` ni `obraSocial` como prop — ninguno de los dos campos
// que los necesitaba sigue viviendo acá. Sigue recibiendo `paciente` (para poblar el `<Select>`
// de domicilio con `paciente.direcciones`), que en el wizard de alta ya está resuelto para cuando
// se llega al Paso 3 (el paciente se elige en el Paso 1, antes de montar este componente); en
// modo edición (bypass del wizard, `FacturaForm.tsx`) también está disponible de entrada.
export function FacturaFormDatosBasicos({ formId, values, errors, paciente, set }: FacturaFormDatosBasicosProps) {
  return (
    <>
      <div className="md:col-span-2">
        <FieldGroupHeading>Datos básicos</FieldGroupHeading>
      </div>

      <Field label="Mes" htmlFor={`${formId}-mes`}>
        <Input id={`${formId}-mes`} type="number" min={1} max={12} value={values.mesFacturado} onChange={(e) => set('mesFacturado', Number(e.target.value))} />
      </Field>
      <Field label="Año" htmlFor={`${formId}-anio`}>
        <Input id={`${formId}-anio`} type="number" value={values.anioFacturado} onChange={(e) => set('anioFacturado', Number(e.target.value))} />
      </Field>
      {errors.periodo && <span className="font-body text-xs text-danger md:col-span-2">{errors.periodo}</span>}

      <Field label="Prestación" htmlFor={`${formId}-prestacion`}>
        <Input id={`${formId}-prestacion`} type="text" value={values.prestacion} onChange={(e) => set('prestacion', e.target.value)} />
      </Field>

      <Field label="Domicilio" htmlFor={`${formId}-domicilio`}>
        <Select id={`${formId}-domicilio`} value={values.domicilioId} onChange={(e) => set('domicilioId', e.target.value)}>
          <option value="">Seleccionar domicilio…</option>
          {paciente?.direcciones.map((d) => (
            <option key={d.id} value={d.id}>{d.calle}, {d.localidad}</option>
          ))}
        </Select>
      </Field>

      <Field label="Dependencia y retorno" htmlFor={`${formId}-depret`}>
        <Input id={`${formId}-depret`} type="text" value={values.dependenciaYRetorno} onChange={(e) => set('dependenciaYRetorno', e.target.value)} />
      </Field>
    </>
  );
}
