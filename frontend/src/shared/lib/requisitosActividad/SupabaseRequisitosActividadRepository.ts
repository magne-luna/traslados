import { supabase } from '../supabaseClient';
import type { ChecklistItem } from '../../types/documento';
import type { RequisitosActividadRepository, TipoActividad } from './RequisitosActividadRepository';
import { agruparPorTipo, toActualizarRequisitosActividadPayload } from './requisitosActividadMapping';

// Implementación real de RequisitosActividadRepository (design.md D4/D5 del change
// `documentos-checklist-items-por-actividad`, tasks.md §4.2). Toda la traducción fila<->dominio
// vive en `requisitosActividadMapping.ts` (mismo criterio que `SupabaseObraSocialRepository.ts`);
// acá solo hay I/O: armar la consulta/rpc, chequear `error`, traducirlo a castellano.
//
// La escritura pasa SIEMPRE por la RPC `actualizar_requisitos_actividad` (D5,
// `20260810130001_requisitos_actividad_rpc.sql`) — nunca un `INSERT` directo contra
// `tipos_documento` desde acá, mismo criterio que `crearObraSocial`/`actualizarObraSocial`.

const SELECT_REQUISITOS_ACTIVIDAD = 'id, tipo_lugar, orden, requerido, tipos_documento ( id, tipo )';

async function listAll() {
  const { data, error } = await supabase.schema('obra_social').from('requisitos_actividad').select(SELECT_REQUISITOS_ACTIVIDAD);
  if (error) throw mapearErrorRequisitosActividad(error, { operacion: 'listar' });

  return agruparPorTipo(data);
}

async function actualizar(tipo: TipoActividad, items: ChecklistItem[]) {
  const { error } = await supabase
    .schema('obra_social')
    .rpc('actualizar_requisitos_actividad', { p_tipo_lugar: tipo, p_items: toActualizarRequisitosActividadPayload(items) });

  if (error) throw mapearErrorRequisitosActividad(error, { operacion: 'actualizar', tipo });

  // Simétrico con SupabaseObraSocialRepository.actualizarObraSocial: lo devuelto siempre es lo que
  // quedó realmente en la base (get-or-create del servidor puede haber resuelto ids nuevos).
  const todos = await listAll();
  return todos[tipo] ?? [];
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores — siempre un `Error` con mensaje en castellano, nunca texto crudo (mismo
// criterio D7 que `mapearErrorObraSocial`).
// ---------------------------------------------------------------------------------------------

interface FakeErrorLike {
  code?: string;
  message: string;
}

type OperacionError = 'listar' | 'actualizar';

interface ContextoError {
  operacion: OperacionError;
  tipo?: TipoActividad;
}

const MSG_SIN_PERMISO_ESCRITURA = 'No tenés permiso para modificar la documentación por tipo de actividad.';
const MSG_MODULO_NO_HABILITADO = 'El módulo de Obras Sociales no está habilitado en el servidor.';
const MSG_ITEM_SIN_NOMBRE = 'Todos los ítems necesitan un nombre.';
const MSG_PAYLOAD_INVALIDO = 'No se pudo guardar la configuración de este tipo de actividad.';
const MSG_TIPO_INVALIDO = 'Ese tipo de actividad no es válido en la base todavía.';
const MSG_ERROR_GENERICO_CARGA = 'No se pudo cargar la configuración por tipo de actividad.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar la configuración de este tipo de actividad.';

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano (D7). Nunca
 * propaga `error.message` crudo. */
function mapearErrorRequisitosActividad(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '45101') return new Error(MSG_ITEM_SIN_NOMBRE);
  if (codigo === '45102') return new Error(MSG_PAYLOAD_INVALIDO);
  // 22P02: valor inválido para el enum pacientes.tipo_direccion (ver cabecera de
  // 20260810130000_requisitos_actividad.sql — schema drift ya verificado, pero se mapea igual por
  // defensividad ante un tipo futuro que no exista en el enum real).
  if (codigo === '22P02') return new Error(MSG_TIPO_INVALIDO);
  if (codigo === 'PGRST106') return new Error(MSG_MODULO_NO_HABILITADO);
  if (codigo === '42501' || codigo === 'PGRST301') return new Error(MSG_SIN_PERMISO_ESCRITURA);

  return new Error(contexto.operacion === 'listar' ? MSG_ERROR_GENERICO_CARGA : MSG_ERROR_GENERICO_GUARDADO);
}

export const supabaseRequisitosActividadRepository: RequisitosActividadRepository = {
  listAll,
  actualizar,
};
