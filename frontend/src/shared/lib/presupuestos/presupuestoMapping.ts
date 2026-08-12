// Mapeo puro API<->dominio para Presupuesto (design.md D1/D5/D6/D6b del change
// `integracion-presupuestos`). Funciones exportadas, sin red, sin `any`, sin `as`.
// `SupabasePresupuestoRepository.ts` (sección 3) es la única capa de I/O; acá solo se traduce.
//
// ⚠️ El contrato de referencia es el `toApi()` real de `supabase/functions/presupuestos/index.ts`
// (ya en camelCase: `id`, `pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivoUrl?`),
// verificado en tasks.md 1.1 — no lo que este comentario o el design.md digan si algún día
// cambia el contrato real.

import type { ActualizacionPresupuesto, ArchivoAdjunto, NuevoPresupuesto, Presupuesto } from '../../types/presupuesto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// -------------------------------------------------------------------------------------------
// 2.2 — mapArchivoUrl (archivoUrl -> ArchivoAdjunto, D5 opción A: mapeo no destructivo)
// -------------------------------------------------------------------------------------------

/** `archivo_url` (columna real, única fuente de verdad del adjunto) -> `ArchivoAdjunto` del
 * dominio. `nombre` es el último segmento del path, sin querystring, decodificado con
 * `decodeURIComponent` (D5); `cargadoEn` es SIEMPRE la fecha de la propia entidad (nunca
 * `new Date()`, que mostraría una fecha distinta en cada recarga — es la razón escrita en
 * `20260730120000_revert_presupuesto_archivo_meta.sql`). `archivoUrl` ausente/vacío -> `undefined`,
 * nunca se inventa un `ArchivoAdjunto` vacío. */
export function mapArchivoUrl(archivoUrl: unknown, cargadoEn: string): ArchivoAdjunto | undefined {
  if (typeof archivoUrl !== 'string' || archivoUrl === '') return undefined;

  const sinQuerystring = archivoUrl.split('?')[0] ?? archivoUrl;
  const segmentos = sinQuerystring.split('/');
  const ultimoSegmento = segmentos[segmentos.length - 1];
  if (!ultimoSegmento) return undefined;

  let nombre: string;
  try {
    nombre = decodeURIComponent(ultimoSegmento);
  } catch {
    // decodeURIComponent puede tirar URIError con un % mal formado — se usa el segmento crudo
    // antes que descartar el archivo entero por un nombre raro.
    nombre = ultimoSegmento;
  }

  return { nombre, cargadoEn };
}

// -------------------------------------------------------------------------------------------
// 2.1 — parsePresupuestoApi
// -------------------------------------------------------------------------------------------

/** Fila del `toApi()` de la Edge Function `presupuestos` -> `Presupuesto` del dominio. `monto` y
 * `fechaEmision` son `NOT NULL` en el tipo de dominio pero nullable en la base (design.md D6): una
 * fila sin uno de los dos se descarta entera (`null`), no se inventa un valor. `archivoUrl`
 * ausente/vacío no descarta la fila: `archivo` queda `undefined` (D5).
 *
 * `prestacionId` (`presupuesto-prestaciones` PR 2, D9/2.4): la columna real es nullable
 * (`prestacion_id UUID NULL`), y `toApi()` de la Edge Function la expone como `prestacionId: string
 * | undefined` (nunca `null` — ver `supabase/functions/presupuestos/index.ts`). Esta función NO
 * descarta la fila si `prestacionId` no es un `string`: cualquier valor que no sea `string`
 * (`undefined`, `null`) se normaliza a `undefined`, nunca se deja pasar un `null` explícito. */
