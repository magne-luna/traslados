// Mapeo puro fila<->dominio para Vehículos (tasks.md §4 y §4B, design.md D3/D4/D5/D10/D12/D13 +
// §Reconciliación con C-08-vehiculos-mantenimiento, del change `integracion-conductores-vehiculos`).
// Funciones exportadas, sin red, sin `any`, **sin `as`** (regla dura de esta sección, más estricta
// que el resto del repo): toda unión cerrada se angosta con un type guard explícito (`esValorDe`),
// nunca con una aserción de tipo. `SupabaseVehiculoRepository.ts` (§5, todavía sin construir) es
// la única capa de I/O; acá solo se traduce.
//
// **RECONCILIADO (2026-08-01, §4B).** El backend real de Enzo (`C-08-vehiculos-mantenimiento`,
// ya mergeado) es la fuente de verdad para Vehículos de acá en adelante. `parseVehiculoRow`/
// `ensamblarVehiculo` consumen la respuesta JSON de la Edge Function
// `supabase/functions/vehiculos/index.ts::toApi()`, no una fila cruda de PostgREST con embeds —
// ver la nota de cada sección tocada (4B.1 gastos, 4B.2 habilitaciones, 4B.3 kilometraje, 4B.5
// accesorios) para el detalle exacto de qué cambió y por qué. **4B.4 (mantenimientos) queda
// bloqueado y sin tocar**: la Edge Function todavía no expone ese array (gap abierto,
// design.md `#### Gap abierto`), pendiente de una decisión con Enzo.
//
// Columnas reales de `conductores.vehiculo` (migración `20260730110000_schema_vehiculo_gaps.sql`):
// `id, patente, modelo, tipo, capacidad, año, estado, notas, kilometraje` (**nullable, sin
// default** — distinto de lo que 1B.1 planeaba). Ya **no existen** columnas propias
// `kilometraje_ultimo_service`/`fecha_ultimo_service`: la Edge Function las deriva del último
// registro `preventivo` de `mantenimiento` y las expone en el JSON de respuesta como
// `kilometrajeUltimoService`/`fechaUltimoService` (camelCase, no columnas de tabla). La columna
// `año` NO tiene campo en el dominio (D15 #14, discrepancia documentada y NO resuelta en este
// change) — se ignora deliberadamente, nunca se mapea.

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
 * nunca lanza.
 *
 * **No usar para leer la respuesta real de la Edge Function** (bug encontrado 2026-08-16): esta
 * función espera el valor crudo de la base. `vehiculos/index.ts::estadoToApi()` ya hace esta
 * misma conversión server-side antes de responder, así que `parseVehiculoRow` aplicarla de nuevo
 * es una doble conversión — un vehículo real `'fuera-de-servicio'` no matchea ningún caso acá y
 * degrada en silencio a `'habilitado'`. Queda viva solo por `toCrearVehiculoPayload` (RPC
 * SUPERSEDED, D9/D11, nunca escrita) y sus tests; para la respuesta real usar
 * `parseEstadoVehiculoApi`. */
export function parseEstadoVehiculo(value: unknown): EstadoVehiculo {
  if (value === 'fuera de servicio') return 'fuera-de-servicio';
  if (value === 'habilitado') return 'habilitado';
  return DEFAULT_ESTADO_VEHICULO;
}

export function toEstadoVehiculoRow(estado: EstadoVehiculo): string {
  return estado === 'fuera-de-servicio' ? 'fuera de servicio' : 'habilitado';
}

/** `estado` tal como lo manda `vehiculos/index.ts::estadoToApi()`: ya en formato de dominio
 * (`'fuera-de-servicio'`, con guion), no el valor crudo de la base. Un valor desconocido (o
 * no-string) degrada a `'habilitado'`, misma política que `parseEstadoVehiculo`. */
