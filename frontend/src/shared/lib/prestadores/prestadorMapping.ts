// Mapeo puro fila<->dominio para Prestadores (design.md D1/D2/D3 del change `prestadores-crud`).
// Funciones exportadas, sin red, sin `any`, sin `as`. `SupabasePrestadorRepository.ts` es la
// única capa de I/O; acá solo se traduce — espejo 1:1 de `obraSocialMapping.ts`.
//
// `DEFAULT_PLAZO_COBRO_DIAS`/`DEFAULT_TIPO_COMPROBANTE` se mudan acá desde `obraSocialMapping.ts`
// (§2.1 de este mismo change) junto con las columnas que respaldan (D3/D4, supuesto #3, sin
// confirmar con Andrea).

import type { ActualizacionPrestador, NuevoPrestador, Prestador } from '../../types/prestador';
import type { TipoComprobante } from '../../types/obraSocial';

// Type guard mínimo sobre `unknown` para filas que llegan de PostgREST — mismo criterio que
// `obraSocialMapping.ts`/`pacienteMapping.ts`.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

// -------------------------------------------------------------------------------------------
// Defaults documentados (design.md D3/D4) — nunca hardcodeados aguas abajo del mapeo; si el valor
// real de la base no pertenece a la unión cerrada correspondiente (o es NULL/no numérico), el
// mapeo cae acá en vez de romper el prestador. Mismos valores que el `DEFAULT`/`CHECK` de la
// migración `20260801100000_prestadores_condiciones.sql`.
// -------------------------------------------------------------------------------------------

const DEFAULT_PLAZO_COBRO_DIAS = 90;

const TIPOS_COMPROBANTE_VALIDOS = new Set<TipoComprobante>(['A', 'B', 'C']);
const DEFAULT_TIPO_COMPROBANTE: TipoComprobante = 'A';

function parseTipoComprobante(value: unknown): TipoComprobante {
  return typeof value === 'string' && TIPOS_COMPROBANTE_VALIDOS.has(value as TipoComprobante)
    ? (value as TipoComprobante)
    : DEFAULT_TIPO_COMPROBANTE;
}

function parsePlazoCobroDias(value: unknown): number {
  return typeof value === 'number' ? value : DEFAULT_PLAZO_COBRO_DIAS;
}

// -------------------------------------------------------------------------------------------
// Vínculo N:N (design.md D2) — embed `obra_social_prestador ( obra_social_id )` de la misma
// consulta. Tolerante a embed ausente, `null` o malformado -> `[]`, nunca rompe el prestador.
// -------------------------------------------------------------------------------------------

interface VinculoRow {
  obra_social_id: string;
}

function esVinculoRow(value: unknown): value is VinculoRow {
  return isRecord(value) && typeof value.obra_social_id === 'string';
}

function parseObrasSocialesIds(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  return rows.filter(esVinculoRow).map((row) => row.obra_social_id);
}

/**
 * `Prestador` con el vínculo de ObrasSociales ya parseado. No forma parte del contrato de lectura
 * declarado por `PrestadorRepository` (que solo expone `Prestador` — D1): es el valor interno
 * que usa `SupabasePrestadorRepository` para el diff de `update()` (D2) y queda disponible, vía
 * subtipado estructural, para quien consuma el vínculo en la UI (§5, work unit futuro).
 */
export interface PrestadorConVinculo extends Prestador {
  obrasSocialesIds: string[];
}

/**
 * Type guard estructural (design.md D2, tasks.md 5.1): todo `Prestador` que devuelve
 * `SupabasePrestadorRepository` (`list`/`getById`/`listarPorObraSocial`) es en runtime un
 * `PrestadorConVinculo` — `parsePrestadorRow` siempre completa `obrasSocialesIds` — pero el
 * contrato declarado de `PrestadorRepository` solo expone `Prestador` (D1), sin ese campo. La UI
 * que necesita leer el vínculo para precargar el multi-select de `PrestadorForm` (§5, work unit
 * futuro) angosta con este guard en vez de un cast `as` (regla dura: nunca `any`, angostar en vez
 * de castear). Un `Prestador` armado a mano en un test (sin pasar por el mapeo) da `false`.
 */
