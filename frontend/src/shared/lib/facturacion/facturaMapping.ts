import type {
  ActualizacionFactura,
  AsistenciaPrestacion,
  Cobro,
  EstadoFactura,
  Factura,
  IdentificadorFactura,
  IdentificadorOrigenFactura,
  NuevaFactura,
  NuevoCobro,
  TipoComprobante,
} from '../../types/factura';

// Mapeo puro fila<->dominio para Facturación (design.md D1/D2/D5/D7/D11 de `integracion-facturacion`,
// tasks.md sección 2). Funciones exportadas, sin red, sin `any`, sin `as` sobre datos externos.
// `SupabaseFacturaRepository.ts` / `SupabaseCobroRepository.ts` (sección 3/4) son la única capa de
// I/O; acá solo se traduce. Nadie importa este archivo todavía (fase enteramente aditiva).
//
// ⚠️ Nombres de tabla/columna tomados LITERALMENTE del schema REAL, verificado con
// `supabase db query --linked` (design.md §Context, 2026-07-31), no del docx: `fecha_init`,
// `fecha_tope`, `tipo`, `valor_km`/`cantidad_km`, `mes_facturado`/`anio_facturado`,
// `dependencia_y_retorno`, `fecha_estimada_cobro`, `fecha_factura` (D3), `domicilio_id`,
// `identificador_origen`+`identificador_valor`, `cobros.facturas_id` (OJO: plural).
// Los payloads snake_case espejan literalmente `20260812160000_factura_rpc.sql` (1B.2-1B.3).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' ? value : 0;
}

function readBoolean(record: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = record[key];
  return typeof value === 'boolean' ? value : fallback;
}

// -------------------------------------------------------------------------------------------
// 2.2/2.3 — el enum de estado (D2): la base tiene 5 literales con espacios, el dominio tiene 4
// con guiones. `pendiente` es sinónimo de lectura de `a-facturar`; nunca se escribe.
// -------------------------------------------------------------------------------------------

const ESTADOS_DESDE_BASE = new Map<string, EstadoFactura>([
  ['a facturar', 'a-facturar'],
  ['pendiente', 'a-facturar'],
  ['facturado', 'facturado'],
  ['cobrado', 'cobrado'],
  ['pagado parcialmente', 'pagado-parcialmente'],
]);

/** Total: cualquier literal fuera de los 5 conocidos (incluido `null`/`undefined`/no-string) cae a
 * `'a-facturar'` en vez de lanzar. Nunca romper el listado por un dato inesperado (D2, Risks). */
export function estadoDesdeBase(value: unknown): EstadoFactura {
  if (typeof value !== 'string') return 'a-facturar';
  return ESTADOS_DESDE_BASE.get(value) ?? 'a-facturar';
}

const ESTADOS_HACIA_BASE: Record<EstadoFactura, string> = {
  'a-facturar': 'a facturar',
  facturado: 'facturado',
  cobrado: 'cobrado',
  'pagado-parcialmente': 'pagado parcialmente',
};

/** El frontend no tiene forma de expresar `'pendiente'` y el circuito de estados no lo contempla
 * (D2): esta función nunca lo emite. */
export function estadoHaciaBase(estado: EstadoFactura): string {
  return ESTADOS_HACIA_BASE[estado];
}

// -------------------------------------------------------------------------------------------
// tipoComprobante: unión cerrada ('A'|'B'|'C'), igual criterio de totalidad que el estado — un
// valor NULL o fuera de rango cae al default documentado en vez de romper la fila (D11).
// -------------------------------------------------------------------------------------------

const TIPOS_COMPROBANTE_VALIDOS = new Set<TipoComprobante>(['A', 'B', 'C']);
const DEFAULT_TIPO_COMPROBANTE: TipoComprobante = 'A';

function parseTipoComprobante(value: unknown): TipoComprobante {
  return typeof value === 'string' && TIPOS_COMPROBANTE_VALIDOS.has(value as TipoComprobante)
    ? (value as TipoComprobante)
    : DEFAULT_TIPO_COMPROBANTE;
}

// -------------------------------------------------------------------------------------------
// 2.4 — colapso identificador_origen + identificador_valor -> identificadorFactura
// -------------------------------------------------------------------------------------------

const IDENTIFICADORES_ORIGEN_VALIDOS = new Set<IdentificadorOrigenFactura>(['paciente.dni', 'paciente.numeroAfiliado']);

