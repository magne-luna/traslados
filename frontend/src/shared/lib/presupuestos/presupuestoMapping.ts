// Mapeo puro API<->dominio para Presupuesto (design.md D1/D5/D6/D6b del change
// `integracion-presupuestos`). Funciones exportadas, sin red, sin `any`, sin `as`.
// `SupabasePresupuestoRepository.ts` (sección 3) es la única capa de I/O; acá solo se traduce.
//
// ⚠️ El contrato de referencia es el `toApi()` real de `supabase/functions/presupuestos/index.ts`
// (ya en camelCase: `id`, `pacienteId`, `obraSocialId`, `monto`, `fechaEmision`, `archivoUrl?`),
// verificado en tasks.md 1.1 — no lo que este comentario o el design.md digan si algún día
// cambia el contrato real.

import type { ActualizacionPresupuesto, ArchivoAdjunto, NuevoPresupuesto, Presupuesto, PresupuestoLinea } from '../../types/presupuesto';

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
// 2.7 — lineas (REAPERTURA #13, decisión usuaria 2026-08-16)
// -------------------------------------------------------------------------------------------

/** Fila de `lineas` del `toApi()` de la Edge Function `presupuestos` -> `PresupuestoLinea`, o
 * `null` si no tiene la forma esperada (se descarta sola, sin tumbar la línea ni el presupuesto).
 * `id`/`prestacionId`/`monto` son los campos reales de `facturacion.presupuesto_linea`; `orden`
 * ausente se normaliza a 0 (el default real de la columna). */
function parseLineaPresupuestoApi(value: unknown): PresupuestoLinea | null {
  if (!isRecord(value)) return null;

  const { id, prestacionId, monto, orden } = value;
  if (typeof id !== 'string') return null;
  if (typeof prestacionId !== 'string') return null;
  if (typeof monto !== 'number') return null;

  return { id, prestacionId, monto, orden: typeof orden === 'number' ? orden : 0 };
}

/** `lineas` del `toApi()` (arreglo) -> `PresupuestoLinea[]`. Solo respeta un arreglo: cualquier
 * otra forma (clave ausente en presupuestos viejos o `por-prestacion`, contrato roto del
 * servidor) se normaliza a `undefined`, nunca se deja pasar un `null` ni se inventa un `[]`.
 * Las filas malformadas se descartan individualmente, sin tumbar las válidas (mismo criterio de
 * tolerancia que `parsePresupuestoApi` con filas del listado). */
function parseLineasApi(value: unknown): PresupuestoLinea[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const lineas: PresupuestoLinea[] = [];
  for (const fila of value) {
    const linea = parseLineaPresupuestoApi(fila);
    if (linea !== null) lineas.push(linea);
  }
  return lineas;
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
 * (`undefined`, `null`) se normaliza a `undefined`, nunca se deja pasar un `null` explícito.
 *
 * `lineas` (2.7, REAPERTURA #13): arreglo opcional que la EF adjunta en GET; ausente en
 * presupuestos `por-prestacion` y viejos. */
export function parsePresupuestoApi(value: unknown): Presupuesto | null {
  if (!isRecord(value)) return null;

  const { id, pacienteId, obraSocialId, monto, fechaEmision, archivoUrl, prestacionId, lineas } = value;

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
    lineas: parseLineasApi(lineas),
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
 * servidor con este payload.
 *
 * `lineas` (2.7, REAPERTURA #13): desglose de modalidad `general`. Cada línea viaja como
 * `{ prestacionId, monto, orden }` — SIN el `id` local del formulario: el servidor persiste filas
 * nuevas, el id de la línea se conoce recién en la respuesta (o en un GET posterior). */
export interface LineaPresupuestoPayload {
  prestacionId: string;
  monto: number;
  orden: number;
}

export interface CrearPresupuestoPayload {
  pacienteId: string;
  obraSocialId: string;
  monto: number;
  fechaEmision: string;
  archivoUrl?: string;
  prestacionId?: string;
  lineas?: LineaPresupuestoPayload[];
}

/** `prestacionId` (PR 2, 2.5): se incluye la clave únicamente cuando `nuevo.prestacionId` está
 * presente (modalidad `por-prestacion`, alta vía `createLote`) — cuando está `undefined`
 * (modalidad `general`) la clave queda directamente ausente del body, nunca se manda `undefined`
 * explícito. Mismo criterio que el resto de este archivo (D5/D6b): la ausencia de una clave es una
 * decisión, no un accidente de serialización.
 *
 * `lineas` (2.7, REAPERTURA #13): mismo criterio — se incluye solo cuando `nuevo.lineas` está
 * presente (modalidad `general` con desglose cargado), mapeando al contrato del servidor
 * (`{ prestacionId, monto, orden }`, sin el id local). */
export function toCrearPresupuestoPayload(nuevo: NuevoPresupuesto): CrearPresupuestoPayload {
  const payload: CrearPresupuestoPayload = {
    pacienteId: nuevo.pacienteId,
    obraSocialId: nuevo.obraSocialId,
    monto: nuevo.monto,
    fechaEmision: nuevo.fechaEmision,
  };

  if (nuevo.prestacionId !== undefined) payload.prestacionId = nuevo.prestacionId;
  if (nuevo.lineas !== undefined) {
    payload.lineas = nuevo.lineas.map((linea) => ({ prestacionId: linea.prestacionId, monto: linea.monto, orden: linea.orden }));
  }

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
  // 2.7: `lineas` NUNCA viaja en una actualización, ni siquiera si viene en `cambios` — la
  // edición no toca el desglose persistido (D9: "la edición no bifurca"; la edición solo muestra
  // el campo `monto` simple). Aceptar lineas acá abriría un camino de reemplazo sin reemplazo
  // atómico (la PATCH de PostgREST no puede borrar+reinsertar en una transacción).
  // payload.lineas queda deliberadamente ausente.

  return payload;
}