export function parsePresupuestoApi(value: unknown): Presupuesto | null {
  if (!isRecord(value)) return null;

  const { id, pacienteId, obraSocialId, monto, fechaEmision, archivoUrl, prestacionId } = value;

  if (typeof id !== 'string') return null;
  if (typeof pacienteId !== 'string') return null;
  if (typeof obraSocialId !== 'string') return null;
  if (typeof monto !== 'number') return null;
  if (typeof fechaEmision !== 'string') return null;

  return {
    id,
    pacienteId,
    obraSocialId,
    monto,
    fechaEmision,
    archivo: mapArchivoUrl(archivoUrl, fechaEmision),
    prestacionId: typeof prestacionId === 'string' ? prestacionId : undefined,
  };
}

// -------------------------------------------------------------------------------------------
// 2.3 — toCrearPresupuestoPayload (body del POST)
// -------------------------------------------------------------------------------------------

/** Body real de `POST /presupuestos` (`toDb()` de la Edge Function, verificado en tasks.md 1.1).
 * `archivoUrl` es la única clave opcional del contrato del servidor, pero esta función NUNCA la
 * completa: `ArchivoAdjunto` (dominio) no tiene ninguna URL de origen -sea que venga de una
 * lectura previa (round-trip) o de un archivo recién elegido en el input-, así que no hay de dónde
 * reconstruirla sin inventar un valor (D5). El adjunto elegido en el formulario no viaja al
 * servidor con este payload. */
export interface CrearPresupuestoPayload {
  pacienteId: string;
  obraSocialId: string;
  monto: number;
  fechaEmision: string;
  archivoUrl?: string;
  prestacionId?: string;
}

/** `prestacionId` (PR 2, 2.5): se incluye la clave únicamente cuando `nuevo.prestacionId` está
 * presente (modalidad `por-prestacion`, alta vía `createLote`) — cuando está `undefined`
 * (modalidad `general`) la clave queda directamente ausente del body, nunca se manda `undefined`
 * explícito. Mismo criterio que el resto de este archivo (D5/D6b): la ausencia de una clave es una
 * decisión, no un accidente de serialización. */
export function toCrearPresupuestoPayload(nuevo: NuevoPresupuesto): CrearPresupuestoPayload {
  const payload: CrearPresupuestoPayload = {
    pacienteId: nuevo.pacienteId,
    obraSocialId: nuevo.obraSocialId,
    monto: nuevo.monto,
    fechaEmision: nuevo.fechaEmision,
  };

  if (nuevo.prestacionId !== undefined) payload.prestacionId = nuevo.prestacionId;

  return payload;
}

// -------------------------------------------------------------------------------------------
// 2.4 — toActualizarPresupuestoPayload (semántica parcial, D6b)
// -------------------------------------------------------------------------------------------

/** Body real de `PATCH /presupuestos/:id`. `ActualizacionPresupuesto` es `Partial<…>`: clave
 * ausente significa "no tocar" (D6b), así que esta función NO rellena ninguna clave que el
 * llamador no haya pasado — ni siquiera con `undefined` explícito, la clave directamente no
 * aparece en el objeto devuelto. Es exactamente el agujero que en `integracion-obra-social` D6
 * borró checklists enteros. `archivo` nunca se traduce a `archivoUrl`, mismo motivo que 2.3 (D5):
 * no hay URL de origen de la que partir. */
export function toActualizarPresupuestoPayload(cambios: ActualizacionPresupuesto): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (cambios.pacienteId !== undefined) payload.pacienteId = cambios.pacienteId;
  if (cambios.obraSocialId !== undefined) payload.obraSocialId = cambios.obraSocialId;
  if (cambios.monto !== undefined) payload.monto = cambios.monto;
  if (cambios.fechaEmision !== undefined) payload.fechaEmision = cambios.fechaEmision;
  // 2.6: misma trampa que D6b (integracion-obra-social D6) — clave ausente en `cambios` (nunca
  // tocada por el usuario) MUST NOT viajar como `undefined` explícito en el body.
  if (cambios.prestacionId !== undefined) payload.prestacionId = cambios.prestacionId;

  return payload;
}