/** Si cualquiera de las dos columnas es NULL (o no pertenece a la unión cerrada), el campo queda
 * AUSENTE — nunca un objeto con string vacío (D1). Es el snapshot congelado al emitir (IN-01): una
 * factura en `a-facturar` legítimamente no tiene ninguna de las dos. */
function parseIdentificadorFactura(origen: unknown, valor: unknown): IdentificadorFactura | undefined {
  if (typeof origen !== 'string' || !IDENTIFICADORES_ORIGEN_VALIDOS.has(origen as IdentificadorOrigenFactura)) {
    return undefined;
  }
  if (typeof valor !== 'string' || valor === '') return undefined;

  return { origen: origen as IdentificadorOrigenFactura, valor };
}

// -------------------------------------------------------------------------------------------
// 2.1/2.6 — parseFacturaRow: 11 renombres de columna + nullability (D11)
// -------------------------------------------------------------------------------------------

/** Fila plana de `facturacion.facturas` (sin la colección embebida) -> campos base del dominio.
 * `?? ''` para textuales, `?? 0` para numéricos, `estadoDesdeBase(...)` para el estado y
 * `parseTipoComprobante(...)` para el tipo de comprobante (D11): una fila parcial cargada por SQL
 * directo se lee como una factura incompleta pero coherente, nunca como `undefined` filtrándose. */
export function parseFacturaRow(row: unknown): Omit<Factura, 'asistencias'> {
  const record = isRecord(row) ? row : {};

  return {
    id: readString(record, 'id'),
    pacienteId: readString(record, 'paciente_id'),
    descripcion: readString(record, 'descripcion'),
    dias: readNumber(record, 'dias'),
    valorKm: readNumber(record, 'valor_km'),
    monto: readNumber(record, 'monto'),
    estado: estadoDesdeBase(record.estado),
    fechaInicial: readString(record, 'fecha_init'),
    fechaTope: readString(record, 'fecha_tope'),
    tipoComprobante: parseTipoComprobante(record.tipo),
    cantidadKm: readNumber(record, 'cantidad_km'),
    fechaEstimadaCobro: readOptionalString(record, 'fecha_estimada_cobro'),
    fechaFactura: readOptionalString(record, 'fecha_factura'),
    prestacion: readString(record, 'prestacion'),
    mesFacturado: readNumber(record, 'mes_facturado'),
    anioFacturado: readNumber(record, 'anio_facturado'),
    dependenciaYRetorno: readString(record, 'dependencia_y_retorno'),
    domicilioId: readString(record, 'domicilio_id'),
    identificadorFactura: parseIdentificadorFactura(record.identificador_origen, record.identificador_valor),
  };
}

// -------------------------------------------------------------------------------------------
// 2.5/2.6 — parseAsistenciaRow + ordenamiento client-side (D5)
// -------------------------------------------------------------------------------------------

/** Fila de `facturacion.asistencia_prestacion` -> `AsistenciaPrestacion`. `id`, `fecha` y
 * `prestacion` son NOT NULL en la base (ver `20260724100005_schema_facturacion.sql` / D1
 * `asistencia_prestacion`); su ausencia marca la fila como malformada y se descarta (`null`) en
 * vez de producir una asistencia inventada. `dependencia`/`retorno` SÍ son nullables (D11): `?? ''`.
 * `factura_sabados` -> `facturaSabados`. */
export function parseAsistenciaRow(row: unknown): AsistenciaPrestacion | null {
  if (!isRecord(row)) return null;

  const id = row.id;
  const fecha = row.fecha;
  const prestacion = row.prestacion;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof fecha !== 'string' || fecha === '') return null;
  if (typeof prestacion !== 'string' || prestacion === '') return null;

  return {
    id,
    fecha,
    prestacion,
    dependencia: readString(row, 'dependencia'),
    retorno: readString(row, 'retorno'),
    facturaSabados: readBoolean(row, 'factura_sabados', false),
  };
}

/** Colección `asistencia_prestacion` (embed de D5) -> `AsistenciaPrestacion[]` ordenada por
 * `fecha` asc, desempatando por `id` (determinista entre llamadas — D5: no depende de `.order()`
 * sobre el embed de PostgREST). Filas hijas malformadas se descartan sin romper el resto. */
