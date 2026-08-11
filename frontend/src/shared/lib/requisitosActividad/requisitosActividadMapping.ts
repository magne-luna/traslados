// Mapeo puro fila<->dominio para "ítems requeridos por tipo de actividad" (design.md D1-D5 del
// change `documentos-checklist-items-por-actividad`, tasks.md §4.1). Mismo criterio que
// `obraSocialMapping.ts`: funciones exportadas, sin red, sin `any`, sin `as`.
// `SupabaseRequisitosActividadRepository.ts` es la única capa de I/O; acá solo se traduce.

import type { ChecklistItem } from '../../types/documento';
import type { RequisitosPorTipo, TipoActividad } from './RequisitosActividadRepository';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface RequisitoActividadParseado {
  tipoLugar: TipoActividad;
  orden: number;
  item: ChecklistItem;
}

/** Fila de `obra_social.requisitos_actividad` con su `tipos_documento` embebido -> ítem parseado.
 * `ChecklistItem.id` es el de `tipos_documento`, nunca el de `requisitos_actividad` — mismo
 * criterio (D2) que `parseRequisitoRow` de `obraSocialMapping.ts`: la fila de vínculo es
 * identidad-libre. Fila sin el embed, o con `tipo_lugar` que no es string -> `null` (se descarta,
 * no rompe el resto de la colección). */
export function parseRequisitoActividadRow(row: unknown): RequisitoActividadParseado | null {
  if (!isRecord(row)) return null;

  const tipoLugar = row.tipo_lugar;
  if (typeof tipoLugar !== 'string') return null;

  const tipoDocumento = row.tipos_documento;
  if (!isRecord(tipoDocumento)) return null;

  const id = tipoDocumento.id;
  const nombre = tipoDocumento.tipo;
  if (typeof id !== 'string' || typeof nombre !== 'string') return null;

  return {
    tipoLugar: tipoLugar as TipoActividad,
    orden: typeof row.orden === 'number' ? row.orden : 0,
    item: {
      id,
      nombre,
      requerido: typeof row.requerido === 'boolean' ? row.requerido : true,
    },
  };
}

/** Colección de filas -> `RequisitosPorTipo` agrupado y ordenado (orden asc, desempate por id —
 * mismo criterio determinista que `ordenarPorOrdenYId` de `obraSocialMapping.ts`). Un tipo sin
 * ninguna fila configurada no aparece como clave: `Partial`, nunca un array vacío forzado — es el
 * default documentado (design.md D2). */
export function agruparPorTipo(rows: unknown): RequisitosPorTipo {
  if (!Array.isArray(rows)) return {};

  const parseadas = rows
    .map((row) => parseRequisitoActividadRow(row))
    .filter((parseada): parseada is RequisitoActividadParseado => parseada !== null);

  const porTipo: Record<string, RequisitoActividadParseado[]> = {};
  for (const parseada of parseadas) {
    (porTipo[parseada.tipoLugar] ??= []).push(parseada);
  }

  const resultado: RequisitosPorTipo = {};
  for (const [tipo, items] of Object.entries(porTipo)) {
    const ordenados = [...items].sort((a, b) => (a.orden !== b.orden ? a.orden - b.orden : a.item.id.localeCompare(b.item.id)));
    resultado[tipo as TipoActividad] = ordenados.map((parseada) => parseada.item);
  }
  return resultado;
}

interface ItemPayload {
  nombre: string;
  requerido: boolean;
}

/** Arma el argumento `p_items` de `obra_social.actualizar_requisitos_actividad` (D5). El orden se
 * deriva SIEMPRE del índice del array, mismo criterio que `checklistAPayload` de
 * `obraSocialMapping.ts` — nunca de una columna que el frontend no conoce todavía. El `id` del
 * `ChecklistItem` no viaja: lo resuelve el get-or-create del servidor sobre `tipos_documento`. */
export function toActualizarRequisitosActividadPayload(items: ChecklistItem[]): ItemPayload[] {
  return items.map((item) => ({ nombre: item.nombre, requerido: item.requerido }));
}
