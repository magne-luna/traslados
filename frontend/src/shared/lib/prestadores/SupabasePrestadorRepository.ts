import { supabase } from '../supabaseClient';
import type { ActualizacionPrestador, NuevoPrestador, Prestador } from '../../types/prestador';
import type { PrestadorRepository } from './PrestadorRepository';
import { parsePrestadorRow, toActualizarPrestadorPayload, toCrearPrestadorPayload } from './prestadorMapping';

// Implementación real de PrestadorRepository (design.md del change prestadores-crud, D1/D2/D3/D4).
// Toda la traducción fila<->dominio vive en `prestadorMapping.ts` (D1); acá solo hay I/O: armar la
// consulta, chequear `error`, y orquestar el diff del vínculo N:N dentro de `update()` (D2). Sin
// RPC, a diferencia de ObraSocial/Paciente: `obra_social.prestadores` no tiene tablas hijas, un
// alta o edición de los campos planos es un único `.insert()`/`.update()` (D1, precedente
// `SupabasePacienteRepository` para los campos planos del paciente).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// Un único `select` con el embed del vínculo (D2) — nunca N+1. `!inner` en la variante filtrada
// fuerza el join para poder filtrar por `obra_social_id` del lado embebido (PostgREST).
const SELECT_PRESTADOR = `
  id, razon_social, cuit, direccion, telefono, plazo_cobro_dias, tipo_comprobante,
  obra_social_prestador ( obra_social_id )
`;

const SELECT_PRESTADOR_POR_OBRA_SOCIAL = `
  id, razon_social, cuit, direccion, telefono, plazo_cobro_dias, tipo_comprobante,
  obra_social_prestador!inner ( obra_social_id )
`;

async function listarPrestadores(): Promise<Prestador[]> {
  const { data, error } = await supabase.schema('obra_social').from('prestadores').select(SELECT_PRESTADOR);
  if (error) throw mapearErrorPrestador(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => parsePrestadorRow(row));
}

async function getPrestadorById(id: string): Promise<Prestador | null> {
  const { data, error } = await supabase
    .schema('obra_social')
    .from('prestadores')
    .select(SELECT_PRESTADOR)
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapearErrorPrestador(error, { operacion: 'listar' });
  // `data === null` cubre tanto "no existe" como "RLS filtró la fila" (mismo contrato que
  // ObraSocialRepository/PacienteRepository, nunca lanza en ese caso).
  if (data === null || data === undefined) return null;

  return parsePrestadorRow(data);
}

/** D2 — panel de solo lectura de `ObraSocialDetail` (work unit futuro): prestadores vinculados a
 * una obra social, vía `!inner` sobre el embed para filtrar por `obra_social_id`. */
