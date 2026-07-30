import { useId, useState } from 'react';
import { Button, InlineIcon } from '../../design-system/components';
import { iconCalendario, iconTacho } from '../../design-system/icons';
import type { Cud } from '../../shared/types/paciente';

interface CudFieldsProps {
  value: Cud | null;
  onChange: (value: Cud | null) => void;
}

const fieldClasses =
  'w-full rounded-sm border border-border-strong bg-surface px-md py-2 font-body text-[13px] text-text';
const dateFieldClasses = `${fieldClasses} pl-9`;
const numeroFieldClasses =
  'w-full rounded-sm border border-border-strong bg-surface px-md py-2 font-mono text-[16px] font-bold tracking-wide text-ink';
const labelClasses = 'font-body text-[12px] font-semibold text-muted';
const headerClasses = 'bg-info px-lg py-sm';
const headerTextClasses = 'font-heading text-[12px] font-bold tracking-wide text-white uppercase';

function formatearFecha(fechaIso: string): string {
  if (!fechaIso) return '—';
  return new Date(fechaIso).toLocaleDateString('es-AR');
}

// Sub-formulario del CUD (tasks.md 6.4, RF-104): solo lectura por default (decisión del
// usuario, formato inspirado en el CUD real — franja de color arriba, número+vencimiento
// destacados) con un botón "Editar" que revela el form. Los cambios se acumulan en estado local
// y recién se persisten al hacer "Guardar" — evita el lag de round-trip contra el mock async que
// ya se corrigió en PlantillaCampoRow (obras-sociales-ui) para el mismo problema. El chip de
// estado del detalle se recomputa vía estadoCud a partir de `fechaVencimiento`, ver
// PacienteDetail.tsx. Sección aislada (design.md Decisión: sensibilidad de datos clínicos).
export function CudFields({ value, onChange }: CudFieldsProps) {
  const formId = useId();
  const [editing, setEditing] = useState(false);
  const [numero, setNumero] = useState('');
  const [fechaEmision, setFechaEmision] = useState('');
  const [fechaVencimiento, setFechaVencimiento] = useState('');

  function empezarEdicion() {
    setNumero(value?.numero ?? '');
    setFechaEmision(value?.fechaEmision ?? '');
    setFechaVencimiento(value?.fechaVencimiento ?? '');
    setEditing(true);
  }

  function handleGuardar() {
    onChange({ numero, fechaEmision, fechaVencimiento });
    setEditing(false);
  }

  if (value === null && !editing) {
    return (
      <Button variant="secondary" requiereEscritura onClick={empezarEdicion}>
        Agregar CUD
      </Button>
    );
  }

  if (value && !editing) {
    return (
      <div className="flex flex-col overflow-hidden rounded-lg border border-border-strong">
        <div className={headerClasses}>
          <span className={headerTextClasses}>Certificado Único de Discapacidad (CUD)</span>
        </div>

        <div className="flex flex-col gap-md bg-surface p-lg">
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <div className="flex flex-col gap-xs">
              <span className={labelClasses}>Número de certificado</span>
              <span className="font-mono text-[16px] font-bold tracking-wide text-ink">{value.numero || '—'}</span>
            </div>
            <div className="flex flex-col gap-xs">
              <span className={labelClasses}>Fecha de vencimiento</span>
              <span className="flex items-center gap-xs font-body text-[13px] font-semibold text-ink">
                <InlineIcon>{iconCalendario}</InlineIcon>
                {formatearFecha(value.fechaVencimiento)}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-xs border-t border-border pt-md sm:w-1/2">
            <span className={labelClasses}>Fecha de emisión</span>
            <span className="flex items-center gap-xs font-body text-[13px] font-semibold text-ink">
              <InlineIcon>{iconCalendario}</InlineIcon>
              {formatearFecha(value.fechaEmision)}
            </span>
          </div>

          <div className="flex justify-end gap-sm">
            <Button variant="secondary" requiereEscritura onClick={empezarEdicion}>
              Editar
            </Button>
            <Button variant="danger" requiereEscritura onClick={() => onChange(null)}>
              <InlineIcon>{iconTacho}</InlineIcon>
              Quitar CUD
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col overflow-hidden rounded-lg border border-border-strong p-0">
      <legend className="sr-only">Certificado Único de Discapacidad (CUD)</legend>

      <div className={headerClasses}>
        <span className={headerTextClasses}>Certificado Único de Discapacidad (CUD)</span>
      </div>

      <div className="flex flex-col gap-md bg-surface p-lg">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-xs">
            <label htmlFor={`${formId}-numero`} className={labelClasses}>
              Número de certificado
            </label>
            <input
              id={`${formId}-numero`}
              className={numeroFieldClasses}
              value={numero}
              onChange={(event) => setNumero(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-xs">
            <label htmlFor={`${formId}-vencimiento`} className={labelClasses}>
              Fecha de vencimiento
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-sm -translate-y-1/2 text-muted">
                <InlineIcon>{iconCalendario}</InlineIcon>
              </span>
              <input
                id={`${formId}-vencimiento`}
                type="date"
                className={dateFieldClasses}
                value={fechaVencimiento}
                onChange={(event) => setFechaVencimiento(event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-xs border-t border-border pt-md sm:w-1/2">
          <label htmlFor={`${formId}-emision`} className={labelClasses}>
            Fecha de emisión
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-sm -translate-y-1/2 text-muted">
              <InlineIcon>{iconCalendario}</InlineIcon>
            </span>
            <input
              id={`${formId}-emision`}
              type="date"
              className={dateFieldClasses}
              value={fechaEmision}
              onChange={(event) => setFechaEmision(event.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-sm">
          {/* gateo-pacientes (design.md D2): Cancelar NUNCA lleva requiereEscritura — no persiste
              nada, solo descarta los cambios locales y vuelve a la vista de solo lectura. Es el
              punto más fácil de gatear de más de todo el change. */}
          <Button variant="secondary" onClick={() => setEditing(false)}>
            Cancelar
          </Button>
          <Button variant="primary" requiereEscritura onClick={handleGuardar}>
            Guardar
          </Button>
        </div>
      </div>
    </fieldset>
  );
}
