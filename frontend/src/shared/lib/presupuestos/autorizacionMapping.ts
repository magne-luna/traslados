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
  Autorizacion,
  EstadoAutorizacion,
  NuevaAutorizacion,
} from '../../types/presupuesto';
import { mapArchivoUrl } from './presupuestoMapping';

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
// 2.5 — parseAutorizacionApi
// -------------------------------------------------------------------------------------------

/** Fila del `toApi()` de la Edge Function `autorizaciones` -> `Autorizacion` del dominio. A
 * diferencia de `Presupuesto`, acá solo `id`/`presupuestoId` son obligatorios para no descartar la
 * fila: el resto de los campos son opcionales en el dominio o tienen default (`estado`). Sin
 * `presupuestoId` no hay forma de vincular la autorización a nada -> se descarta (`null`). */
export function parseAutorizacionApi(value: unknown): Autorizacion | null {
  if (!isRecord(value)) return null;

  const { id, presupuestoId, estado, archivoUrl } = value;

  if (typeof id !== 'string') return null;
  if (typeof presupuestoId !== 'string') return null;

  const fechaRespuesta = readOptionalString(value, 'fechaRespuesta');

  return {
    id,
    presupuestoId,
    estado: parseEstado(estado),
    fechaRespuesta,
    montoAutorizado: readOptionalNumber(value, 'montoAutorizado'),
    vigenciaDesde: readOptionalString(value, 'vigenciaDesde'),
    cupoMensualDias: readOptionalNumber(value, 'cupoMensualDias'),
    cupoMensualKm: readOptionalNumber(value, 'cupoMensualKm'),
    archivo: mapArchivoUrl(archivoUrl, fechaRespuesta ?? ''),
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
  cupoMensualDias?: number;
  cupoMensualKm?: number;
}

export function toCrearAutorizacionPayload(nueva: NuevaAutorizacion): CrearAutorizacionPayload {
  const payload: CrearAutorizacionPayload = {
    presupuestoId: nueva.presupuestoId,
    estado: nueva.estado,
  };

  if (nueva.fechaRespuesta !== undefined) payload.fechaRespuesta = nueva.fechaRespuesta;
  if (nueva.montoAutorizado !== undefined) payload.montoAutorizado = nueva.montoAutorizado;
  if (nueva.vigenciaDesde !== undefined) payload.vigenciaDesde = nueva.vigenciaDesde;
  if (nueva.cupoMensualDias !== undefined) payload.cupoMensualDias = nueva.cupoMensualDias;
  if (nueva.cupoMensualKm !== undefined) payload.cupoMensualKm = nueva.cupoMensualKm;

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
  if (cambios.cupoMensualDias !== undefined) payload.cupoMensualDias = cambios.cupoMensualDias;
  if (cambios.cupoMensualKm !== undefined) payload.cupoMensualKm = cambios.cupoMensualKm;

  return payload;
}