export function tieneVinculo(prestador: Prestador): prestador is PrestadorConVinculo {
  return 'obrasSocialesIds' in prestador;
}

/** Fila de `obra_social.prestadores` (con el embed del vínculo) -> `PrestadorConVinculo`.
 * Renombre `razon_social`->`razonSocial`, NULLables -> `undefined`, `tipo_comprobante`/
 * `plazo_cobro_dias` inválidos -> defaults. */
export function parsePrestadorRow(row: unknown): PrestadorConVinculo {
  const record = isRecord(row) ? row : {};

  return {
    id: typeof record.id === 'string' ? record.id : '',
    razonSocial: typeof record.razon_social === 'string' ? record.razon_social : '',
    cuit: typeof record.cuit === 'string' ? record.cuit : '',
    direccion: readOptionalString(record, 'direccion'),
    telefono: readOptionalString(record, 'telefono'),
    plazoCobroDias: parsePlazoCobroDias(record.plazo_cobro_dias),
    tipoComprobante: parseTipoComprobante(record.tipo_comprobante),
    obrasSocialesIds: parseObrasSocialesIds(record.obra_social_prestador),
  };
}

// -------------------------------------------------------------------------------------------
// toCrearPrestadorPayload / toActualizarPrestadorPayload
// -------------------------------------------------------------------------------------------

export interface CrearPrestadorPayload {
  razon_social: string;
  cuit: string;
  direccion: string | null;
  telefono: string | null;
  plazo_cobro_dias: number;
  tipo_comprobante: TipoComprobante;
}

function vacioANull(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

/** Arma el payload de `.insert()` sobre `obra_social.prestadores` (D1 — sin RPC). Claves en
 * snake_case, espejando `20260801100000_prestadores_condiciones.sql`. `obrasSocialesIds` no
 * viaja acá: `NuevoPrestador` (Omit<Prestador,'id'>) ni siquiera lo declara — el vínculo inicial,
 * si lo hay, se resuelve con un `update()` posterior (mismo patrón simétrico de `ObraSocial`). */
export function toCrearPrestadorPayload(nuevo: NuevoPrestador): CrearPrestadorPayload {
  return {
    razon_social: nuevo.razonSocial,
    cuit: nuevo.cuit,
    direccion: vacioANull(nuevo.direccion),
    telefono: vacioANull(nuevo.telefono),
    plazo_cobro_dias: nuevo.plazoCobroDias,
    tipo_comprobante: nuevo.tipoComprobante,
  };
}

/** Payload parcial de `.update()`: clave ausente en `ActualizacionPrestador` -> la clave NO
 * aparece en el objeto devuelto (semántica parcial, mismo criterio que
 * `toActualizarObraSocialPayload`). `obrasSocialesIds` NUNCA viaja en este payload: D2 lo resuelve
 * por diff dentro del repository (`SupabasePrestadorRepository.update`), no como columna plana. */
export function toActualizarPrestadorPayload(cambios: ActualizacionPrestador): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (cambios.razonSocial !== undefined) payload.razon_social = cambios.razonSocial;
  if (cambios.cuit !== undefined) payload.cuit = cambios.cuit;
  if (cambios.direccion !== undefined) payload.direccion = vacioANull(cambios.direccion);
  if (cambios.telefono !== undefined) payload.telefono = vacioANull(cambios.telefono);
  if (cambios.plazoCobroDias !== undefined) payload.plazo_cobro_dias = cambios.plazoCobroDias;
  if (cambios.tipoComprobante !== undefined) payload.tipo_comprobante = cambios.tipoComprobante;

  return payload;
}