export function parseEstadoVehiculoApi(value: unknown): EstadoVehiculo {
  return value === 'fuera-de-servicio' ? 'fuera-de-servicio' : DEFAULT_ESTADO_VEHICULO;
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

/** Fila/respuesta -> campos base del dominio. Una fila sin `id` o sin `patente` se descarta
 * (`null`) en vez de romper el `list()` entero — son las dos columnas `NOT NULL` sin default que
 * identifican inequívocamente al vehículo; el resto degrada a su valor por defecto sin descartar
 * la fila.
 *
 * **4B.3 (RECONCILIADO 2026-08-01).** `kilometraje` sigue siendo columna propia de
 * `conductores.vehiculo`, pero ahora **nullable, sin default** (migración
 * `20260730110000_schema_vehiculo_gaps.sql`) — `readNumber` ya trata cualquier valor no-numérico,
 * incluido `null`, como `0`, así que no hace falta un camino especial para esta columna.
 * `kilometrajeUltimoService`/`fechaUltimoService` YA NO son columnas propias
 * (`kilometraje_ultimo_service`/`fecha_ultimo_service` no existen): la Edge Function las deriva
 * del último registro `preventivo` de `mantenimiento` y las devuelve en el JSON de respuesta con
 * esas claves camelCase — se leen tal cual, sin traducir un nombre de columna. */
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
    estado: parseEstadoVehiculoApi(row.estado),
    kilometraje: readNumber(row, 'kilometraje'),
    kilometrajeUltimoService: readNumber(row, 'kilometrajeUltimoService'),
    fechaUltimoService: readString(row, 'fechaUltimoService'),
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
// 4B.5 (RECONCILIADO 2026-08-01, ver design.md §Reconciliación D11 y tasks.md 4B.5) —
// parseAccesoriosRows: sin cambio de fondo (el catálogo `pacientes.accesorios` ya está sembrado,
// 1B.3, con los mismos 5 valores), pero cambia la FUENTE. Antes: embed anidado de dos niveles
// `accesorios_vehiculo -> accesorios.tipo` (D11 original, PostgREST+RPC directo). Ahora: la Edge
// Function `vehiculos/index.ts::toApi()` ya resuelve `accesoriosCompatibles` como un `string[]`
// plano de `tipo` — el mapeo consume ese array directo, no reconstruye un embed.
// -------------------------------------------------------------------------------------------

/** `accesoriosCompatibles: string[]` ya resuelto por la Edge Function -> `TipoAccesorio[]`
 * (espejo del maestro, discrepania #11 cerrada: el catalogo es la fuente de verdad, no hay unión
 * cerrada que descarte desconocidos). Descartar solo elementos no-string (defensivo); el resto se
 * conserva tal cual. Valor no-array -> `[]` **sin distinguir todavía** si es "no tiene accesorios"
 * o "RLS lo ocultó entero" — esa distinción la agrega el repository con un flag de degradación
 * (D10, §5.4), no el mapeo puro. */
export function parseAccesoriosRows(value: unknown): AccesorioMovilidad[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

// -------------------------------------------------------------------------------------------
// 4B.2 (RECONCILIADO 2026-08-01, ver design.md §Reconciliación D3 y tasks.md 4B.2) —
// parseHabilitacionRow / parseHabilitacionesRows: D3 (opción B, derivar de `mantenimiento`) quedó
// SUPERSEDED — Enzo implementó la opción A que este documento descartaba, una tabla real
// `conductores.habilitaciones_vehiculo(id, vehiculo_id, tipo, fecha_emision, fecha_vencimiento)`.
// La Edge Function ya la resuelve en el array `habilitaciones` de su respuesta
// (`habilitacionToApi()`: `{ tipo, fechaEmision, fechaVencimiento }`, **sin `id`** — confirmado
// que `RegistroHabilitacion` no lo necesita). El mapeo real ya NO llama a `derivarHabilitaciones`
// (esa función sigue viva, sin tocar, solo para el mock — ver `mockVehiculoRepository.ts` y
// `VehiculoDetail.tsx`, que la importan directamente).
// -------------------------------------------------------------------------------------------

const TIPOS_HABILITACION_VALIDOS: readonly RegistroHabilitacion['tipo'][] = ['vtv', 'rto'];
const esTipoHabilitacion = esValorDe(TIPOS_HABILITACION_VALIDOS);

/** Elemento del array `habilitaciones` que ya arma `habilitacionToApi()` (Edge Function) ->
 * `RegistroHabilitacion`. Un `tipo` fuera de `{'vtv','rto'}` descarta la fila entera (nunca se
 * castea). `fechaEmision`/`fechaVencimiento` son columnas nullable en la base
 * (`habilitaciones_vehiculo.fecha_emision`/`fecha_vencimiento`) que la Edge Function propaga tal
 * cual (pueden llegar `null`) — acá degradan a `''` con el mismo criterio que el resto del
 * archivo, sin descartar la fila por eso. */
export function parseHabilitacionRow(value: unknown): RegistroHabilitacion | null {
  if (!isRecord(value)) return null;

  const tipo = value.tipo;
  if (!esTipoHabilitacion(tipo)) return null;

  return {
    tipo,
    fechaEmision: readString(value, 'fechaEmision'),
    fechaVencimiento: readString(value, 'fechaVencimiento'),
  };
}

/** `habilitaciones` (array ya resuelto por la Edge Function) -> `RegistroHabilitacion[]`. Una
 * fila con `tipo` inválido se descarta sin romper el resto de la colección. Valor no-array ->
 * `[]`. */
export function parseHabilitacionesRows(value: unknown): RegistroHabilitacion[] {
  if (!Array.isArray(value)) return [];
  return value.map(parseHabilitacionRow).filter((habilitacion): habilitacion is RegistroHabilitacion => habilitacion !== null);
}

// -------------------------------------------------------------------------------------------
// 4B.1 (RECONCILIADO 2026-08-01, ver design.md §Reconciliación D9/D11 y tasks.md 4B.1) —
// parseGastoRow: dejó de leer/escribir `facturacion.gastos_vehiculos` (D9/D11 SUPERSEDED, esa
// tabla queda abandonada). Los gastos son ahora filas de `conductores.mantenimiento` con
// `categoria = 'gasto'` (columnas `monto`, `descripcion`, `categoria_gasto` — aplicadas por Enzo
// en `20260730110000_schema_vehiculo_gaps.sql`), ya resueltas por la Edge Function
// `supabase/functions/vehiculos/index.ts::gastoToApi()` en el array `gastos` de su respuesta.
//
// ⚠️ ASUNCIÓN REVERSIBLE, pendiente de confirmar con Enzo (design.md `#### Gap abierto` /
// hallazgo de `categoria: CategoriaGasto`): `GastoVehiculo` NO gana un campo `categoria`. La
// columna `categoria_gasto` (expuesta como `categoria` en el JSON de `gastoToApi()`) se **ignora
// por completo en la lectura** — nunca se surface en el dominio — y **nunca se emite en la
// escritura** (es opcional en el `GastoInput` de la Edge Function, así que omitirla es seguro).
// Si Enzo confirma que hace falta, esto se revisa sin tocar el resto del mapeo.
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

/** Elemento del array `gastos` que ya arma `gastoToApi()` (Edge Function) -> `GastoVehiculo`.
 * Sin `id`, sin `fecha` o con un `monto` no parseable, la fila se descarta (`null`) — nunca se
 * inventa un monto. `categoria`/`categoria_gasto`, si vienen, se ignoran (ver nota de la
 * sección). */
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
// 4.7 / 4.8 / 4B — ensamblarVehiculo(row): combina la fila con sus arrays ya resueltos en un
// `Vehiculo` completo.
//
// **RECONCILIADO (2026-08-01, ver design.md §Reconciliación y tasks.md 4B).** `row` ya no es una
// fila PostgREST con embeds crudos + una segunda consulta batcheada — es la respuesta JSON de
// `supabase/functions/vehiculos/index.ts::toApi()` (D11 SUPERSEDED: acceso vía Edge Function
// HTTP, no PostgREST+RPC directo). Consecuencia: `ensamblarVehiculo` deja de tomar un segundo
// parámetro `gastosRows` (esa segunda consulta a `facturacion.gastos_vehiculos` ya no existe, D9/
// D11 SUPERSEDED) — `gastos` sale de `record.gastos`, ya resuelto por `gastoToApi()` (4B.1).
// `accesoriosCompatibles` sale de `record.accesoriosCompatibles`, ya un `string[]` plano (4B.5).
// `habilitaciones` sale de `record.habilitaciones`, ya resuelto por `habilitacionToApi()` desde la
// tabla real `conductores.habilitaciones_vehiculo` (4B.2) — **ya NO se llama a
// `derivarHabilitaciones`** en este camino (esa función sigue viva, sin tocar, únicamente para el
// mock).
//
// **4B.4 — BLOQUEADO, sin tocar (gap abierto, ver design.md `#### Gap abierto`).** La
// Edge Function real no expone ningún array `mantenimientos` todavía (pendiente de decisión con
// Enzo). El cálculo de `mantenimientos` de abajo se deja **exactamente como estaba** (sigue
// leyendo `record.mantenimiento`, el embed crudo de `parseMantenimientoRow`/`toMantenimientoRows`)
// — con la respuesta real de hoy, `record.mantenimiento` es `undefined` y esto degrada
// naturalmente a `mantenimientos: []`, sin necesidad de tocar código acá. No se implementa una
// solución unilateral a este gap en este batch.
// -------------------------------------------------------------------------------------------

export function ensamblarVehiculo(row: unknown): Vehiculo | null {
  const base = parseVehiculoRow(row);
  if (base === null) return null;

  const record = isRecord(row) ? row : {};

  const accesoriosCompatibles = parseAccesoriosRows(record.accesoriosCompatibles);

  // 4B.4 — cerrado (2026-08-10): la Edge Function ya expone `mantenimiento` en cada respuesta
  // (`replaceMantenimientos`/`toApi()` de `vehiculos/index.ts`). El `Array.isArray` de acá queda
  // como degradación defensiva de siempre (mismo criterio que `gastos`/`accesoriosCompatibles`),
  // ya no por un gap conocido.
  const mantenimientosRaw = Array.isArray(record.mantenimiento) ? record.mantenimiento : [];
  const mantenimientos = ordenarPorFechaDescYId(
    mantenimientosRaw
      .map((fila) => parseMantenimientoRow(fila))
      .filter((registro): registro is MantenimientoRegistro => registro !== null),
  );

  const gastosRawList = Array.isArray(record.gastos) ? record.gastos : [];
  const gastos = ordenarPorFechaDescYId(
    gastosRawList.map((fila) => parseGastoRow(fila)).filter((gasto): gasto is GastoVehiculo => gasto !== null),
  );

  // REVERTIDO (2026-08-10, feedback de usuario): 4B.2 había reconciliado esto contra la tabla real
  // `conductores.habilitaciones_vehiculo` (opción A) porque Enzo la había construido — pero nunca
  // se armó ninguna UI para escribir en ella, y la usuaria prefirió explícitamente NO tener un
  // formulario aparte que duplique la misma fecha de vencimiento que ya se carga en un mantenimiento
  // preventivo VTV/RTO. Vuelve a D3 opción B: `habilitaciones` se deriva de `mantenimientos`
  // (`derivarHabilitaciones`, la misma función pura que ya usaba el mock) en vez de leerse de
  // `record.habilitaciones`. La tabla real y `parseHabilitacionRow`/`parseHabilitacionesRows` (que
  // la parsean) quedan sin uso acá — no se borran, por si se retoma un formulario propio más
  // adelante — pero la Edge Function nunca recibe nada en `habilitaciones` desde este repository
  // (4.7b, sin cambios: ese payload sigue sin emitir la clave).
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
// payload (4.7b). Esto se mantiene sin cambios tras la reconciliación 4B.2: aunque
// `conductores.habilitaciones_vehiculo` es ahora una tabla real que la Edge Function sí acepta
// escribir (`habilitaciones?: HabilitacionInput[]` en el body de POST/PATCH), soportar esa
// escritura no está en el alcance de 4B — queda como trabajo futuro documentado, no una decisión
// tomada acá. Por ahora la clave simplemente no existe del lado de la escritura.
// -------------------------------------------------------------------------------------------

/** Fila de escritura para `conductores.mantenimiento` con `categoria = 'gasto'` (4B.1). **Sin
 * `id`**: a diferencia de la vieja `facturacion.gastos_vehiculos`, la colección se reemplaza
 * entera (delete + insert), el mismo patrón de `replaceGastos()` de la Edge Function — el `id`
 * de `GastoVehiculo` es un detalle de identidad del dominio/UI, no algo que haya que reenviar.
 * **Nunca incluye `categoria`/`categoria_gasto`** (asunción reversible, ver nota de
 * `parseGastoRow`). */
export interface GastoRowInput {
  monto: number;
  fecha: string;
  descripcion: string | null;
}

export function toGastoRows(gastos: GastoVehiculo[]): GastoRowInput[] {
  return gastos.map((gasto) => ({
    monto: gasto.monto,
    fecha: gasto.fecha,
    descripcion: gasto.descripcion ?? null,
  }));
}

/** **4B.3 (RECONCILIADO 2026-08-01).** `kilometrajeUltimoService`/`fechaUltimoService` YA NO
 * forman parte de ningún payload de escritura — ni acá ni en `toActualizarVehiculoPayload` — son
 * derivados server-side por la Edge Function del último `mantenimiento` `preventivo`; el mapeo
 * solo los **lee** de la respuesta (`parseVehiculoRow`/`ensamblarVehiculo`), nunca los escribe.
 * Antes existían como columnas propias (`kilometraje_ultimo_service`/`fecha_ultimo_service`) y
 * viajaban en el payload; esa columna no existe más (design.md §Reconciliación, kilometraje). */
export interface CrearVehiculoPayload {
  patente: string;
  modelo: string;
  tipo: string;
  capacidad: number;
  estado: string;
  notas: string | null;
  kilometraje: number;
  accesorios: AccesorioMovilidad[];
  mantenimientos: MantenimientoRowInput[];
  gastos: GastoRowInput[];
}

/** Argumento `p_vehiculo jsonb` de `conductores.crear_vehiculo_completo` (D9, 1B.8 — nota:
 * esta RPC está SUPERSEDED/sin escribir, ver design.md §Reconciliación D9/D11; la forma del
 * payload se conserva para no expandir el alcance de 4B más allá de lo asignado). No incluye
 * `habilitaciones` (ver nota de la sección) ni `kilometrajeUltimoService`/`fechaUltimoService`
 * (4B.3, ver nota de `CrearVehiculoPayload`). */
export function toCrearVehiculoPayload(nuevo: NuevoVehiculo): CrearVehiculoPayload {
  return {
    patente: nuevo.patente,
    modelo: nuevo.modelo,
    tipo: nuevo.tipo,
    capacidad: nuevo.capacidad,
    estado: toEstadoVehiculoRow(nuevo.estado),
    notas: nuevo.notas ?? null,
    kilometraje: nuevo.kilometraje,
    accesorios: nuevo.accesoriosCompatibles,
    mantenimientos: toMantenimientoRows(nuevo.mantenimientos),
    gastos: toGastoRows(nuevo.gastos),
  };
}

/** Argumento `p_cambios jsonb` de `conductores.actualizar_vehiculo_completo` (D9, 1B.8 — nota:
 * ídem, RPC SUPERSEDED/sin escribir).
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
  if (cambios.accesoriosCompatibles !== undefined) payload.accesorios = cambios.accesoriosCompatibles;
  if (cambios.mantenimientos !== undefined) payload.mantenimientos = toMantenimientoRows(cambios.mantenimientos);
  if (cambios.gastos !== undefined) payload.gastos = toGastoRows(cambios.gastos);

  // `cambios.habilitaciones` NUNCA se lee acá (4.7b), aunque `ActualizacionVehiculo` la admita
  // por ser `Partial<Omit<Vehiculo, 'id'>>`.
  //
  // 4B.3 (RECONCILIADO 2026-08-01): `cambios.kilometrajeUltimoService`/`cambios.fechaUltimoService`
  // TAMPOCO se leen acá nunca, aunque el tipo `ActualizacionVehiculo` los admita — son derivados
  // server-side (ver nota de `CrearVehiculoPayload`), no hay columna propia donde escribirlos.

  return payload;
}
