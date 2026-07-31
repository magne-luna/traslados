// Mapeo puro fila<->dominio para Vehículos (tasks.md §4, design.md D3/D4/D5/D10/D12/D13 del
// change `integracion-conductores-vehiculos`). Funciones exportadas, sin red, sin `any`, **sin
// `as`** (regla dura de esta sección, más estricta que el resto del repo): toda unión cerrada se
// angosta con un type guard explícito (`esValorDe`), nunca con una aserción de tipo.
// `SupabaseVehiculoRepository.ts` (§5) es la única capa de I/O; acá solo se traduce.
//
// Columnas reales de `conductores.vehiculo` (design.md D11, verificado contra la migración
// `…campos.sql` de 1B.1): `id, patente, modelo, tipo, capacidad, año, estado, notas, kilometraje,
// kilometraje_ultimo_service, fecha_ultimo_service`. La columna `año` NO tiene campo en el
// dominio (D15 #14, discrepancia documentada y NO resuelta en este change) — se ignora
// deliberadamente, nunca se mapea.

import type {
  AccesorioMovilidad,
  ActualizacionVehiculo,
  EstadoVehiculo,
  GastoVehiculo,
  MantenimientoRegistro,
  NuevoVehiculo,
  RegistroHabilitacion,
  SubtipoCorrectivoConocido,
  SubtipoPreventivo,
  Vehiculo,
} from '../../types/vehiculo';
import { derivarHabilitaciones } from '../mantenimiento/derivarHabilitaciones';

// -------------------------------------------------------------------------------------------
// 4.10 (REFACTOR) — type guards compartidos
// -------------------------------------------------------------------------------------------

/** Type guard mínimo sobre `unknown` para filas que llegan de PostgREST — mismo criterio que
 * `pacienteMapping.ts` / `obraSocialMapping.ts`. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Fila con `id: string` no vacío — el mínimo común de toda fila hija (`mantenimiento`,
 * `gastos_vehiculos`) que se puede identificar. */
function esFilaConId(value: unknown): value is Record<string, unknown> & { id: string } {
  return isRecord(value) && typeof value.id === 'string' && value.id !== '';
}

/** Fábrica de type guards para uniones cerradas de string, **sin `as`**: la comparación
 * `v === value` con `v: T` y `value: unknown` angosta por igualdad estructural, no por aserción.
 * Reemplaza el patrón `Set<T>.has(value as T)` que usan `pacienteMapping`/`obraSocialMapping`
 * (donde `as` sí está permitido) — acá la regla de la tarea 4.3 lo prohíbe explícitamente. */
