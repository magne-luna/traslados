import { useId, useRef, useState, type DragEvent } from 'react';
import { Button, InlineIcon, SectionBadge } from '../../design-system/components';
import { Input, Select } from '../../design-system/form';
import { Card } from '../../design-system/layout';
import { iconOjo, iconReordenar } from '../../design-system/icons';
import { generateId } from '../../shared/lib/id';
import { move, moveDown, moveUp } from '../../shared/lib/reorder';
import type { IdentificadorOrigenFactura, PlantillaCampo, PlantillaFactura } from '../../shared/types/obraSocial';
import {
  IDENTIFICADOR_ORIGEN_LABELS,
  IDENTIFICADOR_ORIGEN_OPTIONS,
  ORIGEN_CAMPO_EJEMPLOS,
  ORIGEN_CAMPO_OPTIONS,
} from './origenCampoOptions';
import { PlantillaCampoRow } from './PlantillaCampoRow';

interface PlantillaFacturaEditorProps {
  plantilla: PlantillaFactura;
  onChange: (plantilla: PlantillaFactura) => void;
}

function renumerar(campos: PlantillaCampo[]): PlantillaCampo[] {
  return campos.map((campo, index) => ({ ...campo, orden: index }));
}

// Editor de la plantilla de descripción de factura por obra social (tasks.md 6.*, RF-302,
// RF-400). Campos dinámicos tipados (design.md Decisión 3) en vez de un string con
// placeholders — habilita reorder y validación. El identificadorOrigen resuelve IN-01: queda
// configurable con el default documentado, nunca hardcodeado (ver obraSocial.ts). Layout de dos
// columnas simultáneas (Configuración | Vista previa), mismo patrón que ChecklistEditor.
export function PlantillaFacturaEditor({ plantilla, onChange }: PlantillaFacturaEditorProps) {
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState('');
  const dragIndexRef = useRef<number | null>(null);
  const formId = useId();
  const primerOrigen = ORIGEN_CAMPO_OPTIONS[0];

  function handleAdd() {
    const etiqueta = nuevaEtiqueta.trim();
    if (!etiqueta || !primerOrigen) return;
    const nuevoCampo: PlantillaCampo = {
      id: generateId('campo'),
      etiqueta,
      origen: primerOrigen,
      orden: plantilla.campos.length,
    };
    onChange({ ...plantilla, campos: [...plantilla.campos, nuevoCampo] });
    setNuevaEtiqueta('');
  }

  function handleChangeEtiqueta(id: string, etiqueta: string) {
    onChange({
      ...plantilla,
      campos: plantilla.campos.map((campo) => (campo.id === id ? { ...campo, etiqueta } : campo)),
    });
  }

  function handleChangeOrigen(id: string, origen: PlantillaCampo['origen']) {
    onChange({
      ...plantilla,
      campos: plantilla.campos.map((campo) => (campo.id === id ? { ...campo, origen } : campo)),
    });
  }

  function handleRemove(id: string) {
    onChange({ ...plantilla, campos: renumerar(plantilla.campos.filter((campo) => campo.id !== id)) });
  }

  function indexOf(id: string): number {
    return plantilla.campos.findIndex((campo) => campo.id === id);
  }

  function handleMoveUp(id: string) {
    onChange({ ...plantilla, campos: renumerar(moveUp(plantilla.campos, indexOf(id))) });
  }

  function handleMoveDown(id: string) {
    onChange({ ...plantilla, campos: renumerar(moveDown(plantilla.campos, indexOf(id))) });
  }

  function handleDragStart(index: number) {
    dragIndexRef.current = index;
  }

  function handleDragOver(event: DragEvent<HTMLLIElement>) {
    event.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    const fromIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    if (fromIndex === null) return;
    onChange({ ...plantilla, campos: renumerar(move(plantilla.campos, fromIndex, targetIndex)) });
  }

  return (
    <div className="grid grid-cols-1 gap-lg md:grid-cols-2">
      <Card gap="lg">
        <SectionBadge tone="config">Configuración</SectionBadge>

        <div className="flex flex-col gap-xs">
          <label htmlFor={`${formId}-identificador`} className="font-body text-[12px] font-semibold text-muted">
            Identificador en la factura (IN-01)
          </label>
          <Select
            id={`${formId}-identificador`}
            density="comfortable"
            value={plantilla.identificadorOrigen}
            onChange={(event) =>
              onChange({ ...plantilla, identificadorOrigen: event.target.value as IdentificadorOrigenFactura })
            }
          >
            {IDENTIFICADOR_ORIGEN_OPTIONS.map((origen) => (
              <option key={origen} value={origen}>
                {IDENTIFICADOR_ORIGEN_LABELS[origen]}
              </option>
            ))}
          </Select>
          <p className="m-0 font-body text-xs text-muted">
            Qué campo de la ficha del paciente alimenta el identificador de la factura.
          </p>
        </div>

        <div className="flex flex-col gap-md border-t border-border pt-md">
          <p className="m-0 font-body text-[12px] font-semibold text-muted">Campos de la descripción</p>

          <div className="flex items-end gap-sm">
            <div className="flex flex-1 flex-col gap-xs">
              <label htmlFor={`${formId}-nueva-etiqueta`} className="sr-only">
                Nueva etiqueta
              </label>
              <Input
                id={`${formId}-nueva-etiqueta`}
                placeholder="Nueva etiqueta…"
                density="comfortable"
                value={nuevaEtiqueta}
                onChange={(event) => setNuevaEtiqueta(event.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={handleAdd}>
              Agregar campo
            </Button>
          </div>

          {plantilla.campos.length === 0 ? (
            <p className="font-body text-sm text-muted">Sin campos todavía — agregá el primero arriba.</p>
          ) : (
            <>
              <ul className="m-0 flex list-none flex-col gap-xs p-0">
                {plantilla.campos.map((campo, index) => (
                  <PlantillaCampoRow
                    key={campo.id}
                    campo={campo}
                    index={index}
                    isFirst={index === 0}
                    isLast={index === plantilla.campos.length - 1}
                    onChangeEtiqueta={handleChangeEtiqueta}
                    onChangeOrigen={handleChangeOrigen}
                    onRemove={handleRemove}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  />
                ))}
              </ul>
              <p className="m-0 flex items-center gap-xs font-body text-xs text-muted">
                <InlineIcon>{iconReordenar}</InlineIcon>
                Arrastrá para reordenar
              </p>
            </>
          )}
        </div>
      </Card>

      <Card gap="md" background="surface-soft">
        <div className="flex flex-wrap items-center gap-sm">
          <SectionBadge tone="preview" icon={<InlineIcon size={12}>{iconOjo}</InlineIcon>}>
            Vista previa
          </SectionBadge>
        </div>
        <p className="m-0 font-body text-xs text-muted">Así aparecerá en la línea de descripción de la factura</p>

        {plantilla.campos.length === 0 ? (
          <p className="font-body text-sm text-muted">Agregá campos en Configuración para ver la vista previa.</p>
        ) : (
          <>
            <div className="rounded-sm border border-border bg-surface p-md font-body text-[13px] text-text">
              {plantilla.campos.map((campo, index) => (
                <span key={campo.id}>
                  {index > 0 && ' · '}
                  <span className="font-semibold">{campo.etiqueta}:</span> {ORIGEN_CAMPO_EJEMPLOS[campo.origen]}
                </span>
              ))}
              <p className="m-0 mt-sm font-body text-xs text-muted">
                Los valores reales se completarán al generar cada factura.
              </p>
            </div>
            <p className="m-0 text-center font-body text-xs text-faint">Solo lectura — no se puede editar desde acá</p>
          </>
        )}
      </Card>
    </div>
  );
}
