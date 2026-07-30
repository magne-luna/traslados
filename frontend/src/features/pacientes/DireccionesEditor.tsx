import { useId, useState } from 'react';
import { Button, CamposSoloLectura, InlineIcon } from '../../design-system/components';
import { iconTacho } from '../../design-system/icons';
import { Field, Input, Select } from '../../design-system/form';
import { Card } from '../../design-system/layout';
import { generateId } from '../../shared/lib/id';
import type { Direccion, TipoDireccion } from '../../shared/types/paciente';
import { TIPO_DIRECCION_ICON, TIPO_DIRECCION_LABELS, TIPO_DIRECCION_OPTIONS } from './direccionOptions';

interface DireccionesEditorProps {
  direcciones: Direccion[];
  onChange: (direcciones: Direccion[]) => void;
}

const NUEVA_DIRECCION_DEFAULT = { tipo: 'domicilio' as TipoDireccion, calle: '', localidad: '' };

// Editor de direcciones múltiples (tasks.md 8.1/8.2, RF-113): catálogo de lugares del paciente,
// cada uno un registro independiente identificado por `id`. Sin `tramo` propio (RN-HR-02): el
// tramo ida/vuelta es del recorrido que usa la dirección, no de la dirección en sí — ver
// `Tramo`/`Direccion` en shared/types/paciente.ts. Se muestran de solo lectura (tarjeta con
// ícono por tipo) — no hay edición inline, para agregar una corregida hay que quitar y volver a
// cargar (mismo criterio que el checklist de obras-sociales-ui).
//
// NOTA (tasks.md 12.3, gobernanza MEDIO): el `<li>` de cada fila usa `flex flex-wrap
// items-center justify-between` con padding asimétrico (`px-md py-sm`) — Card (layout.tsx) solo
// soporta `flex flex-col` con padding uniforme en su base, así que NO se migra a Card acá (mismo
// límite ya visto en AsignacionSemanalTabla.tsx, sección 11.2). Excepción permanente confirmada
// por el usuario: queda como `<li>` nativo, sin ampliar Card por un solo caso.
export function DireccionesEditor({ direcciones, onChange }: DireccionesEditorProps) {
  const [nueva, setNueva] = useState(NUEVA_DIRECCION_DEFAULT);
  const formId = useId();

  function handleAdd() {
    if (!nueva.calle.trim() || !nueva.localidad.trim()) return;
    onChange([...direcciones, { id: generateId('dir'), ...nueva }]);
    setNueva(NUEVA_DIRECCION_DEFAULT);
  }

  function handleRemove(id: string) {
    onChange(direcciones.filter((direccion) => direccion.id !== id));
  }

  return (
    <Card radius="md" gap="lg">
      {/* gateo-pacientes (design.md D2): cuelga de PacienteDetail, fuera de PacienteForm, así que
          no lo alcanza el envoltorio de la sección de datos personales — tiene el suyo propio.
          Una sola inserción cubre el <button> nativo "Quitar" de cada fila y el bloque de
          "Agregar nueva dirección" completo (campos + Button); las direcciones ya cargadas
          siguen legibles porque el fieldset solo deshabilita controles, no oculta contenido. */}
      <CamposSoloLectura>
      <div className="flex flex-col gap-lg">
      {direcciones.length === 0 ? (
        <p className="m-0 font-body text-sm text-muted">No hay direcciones registradas todavía.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-sm p-0">
          {direcciones.map((direccion) => (
            <li
              key={direccion.id}
              data-direccion-id={direccion.id}
              className="flex flex-wrap items-center justify-between gap-sm rounded-md border border-border bg-surface-soft px-md py-sm"
            >
              <div className="flex items-center gap-sm">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-info-soft text-info">
                  <InlineIcon size={18}>{TIPO_DIRECCION_ICON[direccion.tipo]}</InlineIcon>
                </span>
                <div className="flex flex-col gap-xs">
                  <span className="font-body text-[14px] font-semibold text-ink">{TIPO_DIRECCION_LABELS[direccion.tipo]}</span>
                  <span className="font-body text-[13px] text-muted">
                    {direccion.calle}, {direccion.localidad}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(direccion.id)}
                aria-label={`Quitar ${TIPO_DIRECCION_LABELS[direccion.tipo]} (${direccion.calle})`}
                className="cursor-pointer border-none bg-transparent p-0 text-danger"
              >
                <InlineIcon>{iconTacho}</InlineIcon>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-md border-t border-border pt-md">
        <p className="m-0 font-body text-[14px] font-bold text-ink">Agregar nueva dirección</p>

        <div className="grid grid-cols-1 gap-md md:grid-cols-3">
          <Field label="Tipo de lugar" htmlFor={`${formId}-tipo`}>
            <Select
              id={`${formId}-tipo`}
              density="comfortable"
              placeholderTone="faint"
              value={nueva.tipo}
              onChange={(event) => setNueva((prev) => ({ ...prev, tipo: event.target.value as TipoDireccion }))}
            >
              {TIPO_DIRECCION_OPTIONS.map((tipo) => (
                <option key={tipo} value={tipo}>
                  {TIPO_DIRECCION_LABELS[tipo]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Calle y número" htmlFor={`${formId}-nueva-calle`}>
            <Input
              id={`${formId}-nueva-calle`}
              placeholder="Ej. Av. Santa Fe 1234"
              density="comfortable"
              placeholderTone="faint"
              value={nueva.calle}
              onChange={(event) => setNueva((prev) => ({ ...prev, calle: event.target.value }))}
            />
          </Field>

          <Field label="Localidad" htmlFor={`${formId}-nueva-localidad`}>
            <Input
              id={`${formId}-nueva-localidad`}
              placeholder="Ej. CABA"
              density="comfortable"
              placeholderTone="faint"
              value={nueva.localidad}
              onChange={(event) => setNueva((prev) => ({ ...prev, localidad: event.target.value }))}
            />
          </Field>
        </div>

        <div className="flex justify-end">
          <Button variant="primary" onClick={handleAdd}>
            + Agregar dirección
          </Button>
        </div>
      </div>
      </div>
      </CamposSoloLectura>
    </Card>
  );
}