function esValorDe<T extends string>(valores: readonly T[]): (value: unknown) => value is T {
  return (value: unknown): value is T => typeof value === 'string' && valores.some((v) => v === value);
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

/** Numérico robusto: `null`/`undefined`/no-numérico/`NaN` degradan a `0`, nunca se propaga
 * `NaN` ni un `string` sin convertir hacia el dominio. */
function readNumber(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readOptionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

// -------------------------------------------------------------------------------------------
// 4.2 — parseEstadoVehiculo / toEstadoVehiculoRow (D13)
// -------------------------------------------------------------------------------------------

const DEFAULT_ESTADO_VEHICULO: EstadoVehiculo = 'habilitado';

/** `'fuera de servicio'` (base, con espacio) <-> `'fuera-de-servicio'` (dominio, con guion).
 * Función **total**, no un `.replace(' ', '-')`: un replace es silenciosamente correcto hoy y
 * silenciosamente incorrecto en cuanto aparezca un tercer valor de estado. Un valor desconocido
 * (o no-string) degrada al default del dominio, misma política que las filas hijas malformadas —
 * nunca lanza. */
export function parseEstadoVehiculo(value: unknown): EstadoVehiculo {
  if (value === 'fuera de servicio') return 'fuera-de-servicio';
  if (value === 'habilitado') return 'habilitado';
  return DEFAULT_ESTADO_VEHICULO;
}

export function toEstadoVehiculoRow(estado: EstadoVehiculo): string {
  return estado === 'fuera-de-servicio' ? 'fuera de servicio' : 'habilitado';
}

// -------------------------------------------------------------------------------------------
// 4.1 — parseVehiculoRow
// -------------------------------------------------------------------------------------------

export interface VehiculoCamposBase {
  id: string;
  patente: string;
  modelo: string;
  tipo: string;
  capacidad: number;
  estado: EstadoVehiculo;
  kilometraje: number;
  kilometrajeUltimoService: number;
  fechaUltimoService: string;
  notas?: string;
}

/** Fila plana de `conductores.vehiculo` -> campos base del dominio. Una fila sin `id` o sin
 * `patente` se descarta (`null`) en vez de romper el `list()` entero — son las dos columnas
 * `NOT NULL` sin default que identifican inequívocamente al vehículo; el resto degrada a su
 * valor por defecto sin descartar la fila. */
export function parseVehiculoRow(row: unknown): VehiculoCamposBase | null {
  if (!isRecord(row)) return null;

  const id = row.id;
  const patente = row.patente;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof patente !== 'string' || patente === '') return null;

  return {
    id,
    patente,
    modelo: readString(row, 'modelo'),
    tipo: readString(row, 'tipo'),
    capacidad: readNumber(row, 'capacidad'),
    estado: parseEstadoVehiculo(row.estado),
    kilometraje: readNumber(row, 'kilometraje'),
    kilometrajeUltimoService: readNumber(row, 'kilometraje_ultimo_service'),
    fechaUltimoService: readString(row, 'fecha_ultimo_service'),
    notas: readOptionalString(row, 'notas'),
  };
}

// -------------------------------------------------------------------------------------------
// 4.3 — parseMantenimientoRow (D4): reconstruye la unión discriminada de 4 miembros desde
// `categoria` + `subtipo` + `detalle`. Espeja exactamente el CHECK `chk_categoria_subtipo`
// (design.md D4 / 1B.2): una fila que no calce ninguna de las 4 combinaciones se descarta sin
// romper el vehículo — misma política que `pacienteMapping` con filas hijas malformadas.
// -------------------------------------------------------------------------------------------

const SUBTIPOS_PREVENTIVOS_VALIDOS: readonly SubtipoPreventivo[] = ['cambio-aceite-filtros', 'vtv', 'rto'];
const SUBTIPOS_CORRECTIVOS_CONOCIDOS: readonly SubtipoCorrectivoConocido[] = [
  'alternador',
  'bateria',
  'frenos',
  'embrague',
  'cubiertas',
];

const esSubtipoPreventivo = esValorDe(SUBTIPOS_PREVENTIVOS_VALIDOS);
const esSubtipoCorrectivoConocido = esValorDe(SUBTIPOS_CORRECTIVOS_CONOCIDOS);

interface MantenimientoBase {
  id: string;
  fecha: string;
  kilometraje: number;
  proximoVencimientoFecha?: string;
  proximoVencimientoKm?: number;
  descripcion?: string;
}

/** Campos comunes a los 4 miembros de la unión (`MantenimientoRegistroBase`, D4/3.3):
 * `id ← id`, `fecha ← fecha`, `kilometraje ← km_actual`, `proximoVencimientoFecha? ←
 * fecha_proximo_vencimiento`, `proximoVencimientoKm? ← km_proximo_vencimiento`, `descripcion? ←
 * descripcion`. No decide nada sobre la unión — eso lo hace `parseMantenimientoRow`. */
function parseMantenimientoBase(row: Record<string, unknown>): MantenimientoBase {
  return {
    id: readString(row, 'id'),
    fecha: readString(row, 'fecha'),
    kilometraje: readNumber(row, 'km_actual'),
    proximoVencimientoFecha: readOptionalString(row, 'fecha_proximo_vencimiento'),
    proximoVencimientoKm: readOptionalNumber(row, 'km_proximo_vencimiento'),
    descripcion: readOptionalString(row, 'descripcion'),
  };
}

export function parseMantenimientoRow(row: unknown): MantenimientoRegistro | null {
  if (!isRecord(row)) return null;

  const base = parseMantenimientoBase(row);
  if (base.id === '' || base.fecha === '') return null;

  const categoria = row.categoria;
  const subtipo = row.subtipo;
  const detalle = row.detalle;

  // Miembro 4: gasto — sin subtipo ni detalle.
  if (categoria === 'gasto' && subtipo == null && detalle == null) {
    return { ...base, tipoIntervencion: 'gasto' };
  }

  // Miembro 1: preventivo — subtipo de la unión cerrada, sin detalle.
  if (categoria === 'preventivo' && esSubtipoPreventivo(subtipo) && detalle == null) {
    return { ...base, tipoIntervencion: 'preventivo', subtipo };
  }

  // Miembro 3: correctivo + 'otro' — detalle NO vacío es obligatorio (chk_categoria_subtipo:
  // `detalle IS NOT NULL AND btrim(detalle) <> ''`).
  if (categoria === 'correctivo' && subtipo === 'otro' && typeof detalle === 'string' && detalle.trim() !== '') {
    return { ...base, tipoIntervencion: 'correctivo', subtipo: 'otro', detalle };
  }

  // Miembro 2: correctivo — subtipo conocido. A diferencia del preventivo, `chk_categoria_subtipo`
  // (D4) NO exige `detalle IS NULL` en esta rama del CHECK: una fila con `detalle` presente igual
  // la satisface. El tipo de este miembro no tiene campo `detalle` (design.md D4), así que un
  // `detalle` perdido se ignora en la lectura en vez de descartar una fila que la base considera
  // válida.
  if (categoria === 'correctivo' && esSubtipoCorrectivoConocido(subtipo)) {
    return { ...base, tipoIntervencion: 'correctivo', subtipo };
  }

  // No calza ninguna de las 4 combinaciones del CHECK -> incoherente, se descarta sin lanzar.
  return null;
}

// -------------------------------------------------------------------------------------------
// 4.4 — toMantenimientoRows: la vuelta de parseMantenimientoRow.
// -------------------------------------------------------------------------------------------

export interface MantenimientoRowInput {
  id: string;
  categoria: MantenimientoRegistro['tipoIntervencion'];
  subtipo: string | null;
  detalle: string | null;
  descripcion: string | null;
  fecha: string;
  km_actual: number;
  fecha_proximo_vencimiento: string | null;
  km_proximo_vencimiento: number | null;
}

/** `MantenimientoRegistro[]` -> filas de `conductores.mantenimiento`. `'gasto'` no emite
 * `subtipo` ni `detalle` (`null`, la columna es NULLable); `'otro'` emite los dos; los otros dos
 * miembros emiten `subtipo` y `detalle: null` — nunca inventa un `detalle` que el miembro no
 * tiene. */
export function toMantenimientoRows(registros: MantenimientoRegistro[]): MantenimientoRowInput[] {
  return registros.map((registro) => {
    const base = {
      id: registro.id,
      categoria: registro.tipoIntervencion,
      descripcion: registro.descripcion ?? null,
      fecha: registro.fecha,
      km_actual: registro.kilometraje,
      fecha_proximo_vencimiento: registro.proximoVencimientoFecha ?? null,
      km_proximo_vencimiento: registro.proximoVencimientoKm ?? null,
    };

    if (registro.tipoIntervencion === 'correctivo' && registro.subtipo === 'otro') {
      return { ...base, subtipo: 'otro', detalle: registro.detalle };
    }
    if (registro.tipoIntervencion === 'preventivo' || registro.tipoIntervencion === 'correctivo') {
      return { ...base, subtipo: registro.subtipo, detalle: null };
    }
    return { ...base, subtipo: null, detalle: null };
  });
}

// -------------------------------------------------------------------------------------------
// 4.5 — parseAccesoriosRows: embed de dos niveles `accesorios_vehiculo -> accesorios.tipo`.
// -------------------------------------------------------------------------------------------

const ACCESORIOS_VALIDOS: readonly AccesorioMovilidad[] = [
  'silla-plegable',
  'silla-rigida',
  'silla-postural',
  'andador',
  'tripode',
];

const esAccesorioMovilidad = esValorDe(ACCESORIOS_VALIDOS);

/** `accesorios_vehiculo ( accesorios ( tipo ) )` embebido (D11) -> `AccesorioMovilidad[]`. Un
 * `tipo` que no pertenece a la unión cerrada se descarta (nunca se castea); una fila sin el embed
 * anidado (RLS lo ocultó, o vino incompleta) también se descarta, sin romper el resto de la
 * colección. Embed vacío -> `[]` **sin distinguir todavía** si es "no tiene accesorios" o "RLS lo
 * ocultó entero" — esa distinción la agrega el repository con un flag de degradación (D10, §5.4),
 * no el mapeo puro. */
export function parseAccesoriosRows(rows: unknown): AccesorioMovilidad[] {
  if (!Array.isArray(rows)) return [];

  const tipos: AccesorioMovilidad[] = [];
  for (const row of rows) {
    if (!isRecord(row) || !isRecord(row.accesorios)) continue;
    const tipo = row.accesorios.tipo;
    if (esAccesorioMovilidad(tipo)) tipos.push(tipo);
  }
  return tipos;
}

// -------------------------------------------------------------------------------------------
// 4.6 — parseGastoRow: `facturacion.gastos_vehiculos`.
// -------------------------------------------------------------------------------------------

/** `monto NUMERIC(10,2)` puede llegar como `string` desde PostgREST en algunas versiones — se
 * parsea con `Number()` (nunca `parseFloat` sobre `unknown` sin narrowing) y se descarta `NaN`. */
function parseMontoNumerico(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Fila de `facturacion.gastos_vehiculos` -> `GastoVehiculo`. Sin `id`, sin `fecha` o con un
 * `monto` no parseable, la fila se descarta (`null`) — nunca se inventa un monto. */
export function parseGastoRow(row: unknown): GastoVehiculo | null {
  if (!esFilaConId(row)) return null;

  const fecha = readString(row, 'fecha');
  if (fecha === '') return null;

  const monto = parseMontoNumerico(row.monto);
  if (monto === null) return null;

  return {
    id: row.id,
    fecha,
    monto,
    descripcion: readOptionalString(row, 'descripcion'),
  };
}

// -------------------------------------------------------------------------------------------
// 4.8 — orden determinista compartido por mantenimientos y gastos (D11): `fecha` desc, `id` como
// desempate (también desc, mismo criterio de "el más nuevo primero" que usa `fecha`).
// -------------------------------------------------------------------------------------------

function ordenarPorFechaDescYId<T extends { fecha: string; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha > b.fecha ? -1 : 1;
    return a.id > b.id ? -1 : 1;
  });
}