async function listarPrestadoresPorObraSocial(obraSocialId: string): Promise<Prestador[]> {
  const { data, error } = await supabase
    .schema('obra_social')
    .from('prestadores')
    .select(SELECT_PRESTADOR_POR_OBRA_SOCIAL)
    .eq('obra_social_prestador.obra_social_id', obraSocialId);

  if (error) throw mapearErrorPrestador(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => parsePrestadorRow(row));
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores (D1) — siempre `Error` con mensaje en castellano, nunca texto crudo.
// ---------------------------------------------------------------------------------------------

interface FakeErrorLike {
  code?: string;
  message: string;
}

type OperacionError = 'listar' | 'crear' | 'actualizar';

interface ContextoError {
  operacion: OperacionError;
  cuit?: string;
  id?: string;
}

const MSG_SIN_PERMISO_ESCRITURA = 'No tenés permiso para modificar prestadores.';
const MSG_MODULO_NO_HABILITADO = 'El módulo de Obras Sociales no está habilitado en el servidor.';
const MSG_CONDICIONES_NO_HABILITADAS =
  'Las condiciones de facturación del prestador no están habilitadas en el servidor todavía.';
const MSG_ERROR_GENERICO_CARGA = 'No se pudo cargar el prestador.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar el prestador.';

function msgCuitDuplicado(cuit: string): string {
  return `Ya existe un prestador con el CUIT «${cuit}».`;
}

export function msgPrestadorInexistente(id: string): string {
  return `No existe un prestador con id "${id}".`;
}

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la UI
 * (D1). Nunca propaga `error.message` crudo. `PGRST204` es el síntoma exacto de la migración
 * `20260801100000_prestadores_condiciones.sql` sin aplicar (D3/riesgo #4). */
function mapearErrorPrestador(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '23505') {
    return new Error(msgCuitDuplicado(contexto.cuit ?? ''));
  }
  if (codigo === 'PGRST204') {
    return new Error(MSG_CONDICIONES_NO_HABILITADAS);
  }
  if (codigo === 'PGRST106') {
    return new Error(MSG_MODULO_NO_HABILITADO);
  }
  if (codigo === '42501' || codigo === 'PGRST301') {
    return new Error(MSG_SIN_PERMISO_ESCRITURA);
  }

  return new Error(contexto.operacion === 'listar' ? MSG_ERROR_GENERICO_CARGA : MSG_ERROR_GENERICO_GUARDADO);
}

// ---------------------------------------------------------------------------------------------
// Alta (D1 — `.insert()` directo, sin RPC)
// ---------------------------------------------------------------------------------------------

async function crearPrestador(data: NuevoPrestador): Promise<Prestador> {
  const { data: fila, error } = await supabase
    .schema('obra_social')
    .from('prestadores')
    .insert(toCrearPrestadorPayload(data))
    .select('id')
    .single();

  if (error) throw mapearErrorPrestador(error, { operacion: 'crear', cuit: data.cuit });

  const id = isRecord(fila) && typeof fila.id === 'string' ? fila.id : null;
  if (id === null) {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  // Simétrico con `update()`: lo devuelto siempre es lo que quedó realmente en la base (defaults,
  // triggers, normalizaciones del servidor).
  const prestador = await getPrestadorById(id);
  if (!prestador) {
    throw new Error('No se pudo recuperar el prestador recién creado.');
  }
  return prestador;
}

// ---------------------------------------------------------------------------------------------
// Edición (D2 — campos planos por `.update()` + diff del vínculo N:N)
// ---------------------------------------------------------------------------------------------

interface VinculoRowCrudo {
  obra_social_id: string;
}

function esVinculoRowCrudo(value: unknown): value is VinculoRowCrudo {
  return isRecord(value) && typeof value.obra_social_id === 'string';
}

/** Diff de D2: lee el conjunto real del servidor, borra solo los quitados, inserta solo los
 * agregados. Si `entrantes` coincide exactamente con lo que ya hay en la base, no emite ningún
 * `.delete()` ni `.insert()` — es la aserción que protege el smoke test de la tarea 3.5. */
async function aplicarDiffVinculo(prestadorId: string, entrantes: string[]): Promise<void> {
  const { data, error } = await supabase
    .schema('obra_social')
    .from('obra_social_prestador')
    .select('obra_social_id')
    .eq('prestador_id', prestadorId);

  if (error) throw mapearErrorPrestador(error, { operacion: 'actualizar', id: prestadorId });

  const actuales = (Array.isArray(data) ? data : []).filter(esVinculoRowCrudo).map((row) => row.obra_social_id);

  const actualesSet = new Set(actuales);
  const entrantesSet = new Set(entrantes);
  const aQuitar = actuales.filter((obraSocialId) => !entrantesSet.has(obraSocialId));
  const aAgregar = entrantes.filter((obraSocialId) => !actualesSet.has(obraSocialId));

  if (aQuitar.length > 0) {
    const { error: errorBorrado } = await supabase
      .schema('obra_social')
      .from('obra_social_prestador')
      .delete()
      .eq('prestador_id', prestadorId)
      .in('obra_social_id', aQuitar);
    if (errorBorrado) throw mapearErrorPrestador(errorBorrado, { operacion: 'actualizar', id: prestadorId });
  }

  if (aAgregar.length > 0) {
    const { error: errorAlta } = await supabase
      .schema('obra_social')
      .from('obra_social_prestador')
      .insert(aAgregar.map((obraSocialId) => ({ obra_social_id: obraSocialId, prestador_id: prestadorId })));
    if (errorAlta) throw mapearErrorPrestador(errorAlta, { operacion: 'actualizar', id: prestadorId });
  }
}

async function actualizarPrestador(id: string, cambios: ActualizacionPrestador): Promise<Prestador> {
  const camposPlanos = toActualizarPrestadorPayload(cambios);
  if (Object.keys(camposPlanos).length > 0) {
    const { error } = await supabase.schema('obra_social').from('prestadores').update(camposPlanos).eq('id', id);
    if (error) throw mapearErrorPrestador(error, { operacion: 'actualizar', cuit: cambios.cuit, id });
  }

  if (cambios.obrasSocialesIds !== undefined) {
    await aplicarDiffVinculo(id, cambios.obrasSocialesIds);
  }

  const actualizado = await getPrestadorById(id);
  if (!actualizado) {
    throw new Error('No se pudo recuperar el prestador actualizado.');
  }
  return actualizado;
}

// ---------------------------------------------------------------------------------------------

export const supabasePrestadorRepository: PrestadorRepository = {
  list: listarPrestadores,
  getById: getPrestadorById,
  create: crearPrestador,
  update: actualizarPrestador,
  listarPorObraSocial: listarPrestadoresPorObraSocial,
};
