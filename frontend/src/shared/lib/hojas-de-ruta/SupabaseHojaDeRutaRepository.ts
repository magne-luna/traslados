import { supabase } from '../supabaseClient';
import type {
  ActualizacionHojaDeRuta,
  Coordenada,
  HojaDeRuta,
  NuevaHojaDeRuta,
} from '../../types/hojaDeRuta';
import type { HojaDeRutaRepository } from './HojaDeRutaRepository';
import {
  aplicarCoordenadasOrigen,
  ensamblarHojaDeRuta,
  parseCoordenadasPorDireccion,
  toActualizarHojaDeRutaPayload,
  toCrearHojaDeRutaPayload,
} from './hojaDeRutaMapping';

// Implementación real de HojaDeRutaRepository (change integracion-hojas-de-ruta, design.md
// D1/D3/D4; Checkpoint 1 opción A). Mismo molde que la serie (SupabasePacienteRepository,
// SupabaseCuentaRepository): toda la traducción fila<->dominio vive en `hojaDeRutaMapping.ts`
// (D1); acá solo hay I/O — armar consultas, chequear `error`, aplana las colecciones del embed
// de PostgREST y delega la forma a `ensamblarHojaDeRuta`. Los datos que llegan de supabase-js
// sin generic de esquema son `unknown` en la práctica: se angostan con type guards explícitos,
// nunca `any` ni `as`.
//
// Lectura: un único `select` a `pacientes.hoja_de_ruta` con los dos embeds anidados
// (`recorrido` y, dentro, `historial_recorridos` como paradas) — nunca N+1. El embed devuelve
// las colecciones anidadas; se aplanan acá (forma del transporte) y el ensamblado del agregado
// de tres niveles, el orden determinista y el descarte de filas malformadas son del mapeo puro.
//
// Escritura: `create`/`update` llaman a las RPC `SECURITY INVOKER` de D3
// (`pacientes.crear_hoja_de_ruta_completa` / `pacientes.actualizar_hoja_de_ruta_completa`), que
// escriben hasta tres tablas en una sola transacción, y releen con `getById` después — lo
// devuelto siempre es lo que quedó realmente en la base.
//
// Coordenadas (change hojas-de-ruta-geocoding, RF-701, resuelve Checkpoint 2 de
// integracion-hojas-de-ruta/design.md): después de ensamblar cada hoja, se enriquece con una
// consulta BATCH (nunca N+1, mismo criterio que `leerCoberturasBatch` de
// SupabasePacienteRepository) a `pacientes.direcciones` para resolver `lat`/`lng` de cada
// `direccionOrigenId` referenciado. Una dirección que nunca se geocodificó (o cuyo geocoding
// falló) sencillamente no aparece en el mapa — su `coordenadaOrigen` sigue `undefined`, mismo
// contrato de degradación que el resto del repository (nunca lanza por esto).

// ---------------------------------------------------------------------------------------------
// Lectura (D1) — un único select con embeds de tres niveles.
// ---------------------------------------------------------------------------------------------