// -------------------------------------------------------------------------------------------
// 4.7 / 4.8 — ensamblarVehiculo(row, gastosRows): combina la fila con sus embeds
// (`accesorios_vehiculo`, `mantenimiento`) más la segunda consulta batcheada de
// `facturacion.gastos_vehiculos` (D11) en un `Vehiculo` completo.
//
// Habilitaciones derivadas (D3-B, 4.7): NO hay `parseHabilitacionRow` ni tabla que leer.
// `Vehiculo.habilitaciones` sale de `derivarHabilitaciones(mantenimientos)` (2B.1), aplicada
// DESPUÉS de mapear (y filtrar) el historial — una fila de mantenimiento descartada por
// incoherente (4.3) nunca llega a `derivarHabilitaciones`, así que no puede producir una
// habilitación fantasma.
// -------------------------------------------------------------------------------------------

export function ensamblarVehiculo(row: unknown, gastosRows: unknown): Vehiculo | null {
  const base = parseVehiculoRow(row);
  if (base === null) return null;

  const record = isRecord(row) ? row : {};

  const accesoriosCompatibles = parseAccesoriosRows(record.accesorios_vehiculo);

  const mantenimientosRaw = Array.isArray(record.mantenimiento) ? record.mantenimiento : [];
  const mantenimientos = ordenarPorFechaDescYId(
    mantenimientosRaw
      .map((fila) => parseMantenimientoRow(fila))
      .filter((registro): registro is MantenimientoRegistro => registro !== null),
  );

  const gastosRawList = Array.isArray(gastosRows) ? gastosRows : [];
  const gastos = ordenarPorFechaDescYId(
    gastosRawList.map((fila) => parseGastoRow(fila)).filter((gasto): gasto is GastoVehiculo => gasto !== null),
  );

  const habilitaciones: RegistroHabilitacion[] = derivarHabilitaciones(mantenimientos);

  return {
    id: base.id,
    patente: base.patente,
    modelo: base.modelo,
    tipo: base.tipo,
    capacidad: base.capacidad,
    accesoriosCompatibles,
    estado: base.estado,
    kilometraje: base.kilometraje,
    kilometrajeUltimoService: base.kilometrajeUltimoService,
    fechaUltimoService: base.fechaUltimoService,
    habilitaciones,
    gastos,
    mantenimientos,
    notas: base.notas,
  };
}