function parseAsistencias(rows: unknown): AsistenciaPrestacion[] {
  if (!Array.isArray(rows)) return [];

  const validas = rows
    .map((row) => parseAsistenciaRow(row))
    .filter((asistencia): asistencia is AsistenciaPrestacion => asistencia !== null);

  return [...validas].sort((a, b) => (a.fecha !== b.fecha ? a.fecha.localeCompare(b.fecha) : a.id.localeCompare(b.id)));
}

// -------------------------------------------------------------------------------------------
// ensamblarFactura — combina la fila padre con la colección embebida (D1/D5)
// -------------------------------------------------------------------------------------------

/** Combina la fila de `facturacion.facturas` con su colección embebida `asistencia_prestacion` en
 * una `Factura` completa. Punto de entrada real de `getById`/`list` (sección 3, no implementada
 * todavía en esta fase). */
export function ensamblarFactura(row: unknown): Factura {
  const base = parseFacturaRow(row);
  const record = isRecord(row) ? row : {};

  return { ...base, asistencias: parseAsistencias(record.asistencia_prestacion) };
}

// -------------------------------------------------------------------------------------------
// 2.7 — parseCobroRow
// -------------------------------------------------------------------------------------------

/** Fila de `facturacion.cobros` -> `Cobro`. `facturas_id` (OJO: columna PLURAL) -> `facturaId`,
 * `monto_pagado` -> `montoPagado`. Total, nunca lanza (mismo criterio de D11 que `parseFacturaRow`). */
export function parseCobroRow(row: unknown): Cobro {
  const record = isRecord(row) ? row : {};

  return {
    id: readString(record, 'id'),
    facturaId: readString(record, 'facturas_id'),
    fecha: readString(record, 'fecha'),
    montoPagado: readNumber(record, 'monto_pagado'),
  };
}

// -------------------------------------------------------------------------------------------
// 2.8/2.9 — payloads de escritura hacia las RPC (D4), snake_case espejando
// `20260812160000_factura_rpc.sql`
// -------------------------------------------------------------------------------------------

interface AsistenciaPayload {
  fecha: string;
  prestacion: string;
  dependencia: string;
  retorno: string;
  factura_sabados: boolean;
}

/** El `id` NUNCA viaja: las asistencias son reemplazo completo del conjunto (D4) — el servidor
 * hace `DELETE` + `INSERT` y asigna ids nuevos, ningún id de cliente sobrevive. */
function asistenciaAPayload(asistencia: AsistenciaPrestacion): AsistenciaPayload {
  return {
    fecha: asistencia.fecha,
    prestacion: asistencia.prestacion,
    dependencia: asistencia.dependencia,
    retorno: asistencia.retorno,
    factura_sabados: asistencia.facturaSabados,
  };
}

export interface CrearFacturaPayload {
  paciente_id: string;
  descripcion: string;
  dias: number;
  valor_km: number;
  monto: number;
  estado: string;
  fecha_init: string;
  fecha_tope: string;
  tipo: TipoComprobante;
  cantidad_km: number;
  fecha_estimada_cobro: string | null;
  fecha_factura: string | null;
  prestacion: string;
  mes_facturado: number;
  anio_facturado: number;
  dependencia_y_retorno: string;
  domicilio_id: string;
  identificador_origen: IdentificadorOrigenFactura | null;
  identificador_valor: string | null;
  asistencias: AsistenciaPayload[];
}

/** Arma el único argumento `jsonb` de `facturacion.crear_factura_completa` (D4/D8). Claves en
 * snake_case, espejando `20260812160000_factura_rpc.sql`, con las asistencias anidadas y el estado
 * convertido por `estadoHaciaBase` (nunca `'pendiente'`). */
export function toCrearFacturaPayload(nueva: NuevaFactura): CrearFacturaPayload {
  return {
    paciente_id: nueva.pacienteId,
    descripcion: nueva.descripcion,
    dias: nueva.dias,
    valor_km: nueva.valorKm,
    monto: nueva.monto,
    estado: estadoHaciaBase(nueva.estado),
    fecha_init: nueva.fechaInicial,
    fecha_tope: nueva.fechaTope,
    tipo: nueva.tipoComprobante,
    cantidad_km: nueva.cantidadKm,
    fecha_estimada_cobro: nueva.fechaEstimadaCobro ?? null,
    fecha_factura: nueva.fechaFactura ?? null,
    prestacion: nueva.prestacion,
    mes_facturado: nueva.mesFacturado,
    anio_facturado: nueva.anioFacturado,
    dependencia_y_retorno: nueva.dependenciaYRetorno,
    domicilio_id: nueva.domicilioId,
    identificador_origen: nueva.identificadorFactura?.origen ?? null,
    identificador_valor: nueva.identificadorFactura?.valor ?? null,
    asistencias: nueva.asistencias.map(asistenciaAPayload),
  };
}

