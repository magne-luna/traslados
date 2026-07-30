import type { DragEvent } from 'react';
import { InlineIcon } from '../../design-system/components';
import { iconArrastrar, iconDocumento, iconFlechaAbajo, iconFlechaArriba, iconTacho } from '../../design-system/icons';
import type { ChecklistItem } from '../../shared/types/documento';
import { usePuedeEscribir } from '../../shared/auth/usePuedeEscribir';

interface ChecklistItemRowProps {
  item: ChecklistItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  onToggleRequerido: (id: string) => void;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (index: number) => void;
}

// Fila de ChecklistEditor (extraída para mantener el editor < 200 líneas, react-best-practices
// compact rules). Drag-and-drop nativo HTML5 (design.md Decisión 4) + botones subir/bajar como
// fallback accesible por teclado (WCAG 2.1 AA — frontend-ui-design compact rules): el reorder
// NUNCA depende solo del arrastre.
//
// gateo-obrasocial (design.md D4): el <fieldset disabled> que envuelve esta fila en
// ChecklistEditor cubre el checkbox de "requerido" y los 3 <button> nativos, pero NO el
// arrastre — un elemento `draggable` sigue arrastrándose dentro de un fieldset deshabilitado.
// Por eso `draggable` y los handlers de arrastre se condicionan acá, aparte, a
// usePuedeEscribir().
export function ChecklistItemRow({
  item,
  index,
  isFirst,
  isLast,
  onToggleRequerido,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}: ChecklistItemRowProps) {
  const puedeEscribir = usePuedeEscribir();

  return (
    <li
      draggable={puedeEscribir}
      onDragStart={puedeEscribir ? () => onDragStart(index) : undefined}
      onDragOver={puedeEscribir ? onDragOver : undefined}
      onDrop={puedeEscribir ? () => onDrop(index) : undefined}
      className="flex flex-wrap items-center gap-sm rounded-sm border border-border bg-surface px-md py-sm"
    >
      <span aria-hidden="true" className="cursor-grab text-faint">
        <InlineIcon>{iconArrastrar}</InlineIcon>
      </span>
      <span aria-hidden="true" className="text-muted">
        <InlineIcon>{iconDocumento}</InlineIcon>
      </span>

      <span className="min-w-0 flex-1 truncate font-body text-[13px] text-text">{item.nombre}</span>

      <label className="flex items-center gap-xs font-body text-xs text-muted">
        {item.requerido && <span>Requerido</span>}
        <span className="relative inline-flex items-center">
          <input
            type="checkbox"
            aria-label={`Requerido — ${item.nombre}`}
            checked={item.requerido}
            onChange={() => onToggleRequerido(item.id)}
            className="peer sr-only"
          />
          <span className="h-5 w-9 rounded-pill bg-border-strong transition-colors peer-checked:bg-primary" />
          <span className="absolute left-0.5 h-4 w-4 rounded-pill bg-surface shadow-sm transition-transform peer-checked:translate-x-4" />
        </span>
      </label>

      <button
        type="button"
        aria-label={`Subir ${item.nombre}`}
        disabled={isFirst}
        onClick={() => onMoveUp(index)}
        className="cursor-pointer rounded-sm border border-border-strong bg-surface px-xs py-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        <InlineIcon>{iconFlechaArriba}</InlineIcon>
      </button>
      <button
        type="button"
        aria-label={`Bajar ${item.nombre}`}
        disabled={isLast}
        onClick={() => onMoveDown(index)}
        className="cursor-pointer rounded-sm border border-border-strong bg-surface px-xs py-xs disabled:cursor-not-allowed disabled:opacity-40"
      >
        <InlineIcon>{iconFlechaAbajo}</InlineIcon>
      </button>
      <button
        type="button"
        aria-label={`Quitar ${item.nombre}`}
        onClick={() => onRemove(item.id)}
        className="cursor-pointer border-none bg-transparent p-0 text-danger"
      >
        <InlineIcon>{iconTacho}</InlineIcon>
      </button>
    </li>
  );
}
