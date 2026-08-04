// Mapeo puro fila<->dominio para Hojas de Ruta (tasks.md §2, design.md D1/D3/D4 del change
// integracion-hojas-de-ruta). Funciones exportadas, sin red, sin reloj global, sin `any`.
// `SupabaseHojaDeRutaRepository.ts` (sección 3 del change) es la única capa de I/O; acá solo se
// traduce.
//
// Forma de las tablas (veredicto Checkpoint 1 opción A):
//   pacientes.hoja_de_ruta        (id, fecha, franja_inicio, franja_fin, notas)
//   pacientes.recorrido           (id, hoja_de_ruta_id, vehiculo_id, conductor_id, manual, notas)
//   pacientes.historial_recorridos como parada (id, paciente_id, id_dir_inicial, id_dir_final,
//                                 recorrido_id, tramo, orden, hora_estimada — `fecha`,
//                                 `id_vehiculo` y `estado` quedan como columnas legacy que la
//                                 lectura ignora; el escritura conserva `id_vehiculo`
//                                 sincronizado con `recorrido.vehiculo_id`, D3).
//
// Discrepancia de formato TIME (tipo real, no listada en el docx): PostgREST serializa `TIME`
// como `HH:MM:SS` y el dominio modela `HH:mm` (`franjaInicio`/`franjaFin`/`horaEstimada`). Se
// normaliza recortando los segundos al leer; al escribir se manda `HH:mm`, que Postgres acepta
// como literal TIME.

import type {
  ActualizacionHojaDeRuta,
  HojaDeRuta,
  NuevaHojaDeRuta,
  ParadaRecorrido,
  Recorrido,
  Tramo,
} from '../../types/hojaDeRuta';

// -------------------------------------------------------------------------------------------
// Type guards y lectores compartidos (mismo criterio que pacienteMapping/vehiculoMapping).
// -------------------------------------------------------------------------------------------

/** Type guard mínimo sobre `unknown` para filas que llegan de PostgREST. */
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

