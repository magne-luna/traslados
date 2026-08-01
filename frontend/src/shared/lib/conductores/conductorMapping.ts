// Mapeo puro fila<->dominio para Conductores (tasks.md §6, design.md D6/D7/D10/D12/D13 del change
// `integracion-conductores-vehiculos`). Funciones exportadas, sin red, sin `any`.
// `SupabaseConductorRepository.ts` (§7) es la única capa de I/O; acá solo se traduce.
//
// Columnas reales de `conductores.conductores` (design.md §Context, verificado contra D11):
// `id, nombre, apellido, dni, cuil, telefono, fecha_nacimiento, domicilio, estado, notas`.
// `restricciones` NO existe en la base ni en el dominio (D6-B): no hay columna, no hay campo, no
// se mapea nada — el único campo libre del perfil es `notas` <-> `observaciones` (D15 #1).

import type { ActualizacionConductor, AsignacionSemanal, Conductor, EstadoConductor } from '../../types/conductor';
import { desdeHastaASemanaIso, semanaIsoADesdeHasta } from './semanaIso';

// -------------------------------------------------------------------------------------------
// Type guards y helpers de lectura defensiva — mismo patrón que `vehiculoMapping.ts` (§4),
// definidos localmente: no hay un módulo de utilidades compartido entre dominios de mapeo.
// -------------------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** Lee un string y degrada a `''` si está ausente, es `null` o no es string — nunca inventa un
 * valor ni descarta la fila. Usado para `domicilio`/`cuil` (6.2): requeridos en el tipo del
 * frontend, nullable en la base. */
function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

// -------------------------------------------------------------------------------------------
// 6.3 — parseEstadoConductor / toEstadoConductorRow (D13)
// -------------------------------------------------------------------------------------------

const DEFAULT_ESTADO_CONDUCTOR: EstadoConductor = 'operando';

/** `'fuera de servicio'` (base, con espacio) <-> `'fuera-de-servicio'` (dominio, con guion).
 * Función **total**, no un `.replace(' ', '-')` — mismo criterio que `parseEstadoVehiculo`. Un
 * valor desconocido (o no-string) degrada al default del dominio, nunca lanza. */
export function parseEstadoConductor(value: unknown): EstadoConductor {
  if (value === 'fuera de servicio') return 'fuera-de-servicio';
  if (value === 'operando') return 'operando';
  return DEFAULT_ESTADO_CONDUCTOR;
}

export function toEstadoConductorRow(estado: EstadoConductor): string {
  return estado === 'fuera-de-servicio' ? 'fuera de servicio' : 'operando';
}

// -------------------------------------------------------------------------------------------
// 6.2 — parseConductorRow
// -------------------------------------------------------------------------------------------

export type ConductorCamposBase = Omit<Conductor, 'asignaciones'>;

/** Fila plana de `conductores.conductores` -> campos base del dominio (sin `asignaciones`, que
 * arma `ensamblarConductor` a partir del embed). Renombres: `dni` -> `documento`, `notas` ->
 * `observaciones`, `fecha_nacimiento` -> `fechaNacimiento`. `domicilio`/`cuil` son requeridos en
 * `Conductor` pero nullable en la base (design.md D15 #12): degradan a `''`, nunca descartan la
 * fila por eso. `restricciones` no se lee de ninguna columna (D6-B, 6.4): no existe en el tipo. */
export function parseConductorRow(row: unknown): ConductorCamposBase | null {
  if (!isRecord(row)) return null;

  const id = row.id;
  const dni = row.dni;
  if (typeof id !== 'string' || id === '') return null;
  if (typeof dni !== 'string' || dni === '') return null;

  return {
    id,
    nombre: readString(row, 'nombre'),
    apellido: readString(row, 'apellido'),
    documento: dni,
    telefono: readOptionalString(row, 'telefono'),
    fechaNacimiento: readOptionalString(row, 'fecha_nacimiento'),
    domicilio: readString(row, 'domicilio'),
    cuil: readString(row, 'cuil'),
    estado: parseEstadoConductor(row.estado),
    observaciones: readOptionalString(row, 'notas'),
  };
}

// -------------------------------------------------------------------------------------------
// 6.5 / 6.6 — parseAsignacionRow / toAsignacionRows (design.md D7): la traducción bidireccional
// entre `(fecha_init, fecha_fin_semana)` y la etiqueta ISO `semana` vive enteramente en
// `semanaIso.ts` (6.1) — este módulo solo arma/desarma el objeto `AsignacionSemanal`.
// -------------------------------------------------------------------------------------------

/** Fila de `conductores.conductores_vehiculos` -> `AsignacionSemanal`. Fila sin `id`,
 * `vehiculo_id` o alguna de las dos fechas se descarta (`null`), sin romper el resto de las
 * asignaciones del conductor. **Fila incoherente** (`fecha_init` que no cae en lunes): no se
 * descarta ni se "corrige" contra `fecha_fin_semana` — `desdeHastaASemanaIso` deriva directamente
 * la semana ISO que *contiene* `fecha_init`, que es la única fuente de verdad (design.md D7
 * §Degradación). */
export function parseAsignacionRow(row: unknown): AsignacionSemanal | null {
  if (!isRecord(row)) return null;

  const id = row.id;
  const vehiculoId = row.vehiculo_id;
  const fechaInit = row.fecha_init;
  const fechaFinSemana = row.fecha_fin_semana;

  if (typeof id !== 'string' || id === '') return null;
  if (typeof vehiculoId !== 'string' || vehiculoId === '') return null;
  if (typeof fechaInit !== 'string' || fechaInit === '') return null;
  if (typeof fechaFinSemana !== 'string' || fechaFinSemana === '') return null;

  return {
    id,
    vehiculoId,
    semana: desdeHastaASemanaIso(fechaInit, fechaFinSemana),
  };
}

