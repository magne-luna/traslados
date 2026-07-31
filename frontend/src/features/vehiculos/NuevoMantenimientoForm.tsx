import { useId, useState, type FormEvent } from 'react';
import { Button, CamposSoloLectura } from '../../design-system/components';
import { Field, Input, Select } from '../../design-system/form';
import {
  SUBTIPO_LABELS,
  subtiposDe,
  TIPO_INTERVENCION_LABELS,
  TIPOS_INTERVENCION_ALTA,
} from './mantenimientoCategoriaOptions';
import { toMantenimientoRegistro, type NuevoMantenimientoInput } from './toMantenimientoRegistro';
import { validateMantenimientoForm, type MantenimientoFormInput } from './validateMantenimientoForm';

interface NuevoMantenimientoFormProps {
  onAgregar: (data: NuevoMantenimientoInput) => void;
}

const INPUT_INICIAL: MantenimientoFormInput = {
  tipoIntervencion: '',
  subtipo: '',
  detalle: '',
  fecha: '',
  kilometraje: '',
  proximoVencimientoFecha: '',
  proximoVencimientoKm: '',
};

// Form de alta de intervención (tasks.md 6.9 — extraído de HistorialMantenimiento). Selector en
// cascada nivel 1 → nivel 2 (design.md Decisión 7): al cambiar el tipo, el sub-tipo se limpia y
// se repuebla con `subtiposDe(tipo)` (spec vehiculo-mantenimiento-historial, escenario "Los
// sub-tipos de un nivel 1 no se ofrecen en el otro"). Solo ofrece preventivo/correctivo
// (`TIPOS_INTERVENCION_ALTA`, design.md Decisión 2) y no tiene campo de monto (el importe se
// carga como gasto aparte, capability `vehiculo-gastos`).
export function NuevoMantenimientoForm({ onAgregar }: NuevoMantenimientoFormProps) {
  const [input, setInput] = useState<MantenimientoFormInput>(INPUT_INICIAL);
  const [errors, setErrors] = useState<ReturnType<typeof validateMantenimientoForm>>({});
  const formId = useId();

  const subtipos = input.tipoIntervencion ? subtiposDe(input.tipoIntervencion as 'preventivo' | 'correctivo') : [];

  function handleTipoChange(tipoIntervencion: string) {
    // Cambiar el nivel 1 limpia el nivel 2 elegido antes: ningún sub-tipo de un tipo queda
    // seleccionable en el otro (spec, mismo escenario citado arriba).
    setInput((actual) => ({ ...actual, tipoIntervencion, subtipo: '', detalle: '' }));
  }

  function handleSubtipoChange(subtipo: string) {
    setInput((actual) => ({ ...actual, subtipo, detalle: subtipo === 'otro' ? actual.detalle : '' }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationErrors = validateMantenimientoForm(input);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    onAgregar(toMantenimientoRegistro(input));
    setInput(INPUT_INICIAL);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-md rounded-md border border-border bg-surface p-lg">
      <div className="flex flex-col">
        <span className="font-body text-[11px] text-muted">Nueva intervención</span>
        <span className="font-heading text-[15px] font-bold text-ink">Registrar mantenimiento</span>
      </div>

      <CamposSoloLectura>
        <Field label="Tipo de intervención" htmlFor={`${formId}-tipo`} error={errors.tipoIntervencion}>
          <Select
            id={`${formId}-tipo`}
            density="comfortable"
            value={input.tipoIntervencion}
            onChange={(event) => handleTipoChange(event.target.value)}
          >
            <option value="">Elegir…</option>
            {TIPOS_INTERVENCION_ALTA.map((tipo) => (
              <option key={tipo} value={tipo}>
                {TIPO_INTERVENCION_LABELS[tipo]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Sub-tipo" htmlFor={`${formId}-subtipo`} error={errors.subtipo}>
          <Select
            id={`${formId}-subtipo`}
            density="comfortable"
            value={input.subtipo}
            disabled={subtipos.length === 0}
            onChange={(event) => handleSubtipoChange(event.target.value)}
          >
            <option value="">Elegir…</option>
            {subtipos.map((subtipo) => (
              <option key={subtipo} value={subtipo}>
                {SUBTIPO_LABELS[subtipo]}
              </option>
            ))}
          </Select>
        </Field>

        {input.subtipo === 'otro' && (
          <Field label="Detalle" htmlFor={`${formId}-detalle`} error={errors.detalle}>
            <Input
              id={`${formId}-detalle`}
              density="comfortable"
              value={input.detalle}
              onChange={(event) => setInput((actual) => ({ ...actual, detalle: event.target.value }))}
            />
          </Field>
        )}

        <Field label="Fecha" htmlFor={`${formId}-fecha`} error={errors.fecha}>
          <Input
            id={`${formId}-fecha`}
            type="date"
            density="comfortable"
            value={input.fecha}
            onChange={(event) => setInput((actual) => ({ ...actual, fecha: event.target.value }))}
          />
        </Field>

        <Field label="Kilometraje" htmlFor={`${formId}-kilometraje`} error={errors.kilometraje}>
          <Input
            id={`${formId}-kilometraje`}
            type="number"
            density="comfortable"
            value={input.kilometraje}
            onChange={(event) => setInput((actual) => ({ ...actual, kilometraje: event.target.value }))}
          />
        </Field>

        <Field label="Próximo vencimiento (fecha)" htmlFor={`${formId}-proximo-fecha`} hint="Opcional">
          <Input
            id={`${formId}-proximo-fecha`}
            type="date"
            density="comfortable"
            value={input.proximoVencimientoFecha}
            onChange={(event) => setInput((actual) => ({ ...actual, proximoVencimientoFecha: event.target.value }))}
          />
        </Field>

        <Field label="Próximo vencimiento (kilometraje)" htmlFor={`${formId}-proximo-km`} hint="Opcional">
          <Input
            id={`${formId}-proximo-km`}
            type="number"
            density="comfortable"
            value={input.proximoVencimientoKm}
            onChange={(event) => setInput((actual) => ({ ...actual, proximoVencimientoKm: event.target.value }))}
          />
        </Field>

        <Button type="submit" variant="primary" requiereEscritura>
          + Registrar
        </Button>
      </CamposSoloLectura>
    </form>
  );
}