/** Payload parcial de `facturacion.actualizar_factura_completa` (D4 — la trampa más fácil del
 * change). Clave ausente en `ActualizacionFactura` -> clave ausente en el objeto devuelto (la RPC
 * distingue "ausente" de "presente" con el operador `jsonb ?`). Clave presente con `undefined` ->
 * también ausente (se resuelve con el mismo chequeo `!== undefined`).
 *
 * ⚠️ EL CASO CRÍTICO: si `asistencias` no viene en `cambios`, la clave `asistencias` NUNCA se
 * agrega al payload — así la RPC nunca ejecuta el `DELETE` de asistencias al editar solo, por
 * ejemplo, el estado (la operación más frecuente del circuito, `factura-estados-circuito`). Si
 * `cambios.asistencias` SÍ está presente (incluso como `[]`), la clave viaja: significa "borrar
 * todas las asistencias", y es intencional. */
export function toActualizarFacturaPayload(cambios: ActualizacionFactura): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (cambios.pacienteId !== undefined) payload.paciente_id = cambios.pacienteId;
  if (cambios.descripcion !== undefined) payload.descripcion = cambios.descripcion;
  if (cambios.dias !== undefined) payload.dias = cambios.dias;
  if (cambios.valorKm !== undefined) payload.valor_km = cambios.valorKm;
  if (cambios.monto !== undefined) payload.monto = cambios.monto;
  if (cambios.estado !== undefined) payload.estado = estadoHaciaBase(cambios.estado);
  if (cambios.fechaInicial !== undefined) payload.fecha_init = cambios.fechaInicial;
  if (cambios.fechaTope !== undefined) payload.fecha_tope = cambios.fechaTope;
  if (cambios.tipoComprobante !== undefined) payload.tipo = cambios.tipoComprobante;
  if (cambios.cantidadKm !== undefined) payload.cantidad_km = cambios.cantidadKm;
  if (cambios.fechaEstimadaCobro !== undefined) payload.fecha_estimada_cobro = cambios.fechaEstimadaCobro;
  if (cambios.fechaFactura !== undefined) payload.fecha_factura = cambios.fechaFactura;
  if (cambios.prestacion !== undefined) payload.prestacion = cambios.prestacion;
  if (cambios.mesFacturado !== undefined) payload.mes_facturado = cambios.mesFacturado;
  if (cambios.anioFacturado !== undefined) payload.anio_facturado = cambios.anioFacturado;
  if (cambios.dependenciaYRetorno !== undefined) payload.dependencia_y_retorno = cambios.dependenciaYRetorno;
  if (cambios.domicilioId !== undefined) payload.domicilio_id = cambios.domicilioId;
  if (cambios.identificadorFactura !== undefined) {
    payload.identificador_origen = cambios.identificadorFactura.origen;
    payload.identificador_valor = cambios.identificadorFactura.valor;
  }
  // ⚠️ No usar `?? []` ni ningún fallback acá: si `cambios.asistencias` es `undefined`, la clave
  // debe quedar TOTALMENTE ausente del payload (ver comentario de la función).
  if (cambios.asistencias !== undefined) payload.asistencias = cambios.asistencias.map(asistenciaAPayload);

  return payload;
}

// -------------------------------------------------------------------------------------------
// 2.10 — toCrearCobroPayload
// -------------------------------------------------------------------------------------------

export interface CrearCobroPayload {
  facturas_id: string;
  fecha: string;
  monto_pagado: number;
}

/** `facturaId` -> `facturas_id` (OJO: columna PLURAL), `montoPagado` -> `monto_pagado`. */
export function toCrearCobroPayload(nuevo: NuevoCobro): CrearCobroPayload {
  return {
    facturas_id: nuevo.facturaId,
    fecha: nuevo.fecha,
    monto_pagado: nuevo.montoPagado,
  };
}