// -------------------------------------------------------------------------------------------
// 4.9 / 4.7b — toCrearVehiculoPayload / toActualizarVehiculoPayload.
//
// `habilitaciones` NUNCA se lee de `NuevoVehiculo`/`ActualizacionVehiculo` ni se emite en ningún
// payload (D3-B, 4.7b): es un campo de salida (se calcula en `ensamblarVehiculo` con
// `derivarHabilitaciones`) y no hay tabla donde escribirlo. Un payload que la trajera no rompe
// nada — la clave simplemente no existe del lado de la escritura.
// -------------------------------------------------------------------------------------------

export interface GastoRowInput {
  id: string;
  monto: number;
  fecha: string;
  descripcion: string | null;
}

function toGastoRows(gastos: GastoVehiculo[]): GastoRowInput[] {
  return gastos.map((gasto) => ({
    id: gasto.id,
    monto: gasto.monto,
    fecha: gasto.fecha,
    descripcion: gasto.descripcion ?? null,
  }));
}

export interface CrearVehiculoPayload {
  patente: string;
  modelo: string;
  tipo: string;
  capacidad: number;
  estado: string;
  notas: string | null;
  kilometraje: number;
  kilometraje_ultimo_service: number;
  fecha_ultimo_service: string | null;
  accesorios: AccesorioMovilidad[];
  mantenimientos: MantenimientoRowInput[];
  gastos: GastoRowInput[];
}

