// Mapeo puro API<->dominio para Autorizacion (design.md D1/D5/D6/D6b del change
// `integracion-presupuestos`). Funciones exportadas, sin red, sin `any`, sin `as`.
// `SupabaseAutorizacionRepository.ts` (sección 3) es la única capa de I/O; acá solo se traduce.
//
// ⚠️ El contrato de referencia es el `toApi()` real de `supabase/functions/autorizaciones/index.ts`
// (ya en camelCase: `id`, `presupuestoId`, `estado`, `fechaRespuesta?`, `montoAutorizado?`,
// `vigenciaDesde?`, `cupoMensualDias?`, `cupoMensualKm?`, `archivoUrl?`), verificado en
// tasks.md 1.1 — no lo que este comentario o el design.md digan si algún día cambia el contrato
// real.

import type {
  ActualizacionAutorizacion,
  ArchivoAdjunto,
  Autorizacion,
  EstadoAutorizacion,
  NuevaAutorizacion,
} from '../../types/presupuesto';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

function readOptionalBoolean(record: Record<string, unknown>, key: string): boolean | undefined {
  const value = record[key];
  return typeof value === 'boolean' ? value : undefined;
}

const ESTADOS_VALIDOS = new Set<EstadoAutorizacion>(['pendiente', 'autorizada', 'judicializada', 'rechazada']);
const DEFAULT_ESTADO: EstadoAutorizacion = 'pendiente';

/** `estado` nulo o fuera de la unión cerrada `EstadoAutorizacion` cae al default `'pendiente'`
 * (design.md D6) — es el `DEFAULT` real de la columna `facturacion.autorizacion.estado`, no una
 * invención del frontend. */
function parseEstado(value: unknown): EstadoAutorizacion {
  return typeof value === 'string' && ESTADOS_VALIDOS.has(value as EstadoAutorizacion)
    ? (value as EstadoAutorizacion)
    : DEFAULT_ESTADO;
}

// -------------------------------------------------------------------------------------------
// 2.5/3.1/3.2 — parseAutorizacionApi
// -------------------------------------------------------------------------------------------

/** `archivoNombre`/`archivoCargadoEn`/`archivoUrl` (clave del objeto en el bucket, D4 de
 * integracion-documentos-autorizaciones) -> `ArchivoAdjunto`. Lee los tres campos DIRECTO de la
 * fila de la EF (Fase 2), nunca los deriva de `fechaRespuesta` (fecha en que respondió la obra
 * social, un concepto distinto de "cuándo se cargó el archivo" — la derivación vieja, vía
 * `mapArchivoUrl`, fabricaba un dato). `nombre`/`cargadoEn` son obligatorios para armar el
 * `ArchivoAdjunto`: si uno falta, se descarta entero (`undefined`) en vez de fabricar un archivo
 * parcial. `clave` es lo único opcional (`archivoUrl` podría faltar en una fila inconsistente sin
 * que eso invalide nombre/fecha ya persistidos). */
function parseArchivo(value: Record<string, unknown>): ArchivoAdjunto | undefined {
  const nombre = readOptionalString(value, 'archivoNombre');
  const cargadoEn = readOptionalString(value, 'archivoCargadoEn');
  if (nombre === undefined || cargadoEn === undefined) return undefined;

  return {
    nombre,
    cargadoEn,
    clave: readOptionalString(value, 'archivoUrl'),
    // 5.6/D6c: `archivoTipoMime` puede faltar en filas subidas antes del 2026-08-18 (bucket vivo
    // desde esa fecha) — `undefined` ahí, nunca inferido acá (el fallback por extensión vive en
    // `VistaPreviaArchivo`, D6 "Fallback acotado", no en el mapping).
    tipoMime: readOptionalString(value, 'archivoTipoMime'),
  };
}

/** Fila del `toApi()` de la Edge Function `autorizaciones` -> `Autorizacion` del dominio. A
 * diferencia de `Presupuesto`, acá solo `id`/`presupuestoId` son obligatorios para no descartar la
 * fila: el resto de los campos son opcionales en el dominio o tienen default (`estado`). Sin
 * `presupuestoId` no hay forma de vincular la autorización a nada -> se descarta (`null`). */
export function parseAutorizacionApi(value: unknown): Autorizacion | null {
  if (!isRecord(value)) return null;

  const { id, presupuestoId, estado } = value;

  if (typeof id !== 'string') return null;
  if (typeof presupuestoId !== 'string') return null;

  return {
    id,
    presupuestoId,
    estado: parseEstado(estado),
    fechaRespuesta: readOptionalString(value, 'fechaRespuesta'),
    montoAutorizado: readOptionalNumber(value, 'montoAutorizado'),
    vigenciaDesde: readOptionalString(value, 'vigenciaDesde'),
    // 5.6: vigenciaHasta/conDependencia (design.md D1/D3, Discrepancias 2 y 3).
    vigenciaHasta: readOptionalString(value, 'vigenciaHasta'),
    conDependencia: readOptionalBoolean(value, 'conDependencia'),
    cupoMensualDias: readOptionalNumber(value, 'cupoMensualDias'),
    cupoMensualKm: readOptionalNumber(value, 'cupoMensualKm'),
    archivo: parseArchivo(value),
    // 3.6 (autorizacion-mensual, design.md D2/D3): ausente = fila legacy sin período, nunca se
    // deriva de fechaRespuesta/vigenciaDesde acá tampoco (mismo criterio que `archivo`, arriba).
    periodoMes: readOptionalString(value, 'periodoMes'),
  };
}