// `hoja_de_ruta_id`/`recorrido_id` se seleccionan explícitamente dentro del embed porque
// `ensamblarHojaDeRuta` agrupa por esas claves y no depende del orden físico ni de la
// auto-inyección de la FK por parte de PostgREST.
const SELECT_HOJA_DE_RUTA_CON_RECORRIDOS = `
  id, fecha, franja_inicio, franja_fin, notas,
  recorrido (
    id, hoja_de_ruta_id, vehiculo_id, conductor_id, manual, notas,
    historial_recorridos (
      id, recorrido_id, paciente_id, id_dir_inicial, id_dir_final, tramo, orden, hora_estimada
    )
  )
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Aplana las colecciones anidadas de una fila de hoja (embed de PostgREST) a las tres listas
 *  planas que consume `ensamblarHojaDeRuta`. Solo trabaja la forma del transporte: el descarte
 *  de filas malformadas y el agrupado son responsabilidad del mapeo puro. */
function extraerColeccionesDelEmbed(hojaRow: unknown): { recorridoRows: unknown[]; paradaRows: unknown[] } {
  const recorridoRows: unknown[] = [];
  const paradaRows: unknown[] = [];
  if (!isRecord(hojaRow)) return { recorridoRows, paradaRows };

  const recorridos = hojaRow.recorrido;
  if (Array.isArray(recorridos)) {
    for (const recorridoRow of recorridos) {
      recorridoRows.push(recorridoRow);
      if (!isRecord(recorridoRow)) continue;
      const paradas = recorridoRow.historial_recorridos;
      if (Array.isArray(paradas)) {
        for (const paradaRow of paradas) paradaRows.push(paradaRow);
      }
    }
  }

  return { recorridoRows, paradaRows };
}

function ensamblarDesdeRow(hojaRow: unknown): HojaDeRuta {
  const { recorridoRows, paradaRows } = extraerColeccionesDelEmbed(hojaRow);
  return ensamblarHojaDeRuta(hojaRow, recorridoRows, paradaRows);
}

// ---------------------------------------------------------------------------------------------
// Enriquecimiento de coordenadas (RF-701) — consulta batch, nunca N+1.
// ---------------------------------------------------------------------------------------------

function algunaParadaConDireccionOrigen(hojas: readonly HojaDeRuta[]): boolean {
  return hojas.some((hoja) => hoja.recorridos.some((recorrido) => recorrido.paradas.length > 0));
}

/** Trae TODA `pacientes.direcciones (id, lat, lng)` en una única consulta — mismo criterio que
 *  `leerCoberturasBatch` de SupabasePacienteRepository: sin filtrar por los ids que hacen falta
 *  (evita depender de `.in()` sobre un listado potencialmente grande de `direccionOrigenId`), se
 *  agrupa client-side. Un error de la consulta degrada a un mapa vacío — nunca lanza: la ausencia
 *  de coordenadas para una hoja de ruta es un contenido más pobre, nunca un error de guardado o
 *  lectura de la hoja en sí (mismo contrato de degradación del resto del repository). */
async function obtenerCoordenadasDirecciones(): Promise<Map<string, Coordenada>> {
  const { data, error } = await supabase.schema('pacientes').from('direcciones').select('id, lat, lng');
  if (error) return new Map();
  return parseCoordenadasPorDireccion(data);
}

/** Enriquece un lote de hojas ya ensambladas con `coordenadaOrigen` real (RF-701). Corta antes de
 *  la consulta si ninguna hoja tiene paradas (nada que resolver) — mismo atajo que
 *  `leerCoberturasBatch` con 0 pacientes. */
async function enriquecerConCoordenadas(hojas: HojaDeRuta[]): Promise<HojaDeRuta[]> {
  if (!algunaParadaConDireccionOrigen(hojas)) return hojas;

  const coordenadas = await obtenerCoordenadasDirecciones();
  if (coordenadas.size === 0) return hojas;

  return hojas.map((hoja) => aplicarCoordenadasOrigen(hoja, coordenadas));
}

async function listarHojasDeRuta(): Promise<HojaDeRuta[]> {
  const { data, error } = await supabase
    .schema('pacientes')
    .from('hoja_de_ruta')
    .select(SELECT_HOJA_DE_RUTA_CON_RECORRIDOS)
    .order('fecha', { ascending: true });

  if (error) throw mapearErrorHojaDeRuta(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return enriquecerConCoordenadas(rows.map(ensamblarDesdeRow));
}

async function getHojaDeRutaPorId(id: string): Promise<HojaDeRuta | null> {
  const { data, error } = await supabase
    .schema('pacientes')
    .from('hoja_de_ruta')
    .select(SELECT_HOJA_DE_RUTA_CON_RECORRIDOS)
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapearErrorHojaDeRuta(error, { operacion: 'listar' });
  // `data === null` cubre tanto "no existe" como "RLS filtró la fila" (mismo contrato, nunca lanza).
  if (data === null || data === undefined) return null;

  const [hoja] = await enriquecerConCoordenadas([ensamblarDesdeRow(data)]);
  return hoja ?? null;
}

async function getHojaDeRutaPorFecha(fecha: string): Promise<HojaDeRuta | null> {
  const { data, error } = await supabase
    .schema('pacientes')
    .from('hoja_de_ruta')
    .select(SELECT_HOJA_DE_RUTA_CON_RECORRIDOS)
    .eq('fecha', fecha)
    .maybeSingle();

  if (error) throw mapearErrorHojaDeRuta(error, { operacion: 'listar' });
  if (data === null || data === undefined) return null;

  const [hoja] = await enriquecerConCoordenadas([ensamblarDesdeRow(data)]);
  return hoja ?? null;
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores (D4) — siempre `Error` con mensaje en castellano, nunca texto crudo.
// ---------------------------------------------------------------------------------------------

interface FakeErrorLike {
  code?: string;
  message: string;
}

type OperacionError = 'listar' | 'crear' | 'actualizar';

interface ContextoError {
  operacion: OperacionError;
  id?: string;
}

const MSG_ERROR_GENERICO_CARGA = 'No se pudo cargar la hoja de ruta.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar la hoja de ruta.';
const MSG_MODULO_NO_DISPONIBLE = 'El módulo de Hojas de Ruta no está disponible en el servidor todavía.';
const MSG_GUARDADO_NO_HABILITADO = 'El guardado de hojas de ruta no está habilitado en el servidor todavía.';
const MSG_SIN_PERMISO_LECTURA = 'No tenés permiso para consultar hojas de ruta.';
const MSG_SIN_PERMISO_ESCRITURA = 'No tenés permiso para modificar hojas de ruta.';
const MSG_FECHA_DUPLICADA = 'Ya existe una hoja de ruta para esa fecha.';
const MSG_VEHICULO_CONDUCTOR_INVALIDOS = 'Revisá el vehículo y el conductor del recorrido.';

/** 45302 (D4): el mensaje es idéntico al del mock (`mockHojaDeRutaRepository`), para que el
 *  comportamiento visible no cambie cuando la fuente de datos pase a Supabase. */
function msgHojaDeRutaInexistente(id: string): string {
  return `No existe una hoja de ruta con id "${id}".`;
}

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la
 *  UI (D4). Nunca propaga `error.message` crudo ni nombres de tabla; un código desconocido
 *  degrada al genérico de la operación. */
function mapearErrorHojaDeRuta(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '45301') return new Error(MSG_ERROR_GENERICO_GUARDADO);
  if (codigo === '45302') return new Error(msgHojaDeRutaInexistente(contexto.id ?? ''));
  if (codigo === '45303') return new Error(MSG_FECHA_DUPLICADA);
  if (codigo === '45304') return new Error(MSG_VEHICULO_CONDUCTOR_INVALIDOS);
  if (codigo === 'PGRST204') return new Error(MSG_MODULO_NO_DISPONIBLE);
  if (codigo === 'PGRST202') return new Error(MSG_GUARDADO_NO_HABILITADO);
  if (codigo === '42501') {
    return new Error(contexto.operacion === 'listar' ? MSG_SIN_PERMISO_LECTURA : MSG_SIN_PERMISO_ESCRITURA);
  }

  return new Error(contexto.operacion === 'listar' ? MSG_ERROR_GENERICO_CARGA : MSG_ERROR_GENERICO_GUARDADO);
}

// ---------------------------------------------------------------------------------------------
// Escritura atómica (D3) — una sola RPC por operación, relectura con `getById` después.
// ---------------------------------------------------------------------------------------------

async function crearHojaDeRuta(data: NuevaHojaDeRuta): Promise<HojaDeRuta> {
  const { data: nuevoId, error } = await supabase
    .schema('pacientes')
    .rpc('crear_hoja_de_ruta_completa', { p_hoja: toCrearHojaDeRutaPayload(data) });

  if (error) throw mapearErrorHojaDeRuta(error, { operacion: 'crear' });

  if (typeof nuevoId !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  // Simétrico con `update()` (D3): lo devuelto siempre es lo que quedó realmente en la base.
  const hoja = await getHojaDeRutaPorId(nuevoId);
  if (!hoja) {
    throw new Error('No se pudo recuperar la hoja de ruta recién creada.');
  }
  return hoja;
}

async function actualizarHojaDeRuta(id: string, data: ActualizacionHojaDeRuta): Promise<HojaDeRuta> {
  const { data: resultado, error } = await supabase
    .schema('pacientes')
    .rpc('actualizar_hoja_de_ruta_completa', { p_id: id, p_cambios: toActualizarHojaDeRutaPayload(data) });

  if (error) throw mapearErrorHojaDeRuta(error, { operacion: 'actualizar', id });

  if (typeof resultado !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  const hoja = await getHojaDeRutaPorId(id);
  if (!hoja) {
    throw new Error('No se pudo recuperar la hoja de ruta actualizada.');
  }
  return hoja;
}

// ---------------------------------------------------------------------------------------------

export const supabaseHojaDeRutaRepository: HojaDeRutaRepository = {
  list: listarHojasDeRuta,
  getById: getHojaDeRutaPorId,
  getByFecha: getHojaDeRutaPorFecha,
  create: crearHojaDeRuta,
  update: actualizarHojaDeRuta,
};
