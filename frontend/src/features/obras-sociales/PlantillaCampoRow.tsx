import { useState, type DragEvent } from 'react';
import { InlineIcon } from '../../design-system/components';
import { iconArrastrar, iconFlechaAbajo, iconFlechaArriba, iconTacho } from '../../design-system/icons';
import type { PlantillaCampo } from '../../shared/types/obraSocial';
import { ORIGEN_CAMPO_LABELS, ORIGEN_CAMPO_OPTIONS } from './origenCampoOptions';

interface PlantillaCampoRowProps {
  campo: PlantillaCampo;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onChangeEtiqueta: (id: string, etiqueta: string) => void;
  onChangeOrigen: (id: string, origen: PlantillaCampo['origen']) => void;
  onRemove: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onDragStart: (index: number) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (index: number) => void;
}

// Fila de PlantillaFacturaEditor (extraída para mantener el editor < 200 líneas). Drag-and-drop
// nativo HTML5 + botones subir/bajar como fallback accesible por teclado — mismo patrón que
// ChecklistItemRow (WCAG 2.1 AA, design.md Decisión 4).
export function PlantillaCampoRow({
  campo,
  index,
  isFirst,
  isLast,
  onChangeEtiqueta,
  onChangeOrigen,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}: PlantillaCampoRowProps) {
  // Estado local para que tipear se sienta instantáneo: `onChangeEtiqueta` persiste contra el
  // repository (mock con latencia artificial + recarga completa de la lista, ~700ms por golpe),
  // así que confirmar en cada tecla hacía que el input pareciera "trabado". Se sincroniza recién
  // al perder foco.
  const [etiquetaLocal, setEtiquetaLocal] = useState(campo.etiqueta);

  function commitEtiqueta() {
    const valor = etiquetaLocal.trim();
    if (valor && valor !== campo.etiqueta) onChangeEtiqueta(campo.id, valor);
    else if (!valor) setEtiquetaLocal(campo.etiqueta);
  }

  return (
    <li
      draggable
      onDragStart={() => onDragStart(index)}
      onDragOver={onDragOver}
      onDrop={() => onDrop(index)}
      className="flex flex-wrap items-center gap-sm rounded-sm border border-border bg-surface px-md py-sm"
    >
      <span aria-hidden="true" className="cursor-grab text-faint">
        <InlineIcon>{iconArrastrar}</InlineIcon>
      </span>

      <input
        aria-label={`Etiqueta del campo ${campo.etiqueta}`}
        value={etiquetaLocal}
        onChange={(event) => setEtiquetaLocal(event.target.value)}
        onBlur={commitEtiqueta}
        className="min-w-0 flex-1 rounded-sm border border-border-strong bg-surface px-sm py-1.5 font-body text-[13px] text-text"
      />

      <select
        aria-label={`Origen del campo ${campo.etiqueta}`}
        value={campo.origen}
        onChange={(event) => onChangeOrigen(campo.id, event.target.value as PlantillaCampo['origen'])}
        className="rounded-sm border border-border-strong bg-surface px-sm py-1.5 font-body text-[13px] text-text"
      >
        {ORIGEN_CAMPO_OPTIONS.map((origen) => (
          <option key={origen} value={origen}>
            {ORIGEN_CAMPO_LABELS[origen]}
          </option>
        ))}
      </select>

      <button
        type="button"
        aria-label={`Subir ${campo.etiqueta}`}
        disabled={isFirst}
        onClick={() => onMoveUp(campo.id)}
        className="cursor-pointer rounded-sm border border-border-strong bg-surface px-xs py-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        <InlineIcon>{iconFlechaArriba}</InlineIcon>
      </button>
      <button
        type="button"
        aria-label={`Bajar ${campo.etiqueta}`}
        disabled={isLast}
        onClick={() => onMoveDown(campo.id)}
        className="cursor-pointer rounded-sm border border-border-strong bg-surface px-xs py-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        <InlineIcon>{iconFlechaAbajo}</InlineIcon>
      </button>
      <button
        type="button"
        aria-label={`Quitar ${campo.etiqueta}`}
        onClick={() => onRemove(campo.id)}
        className="cursor-pointer border-none bg-transparent p-0 text-danger"
      >
        <InlineIcon>{iconTacho}</InlineIcon>
      </button>
    </li>
  );
}