// -------------------------------------------------------------------------------------------
// 2.6 — toCrearAutorizacionPayload (body del POST)
// -------------------------------------------------------------------------------------------

/** Body real de `POST /autorizaciones` (`toDb()` de la Edge Function, verificado en tasks.md 1.1).
 * `presupuestoId` y `estado` son las únicas claves obligatorias del dominio (`NuevaAutorizacion`);
 * el resto solo viaja si el llamador lo pasó — mismo criterio que 2.4/D6b, para no mandar `null` ni
 * `undefined` explícitos donde el servidor espera la clave ausente. Igual que en Presupuesto (D5),
 * `archivo` nunca se traduce a `archivoUrl`: no hay URL de origen de la que partir. */
export interface CrearAutorizacionPayload {
  presupuestoId: string;
  estado: EstadoAutorizacion;
  fechaRespuesta?: string;
  montoAutorizado?: number;
  vigenciaDesde?: string;
  // 5.6: vigenciaHasta/conDependencia (design.md D1/D3).
  vigenciaHasta?: string;
  conDependencia?: boolean;
  cupoMensualDias?: number;
  cupoMensualKm?: number;
  // 3.6 (autorizacion-mensual): ausente = no se cargó mes (legacy), nunca se manda `null`.
  periodoMes?: string;
}

export function toCrearAutorizacionPayload(nueva: NuevaAutorizacion): CrearAutorizacionPayload {
  const payload: CrearAutorizacionPayload = {
    presupuestoId: nueva.presupuestoId,
    estado: nueva.estado,
  };

  if (nueva.fechaRespuesta !== undefined) payload.fechaRespuesta = nueva.fechaRespuesta;
  if (nueva.montoAutorizado !== undefined) payload.montoAutorizado = nueva.montoAutorizado;
  if (nueva.vigenciaDesde !== undefined) payload.vigenciaDesde = nueva.vigenciaDesde;
  // 5.6: mismo criterio D6b que el resto — `conDependencia` puede ser `false` (SD decidido), el
  // chequeo es `!== undefined`, nunca "truthy".
  if (nueva.vigenciaHasta !== undefined) payload.vigenciaHasta = nueva.vigenciaHasta;
  if (nueva.conDependencia !== undefined) payload.conDependencia = nueva.conDependencia;
  if (nueva.cupoMensualDias !== undefined) payload.cupoMensualDias = nueva.cupoMensualDias;
  if (nueva.cupoMensualKm !== undefined) payload.cupoMensualKm = nueva.cupoMensualKm;
  // 3.6: mismo patrón `!== undefined` que el resto de los campos opcionales de este archivo.
  if (nueva.periodoMes !== undefined) payload.periodoMes = nueva.periodoMes;

  return payload;
}

// -------------------------------------------------------------------------------------------
// 2.6 — toActualizarAutorizacionPayload (semántica parcial, D6b)
// -------------------------------------------------------------------------------------------

/** Body real de `PATCH /autorizaciones/:id`. Mismo criterio que
 * `toActualizarPresupuestoPayload` (2.4): clave ausente en `ActualizacionAutorizacion` significa
 * "no tocar" y NO aparece en el objeto devuelto. `archivo` nunca se traduce a `archivoUrl` (D5). */
export function toActualizarAutorizacionPayload(cambios: ActualizacionAutorizacion): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (cambios.presupuestoId !== undefined) payload.presupuestoId = cambios.presupuestoId;
  if (cambios.estado !== undefined) payload.estado = cambios.estado;
  if (cambios.fechaRespuesta !== undefined) payload.fechaRespuesta = cambios.fechaRespuesta;
  if (cambios.montoAutorizado !== undefined) payload.montoAutorizado = cambios.montoAutorizado;
  if (cambios.vigenciaDesde !== undefined) payload.vigenciaDesde = cambios.vigenciaDesde;
  // 5.6: vigenciaHasta/conDependencia — mismo criterio D6b, incluye `conDependencia: false`
  // explícito (desmarcar CD/SD aunque el presupuesto lo tenga marcado, requisito literal de D3).
  if (cambios.vigenciaHasta !== undefined) payload.vigenciaHasta = cambios.vigenciaHasta;
  if (cambios.conDependencia !== undefined) payload.conDependencia = cambios.conDependencia;
  if (cambios.cupoMensualDias !== undefined) payload.cupoMensualDias = cambios.cupoMensualDias;
  if (cambios.cupoMensualKm !== undefined) payload.cupoMensualKm = cambios.cupoMensualKm;
  // 3.6: editable en edición (design.md D11 — re-chequeo de unicidad lo hace el repository/EF).
  if (cambios.periodoMes !== undefined) payload.periodoMes = cambios.periodoMes;

  return payload;
}