/** `AsignacionSemanal[]` -> filas de `conductores.conductores_vehiculos`. `fecha_init` es el
 * lunes de la semana indicada y `fecha_fin_semana` su domingo (`semanaIsoADesdeHasta`, 6.1) — la
 * vuelta exacta de `parseAsignacionRow`. */
export interface AsignacionRowInput {
  id: string;
  vehiculo_id: string;
  fecha_init: string;
  fecha_fin_semana: string;
}

export function toAsignacionRows(asignaciones: AsignacionSemanal[]): AsignacionRowInput[] {
  return asignaciones.map((asignacion) => {
    const { desde, hasta } = semanaIsoADesdeHasta(asignacion.semana);
    return {
      id: asignacion.id,
      vehiculo_id: asignacion.vehiculoId,
      fecha_init: desde,
      fecha_fin_semana: hasta,
    };
  });
}

// -------------------------------------------------------------------------------------------
// 6.7 — ensamblarConductor(row): combina la fila con su embed `conductores_vehiculos` (D11) en un
// `Conductor` completo. El orden se aplica client-side, en el mapeo puro, sobre las filas crudas
// (antes de perder `fecha_init` al convertir a `semana`): `fecha_init` asc, `id` como desempate
// determinista — mismo criterio que `ordenarPorFechaDescYId` de `vehiculoMapping.ts`, pero
// ascendente (asignaciones futuras/pasadas se leen en orden cronológico, no "la más nueva primero").
// -------------------------------------------------------------------------------------------

function ordenarAsignacionesPorFechaInitAscYId(rows: readonly unknown[]): unknown[] {
  return [...rows].sort((a, b) => {
    const fechaA = isRecord(a) && typeof a.fecha_init === 'string' ? a.fecha_init : '';
    const fechaB = isRecord(b) && typeof b.fecha_init === 'string' ? b.fecha_init : '';
    if (fechaA !== fechaB) return fechaA < fechaB ? -1 : 1;

    const idA = isRecord(a) && typeof a.id === 'string' ? a.id : '';
    const idB = isRecord(b) && typeof b.id === 'string' ? b.id : '';
    return idA < idB ? -1 : 1;
  });
}

/** Fila de `conductores.conductores` con su embed `conductores_vehiculos` (D11) -> `Conductor`
 * completo. Fila de conductor inválida (sin `id`/`dni`) -> `null`, no rompe el `list()` entero.
 * Embed ausente o no-array -> `asignaciones: []`, nunca `undefined`. */
export function ensamblarConductor(row: unknown): Conductor | null {
  const base = parseConductorRow(row);
  if (base === null) return null;

  const record = isRecord(row) ? row : {};
  const asignacionesRaw = Array.isArray(record.conductores_vehiculos) ? record.conductores_vehiculos : [];

  const asignaciones = ordenarAsignacionesPorFechaInitAscYId(asignacionesRaw)
    .map((fila) => parseAsignacionRow(fila))
    .filter((asignacion): asignacion is AsignacionSemanal => asignacion !== null);

  return { ...base, asignaciones };
}

// -------------------------------------------------------------------------------------------
// 6.8 — toActualizarConductorPayload(cambios): argumento `p_cambios jsonb` de
// `conductores.actualizar_conductor_completo` (D9, §7). **Semántica parcial real**, idéntica en
// espíritu a `toActualizarVehiculoPayload` (§4.9): una clave ausente en `cambios` (`undefined`) NO
// aparece en el payload — la RPC la distingue con el operador `?` de `jsonb` y no toca esa
// columna/colección. Editar solo el teléfono, por ejemplo, no debe emitir `asignaciones`.
//
// **No hay ningún flag de instrucción de escritura que emitir** (D7 §Colisión, D6-B): no existe
// `permitirMultiple` (la colisión la resuelve el constraint `uq_conductor_semana` de la base, no
// un flag en el payload) ni `restricciones` (el campo no existe en el dominio desde D6-B — no hay
// nada que leer de `cambios` para esa clave, ni siquiera por accidente: `ActualizacionConductor`
// no la declara).
// -------------------------------------------------------------------------------------------

export function toActualizarConductorPayload(cambios: ActualizacionConductor): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (cambios.apellido !== undefined) payload.apellido = cambios.apellido;
  if (cambios.nombre !== undefined) payload.nombre = cambios.nombre;
  if (cambios.documento !== undefined) payload.dni = cambios.documento;
  if (cambios.telefono !== undefined) payload.telefono = cambios.telefono;
  if (cambios.fechaNacimiento !== undefined) payload.fecha_nacimiento = cambios.fechaNacimiento || null;
  if (cambios.domicilio !== undefined) payload.domicilio = cambios.domicilio;
  if (cambios.cuil !== undefined) payload.cuil = cambios.cuil;
  if (cambios.estado !== undefined) payload.estado = toEstadoConductorRow(cambios.estado);
  if (cambios.observaciones !== undefined) {
    payload.notas = cambios.observaciones === '' ? null : cambios.observaciones;
  }
  if (cambios.asignaciones !== undefined) payload.asignaciones = toAsignacionRows(cambios.asignaciones);

  return payload;
}