/** Argumento `p_vehiculo jsonb` de `conductores.crear_vehiculo_completo` (D9, 1B.8). No incluye
 * `habilitaciones`: ver nota de la sección. */
export function toCrearVehiculoPayload(nuevo: NuevoVehiculo): CrearVehiculoPayload {
  return {
    patente: nuevo.patente,
    modelo: nuevo.modelo,
    tipo: nuevo.tipo,
    capacidad: nuevo.capacidad,
    estado: toEstadoVehiculoRow(nuevo.estado),
    notas: nuevo.notas ?? null,
    kilometraje: nuevo.kilometraje,
    kilometraje_ultimo_service: nuevo.kilometrajeUltimoService,
    fecha_ultimo_service: nuevo.fechaUltimoService || null,
    accesorios: nuevo.accesoriosCompatibles,
    mantenimientos: toMantenimientoRows(nuevo.mantenimientos),
    gastos: toGastoRows(nuevo.gastos),
  };
}

/** Argumento `p_cambios jsonb` de `conductores.actualizar_vehiculo_completo` (D9, 1B.8).
 * **Semántica parcial real**: una clave ausente en `cambios` (`undefined`) NO aparece en el
 * objeto devuelto — la RPC la distingue con el operador `?` de `jsonb` (D9) y no toca esa
 * columna/colección. Una clave presente con una colección vacía (`mantenimientos: []`) SÍ viaja
 * — significa "vaciar", no "no tocar". Es la trampa más fácil de escribir mal (design.md
 * §Risks): colapsar "no mandado" y "mandado vacío" en el mismo camino de código borraría el
 * historial de cualquiera que edite solo la patente. */
export function toActualizarVehiculoPayload(cambios: ActualizacionVehiculo): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (cambios.patente !== undefined) payload.patente = cambios.patente;
  if (cambios.modelo !== undefined) payload.modelo = cambios.modelo;
  if (cambios.tipo !== undefined) payload.tipo = cambios.tipo;
  if (cambios.capacidad !== undefined) payload.capacidad = cambios.capacidad;
  if (cambios.estado !== undefined) payload.estado = toEstadoVehiculoRow(cambios.estado);
  if (cambios.notas !== undefined) payload.notas = cambios.notas === '' ? null : cambios.notas;
  if (cambios.kilometraje !== undefined) payload.kilometraje = cambios.kilometraje;
  if (cambios.kilometrajeUltimoService !== undefined) {
    payload.kilometraje_ultimo_service = cambios.kilometrajeUltimoService;
  }
  if (cambios.fechaUltimoService !== undefined) {
    payload.fecha_ultimo_service = cambios.fechaUltimoService || null;
  }
  if (cambios.accesoriosCompatibles !== undefined) payload.accesorios = cambios.accesoriosCompatibles;
  if (cambios.mantenimientos !== undefined) payload.mantenimientos = toMantenimientoRows(cambios.mantenimientos);
  if (cambios.gastos !== undefined) payload.gastos = toGastoRows(cambios.gastos);

  // `cambios.habilitaciones` NUNCA se lee acá (D3-B, 4.7b), aunque `ActualizacionVehiculo` la
  // admita por ser `Partial<Omit<Vehiculo, 'id'>>`.

  return payload;
}
