// Utilidad de reorder pura, compartida por ChecklistEditor y PlantillaFacturaEditor (Decisión 4
// de design.md de obras-sociales-ui): drag-and-drop nativo HTML5 usa `move`, los botones
// subir/bajar (fallback accesible, WCAG 2.1 AA) usan `moveUp`/`moveDown`. Sin dependencias.

/** Mueve el ítem en `fromIndex` a `toIndex`, sin mutar el array recibido. */
export function move<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length
  ) {
    return [...items];
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  if (moved === undefined) {
    return [...items];
  }
  next.splice(toIndex, 0, moved);
  return next;
}

/** Intercambia el ítem en `index` con su predecesor; no-op si ya está primero. */
export function moveUp<T>(items: readonly T[], index: number): T[] {
  return move(items, index, index - 1);
}

/** Intercambia el ítem en `index` con su sucesor; no-op si ya está último. */
export function moveDown<T>(items: readonly T[], index: number): T[] {
  return move(items, index, index + 1);
}
