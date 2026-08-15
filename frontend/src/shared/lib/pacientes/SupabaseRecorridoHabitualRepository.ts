import { supabase } from '../supabaseClient';
import type { NuevoRecorridoHabitual, RecorridoHabitual } from '../../types/recorridoHabitual';
import type { RecorridoHabitualRepository } from './RecorridoHabitualRepository';
import { parseRecorridoHabitualRow, toCrearRecorridoHabitualPayload } from './recorridoHabitualMapping';

// Implementación real de RecorridoHabitualRepository (RF-110, `pacientes.recorridos`). Mismo
// patrón que SupabaseCobroRepository.ts: `pacientes.recorridos` es una sola tabla sin colección
// embebida y sin RPC — CRUD directo (select/insert/delete) vía PostgREST, RLS-only. El gateo de
// ESCRITURA de esta tabla es responsabilidad de `modulos.tiene_permiso('hojas_de_ruta', 'write')`
// en el servidor (ver `RecorridosHabitualesEditor.tsx` — usa `usePuedeEscribirModulo('hojas_de_ruta')`
// del lado cliente, aunque la pantalla viva en Pacientes) — este repository nunca consulta
// `modulos.*` directamente, solo hace el CRUD y confía en que la RLS ya filtra/rechaza.

const SELECT_RECORRIDO = 'id, paciente_id, id_dir_inicial, id_dir_final, dia_semana, hora';

async function listarRecorridosHabituales(pacienteId: string): Promise<RecorridoHabitual[]> {
  const { data, error } = await supabase
    .schema('pacientes')
    .from('recorridos')
    .select(SELECT_RECORRIDO)
    .eq('paciente_id', pacienteId);

  if (error) throw mapearErrorRecorridoHabitual(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => parseRecorridoHabitualRow(row));
}

async function crearRecorridoHabitual(data: NuevoRecorridoHabitual): Promise<RecorridoHabitual> {
  const { data: fila, error } = await supabase
    .schema('pacientes')
    .from('recorridos')
    .insert(toCrearRecorridoHabitualPayload(data))
    .select(SELECT_RECORRIDO)
    .single();

  if (error) throw mapearErrorRecorridoHabitual(error, { operacion: 'guardar' });
  if (fila === null || fila === undefined) {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  return parseRecorridoHabitualRow(fila);
}

async function eliminarRecorridoHabitual(id: string): Promise<void> {
  const { error } = await supabase.schema('pacientes').from('recorridos').delete().eq('id', id);
  if (error) throw mapearErrorRecorridoHabitual(error, { operacion: 'guardar' });
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores — siempre `Error` con mensaje en castellano, nunca texto crudo.
// ---------------------------------------------------------------------------------------------

interface FakeErrorLike {
  code?: string;
  message: string;
}

type OperacionError = 'listar' | 'guardar';

interface ContextoError {
  operacion: OperacionError;
}

const MSG_SIN_PERMISO_ESCRITURA = 'No tenés permiso para modificar los destinos habituales.';
// `id_dir_inicial`/`id_dir_final` referencian `pacientes.direcciones` con `ON DELETE RESTRICT`
// (no debería poder violarse en la práctica, ver comentario del schema), pero se traduce igual
// por si una dirección fue borrada por otra vía entre que se abrió el form y se confirmó el alta.
const MSG_DIRECCION_INEXISTENTE = 'Una de las direcciones elegidas ya no existe. Actualizá la lista de direcciones e intentá de nuevo.';
const MSG_ERROR_GENERICO_CARGA = 'No se pudieron cargar los destinos habituales.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar el destino habitual.';

function mapearErrorRecorridoHabitual(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '42501' || codigo === 'PGRST301') {
    return new Error(MSG_SIN_PERMISO_ESCRITURA);
  }
  if (codigo === '23503') {
    return new Error(MSG_DIRECCION_INEXISTENTE);
  }

  return new Error(contexto.operacion === 'listar' ? MSG_ERROR_GENERICO_CARGA : MSG_ERROR_GENERICO_GUARDADO);
}

// ---------------------------------------------------------------------------------------------

export const supabaseRecorridoHabitualRepository: RecorridoHabitualRepository = {
  list: listarRecorridosHabituales,
  create: crearRecorridoHabitual,
  remove: eliminarRecorridoHabitual,
};