/** Id no vacío — mínimo común de toda fila que se puede agrupar/identificar. */
function leerId(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/** `TIME` de Postgres (`HH:MM:SS`) -> `HH:mm` del dominio. Cualquier otra forma degrada a ''. */
function normalizarHora(value: unknown): string {
  if (typeof value !== 'string') return '';
  const match = /^(\d{2}:\d{2})(?::\d{2})?$/.exec(value);
  return match === null ? '' : match[1] ?? '';
}

function leerHora(record: Record<string, unknown>, key: string): string {
  return normalizarHora(record[key]);
}

function leerHoraOptional(record: Record<string, unknown>, key: string): string | undefined {
  const value = normalizarHora(record[key]);
  return value === '' ? undefined : value;
}

/** Unión cerrada `Tramo` sin `as`: la comparación por igualdad angosta por sí sola. */
function esTramo(value: unknown): value is Tramo {
  return value === 'ida' || value === 'vuelta';
}

function leerOrden(record: Record<string, unknown>): number | undefined {
  const value = record['orden'];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

// -------------------------------------------------------------------------------------------
// 2.2 — parseHojaDeRutaRow / parseRecorridoRow / parseParadaRow
// -------------------------------------------------------------------------------------------

/** Campos base de `pacientes.hoja_de_ruta` mapeados al dominio (sin la colección de
 *  recorridos, que resuelve `ensamblarHojaDeRuta`). Función total: una fila malformada degrada a
 *  valores vacíos, nunca lanza — el descarte por agregado lo maneja quien la consume. */
export interface HojaDeRutaCamposBase {
  id: string;
  fecha: string;
  franjaInicio: string;
  franjaFin: string;
  notas?: string;
}

export function parseHojaDeRutaRow(row: unknown): HojaDeRutaCamposBase {
  if (!isRecord(row)) {
    return { id: '', fecha: '', franjaInicio: '', franjaFin: '' };
  }

  return {
    id: readString(row, 'id'),
    fecha: readString(row, 'fecha'),
    franjaInicio: leerHora(row, 'franja_inicio'),
    franjaFin: leerHora(row, 'franja_fin'),
    notas: readOptionalString(row, 'notas'),
  };
}

/** Campos base de `pacientes.recorrido` (sin `paradas`, que resuelve `ensamblarHojaDeRuta`).
 *  Devuelve `null` ante una fila malformada (sin `id`, `vehiculo_id` o `conductor_id` — las
 *  columnas NOT NULL que identifican al recorrido); `manual` y `notas` degradan sin descartar. */
export interface RecorridoCamposBase {
  id: string;
  vehiculoId: string;
  conductorId: string;
  manual: boolean;
  notas?: string;
}

export function parseRecorridoRow(row: unknown): RecorridoCamposBase | null {
  if (!isRecord(row)) return null;

  const id = leerId(row, 'id');
  const vehiculoId = leerId(row, 'vehiculo_id');
  const conductorId = leerId(row, 'conductor_id');
  if (id === undefined || vehiculoId === undefined || conductorId === undefined) return null;

  return {
    id,
    vehiculoId,
    conductorId,
    manual: typeof row.manual === 'boolean' ? row.manual : false,
    notas: readOptionalString(row, 'notas'),
  };
}

/** `pacientes.historial_recorridos` (fila con `recorrido_id` NOT NULL) -> `ParadaRecorrido`.
 *  Devuelve `null` ante una fila malformada (campos requeridos por el dominio ausentes o fuera
 *  de la unión cerrada de `Tramo`) — la robustez de la colección la maneja quien la agrupa.
 *  `coordenadaOrigen` queda `undefined` siempre: Checkpoint 2, la base no persiste coordenadas. */
export function parseParadaRow(row: unknown): ParadaRecorrido | null {
  if (!isRecord(row)) return null;

  const id = leerId(row, 'id');
  const pacienteId = leerId(row, 'paciente_id');
  const direccionOrigenId = leerId(row, 'id_dir_inicial');
  const direccionDestinoId = leerId(row, 'id_dir_final');
  if (id === undefined || pacienteId === undefined) return null;
  if (direccionOrigenId === undefined || direccionDestinoId === undefined) return null;

  const tramo = row.tramo;
  if (!esTramo(tramo)) return null;

  const orden = leerOrden(row);
  if (orden === undefined) return null;

  return {
    id,
    pacienteId,
    tramo,
    direccionOrigenId,
    direccionDestinoId,
    orden,
    horaEstimada: leerHoraOptional(row, 'hora_estimada'),
  };
}

// -------------------------------------------------------------------------------------------
// 2.3 — ensamblarHojaDeRuta
// -------------------------------------------------------------------------------------------

function ordenarPorIdAsc<T extends { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

function ordenarParadas(paradas: ParadaRecorrido[]): ParadaRecorrido[] {
  return [...paradas].sort((a, b) => {
    if (a.orden !== b.orden) return a.orden - b.orden;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** Reconstruye el agregado de tres niveles `HojaDeRuta → Recorrido[] → ParadaRecorrido[]`
 *  desde las colecciones planas que devuelve un único select con embed (D1/D2): agrupa los
 *  `recorridoRows` por `hoja_de_ruta_id` y las `paradaRows` por `recorrido_id`. Filas hijas
 *  malformadas se descartan en silencio sin romper el agregado (mismo criterio que
 *  `ensamblarPaciente`); el orden de las colecciones es determinista en el mapeo — paradas por
 *  `orden` con `id` como desempate, recorridos por `id` (spec REQ: nunca el orden físico del
 *  embed). */
export function ensamblarHojaDeRuta(
  hojaRow: unknown,
  recorridoRows: unknown,
  paradaRows: unknown,
): HojaDeRuta {
  const base = parseHojaDeRutaRow(hojaRow);
  const recorridosRaw = Array.isArray(recorridoRows) ? recorridoRows : [];
  const paradasRaw = Array.isArray(paradaRows) ? paradaRows : [];

  const paradasPorRecorrido = new Map<string, ParadaRecorrido[]>();
  for (const paradaRow of paradasRaw) {
    if (!isRecord(paradaRow)) continue;
    const recorridoId = leerId(paradaRow, 'recorrido_id');
    if (recorridoId === undefined) continue;
    const parada = parseParadaRow(paradaRow);
    if (parada === null) continue;
    const lista = paradasPorRecorrido.get(recorridoId) ?? [];
    lista.push(parada);
    paradasPorRecorrido.set(recorridoId, lista);
  }

  const recorridos: Recorrido[] = [];
  for (const recorridoRow of recorridosRaw) {
    if (!isRecord(recorridoRow)) continue;
    if (leerId(recorridoRow, 'hoja_de_ruta_id') !== base.id) continue;
    const campos = parseRecorridoRow(recorridoRow);
    if (campos === null) continue;
    recorridos.push({
      ...campos,
      paradas: ordenarParadas(paradasPorRecorrido.get(campos.id) ?? []),
    });
  }

  return {
    id: base.id,
    fecha: base.fecha,
    franjaInicio: base.franjaInicio,
    franjaFin: base.franjaFin,
    notas: base.notas,
    recorridos: ordenarPorIdAsc(recorridos),
  };
}

// -------------------------------------------------------------------------------------------
// 2.4 — toCrearHojaDeRutaPayload / toActualizarHojaDeRutaPayload
// -------------------------------------------------------------------------------------------

/** Fila de parada para `pacientes.crear_hoja_de_ruta_completa`/`actualizar_hoja_de_ruta_completa`
 *  (D3). `id_vehiculo` va SIEMPRE sincronizado con `vehiculo_id` del recorrido (D3: la función
 *  mantiene la columna legacy al día; nunca puede divergir). `coordenadaOrigen` nunca viaja
 *  (Checkpoint 2). */
export interface ParadaRowInput {
  paciente_id: string;
  id_vehiculo: string;
  id_dir_inicial: string;
  id_dir_final: string;
  tramo: Tramo;
  orden: number;
  hora_estimada: string | null;
}

export interface RecorridoRowInput {
  vehiculo_id: string;
  conductor_id: string;
  manual: boolean;
  notas: string | null;
  paradas: ParadaRowInput[];
}

/** Argumento `p_hoja jsonb` de `pacientes.crear_hoja_de_ruta_completa` (D3). Espeja las claves
 *  que consumirá la migración con `->>`/`->` — nunca agrega una clave que la función no lea. */
export interface CrearHojaDeRutaPayload {
  fecha: string;
  franja_inicio: string;
  franja_fin: string;
  notas: string | null;
  recorridos: RecorridoRowInput[];
}

/** Forma común de fuente de un recorrido: `NuevoRecorrido` (alta, sin id) y `Recorrido` (edición,
 *  con id) comparten estos campos. Los ids de recorrido/parada NO se reenvían (D3: la colección se
 *  reemplaza entera con DELETE+INSERT, el id es identidad de la UI, no dato de escritura). */
interface ParadaFuente {
  pacienteId: string;
  tramo: Tramo;
  direccionOrigenId: string;
  direccionDestinoId: string;
  orden: number;
  horaEstimada?: string;
}

interface RecorridoFuente {
  vehiculoId: string;
  conductorId: string;
  manual: boolean;
  notas?: string;
  paradas: ParadaFuente[];
}

function toParadaRowInput(parada: ParadaFuente, idVehiculo: string): ParadaRowInput {
  return {
    paciente_id: parada.pacienteId,
    // D3: sincronizada con vehiculo_id del recorrido, nunca con la de la parada.
    id_vehiculo: idVehiculo,
    id_dir_inicial: parada.direccionOrigenId,
    id_dir_final: parada.direccionDestinoId,
    tramo: parada.tramo,
    orden: parada.orden,
    hora_estimada: parada.horaEstimada ?? null,
  };
}

function toRecorridoRowInput(recorrido: RecorridoFuente): RecorridoRowInput {
  return {
    vehiculo_id: recorrido.vehiculoId,
    conductor_id: recorrido.conductorId,
    manual: recorrido.manual,
    notas: recorrido.notas ?? null,
    paradas: recorrido.paradas.map((parada) => toParadaRowInput(parada, recorrido.vehiculoId)),
  };
}

export function toCrearHojaDeRutaPayload(nueva: NuevaHojaDeRuta): CrearHojaDeRutaPayload {
  return {
    fecha: nueva.fecha,
    franja_inicio: nueva.franjaInicio,
    franja_fin: nueva.franjaFin,
    notas: nueva.notas ?? null,
    recorridos: nueva.recorridos.map(toRecorridoRowInput),
  };
}

/** Argumento `p_cambios jsonb` de `pacientes.actualizar_hoja_de_ruta_completa` (D3).
 *  **Semántica parcial real**: una clave ausente (`undefined`) NO aparece en el objeto devuelto —
 *  la RPC la distingue con el operador `?` de `jsonb` y no toca esa columna/colección. Una clave
 *  presente con una colección vacía (`recorridos: []`) SÍ viaja — significa "vaciar", no "no
 *  tocar". Es la trampa documentada en design.md D3 y especificada por el scenario "Una clave
 *  ausente en la actualización no toca los recorridos". */
export function toActualizarHojaDeRutaPayload(cambios: ActualizacionHojaDeRuta): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (cambios.fecha !== undefined) payload.fecha = cambios.fecha;
  if (cambios.franjaInicio !== undefined) payload.franja_inicio = cambios.franjaInicio;
  if (cambios.franjaFin !== undefined) payload.franja_fin = cambios.franjaFin;
  if (cambios.notas !== undefined) payload.notas = cambios.notas === '' ? null : cambios.notas;
  if (cambios.recorridos !== undefined) payload.recorridos = cambios.recorridos.map(toRecorridoRowInput);

  return payload;
}
