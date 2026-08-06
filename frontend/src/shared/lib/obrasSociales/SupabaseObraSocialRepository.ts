import { supabase } from '../supabaseClient';
import type { ActualizacionObraSocial, NuevaObraSocial } from '../../types/obraSocial';
import type { ObraSocialRepository } from './ObraSocialRepository';
import { ensamblarObraSocial, toActualizarObraSocialPayload, toCrearObraSocialPayload } from './obraSocialMapping';

// Implementación real de ObraSocialRepository (design.md del change integracion-obra-social,
// decisiones D1-D12). Toda la traducción fila<->dominio vive en `obraSocialMapping.ts` (D1); acá
// solo hay I/O: armar la consulta, chequear `error`, y orquestar el alta/edición atómica vía RPC
// (D6). Mismo criterio que SupabasePacienteRepository: los datos que llegan de supabase-js sin un
// generic de esquema son `unknown` en la práctica — se narrowean con type guards explícitos en el
// mapeo, nunca acá con `as`.
//
// A diferencia de Pacientes (D3 de integracion-pacientes, que necesita una segunda consulta
// cross-schema para la cobertura), acá todo vive en el mismo schema `obra_social` (D5): una sola
// consulta, sin degradación parcial — una obra social se lee entera o no se lee.

const SELECT_OBRA_SOCIAL_COMPLETA = `
  id, razon_social, cuit, codigo, direccion, telefono, condicion_iva, tipo_comprobante,
  plazo_cobro_dias, modalidad_facturacion, admite_pagos_parciales, identificador_origen,
  formato_afiliado,
  requisitos_os ( id, orden, requerido, tipos_documento ( id, tipo ) ),
  plantilla_campo ( id, etiqueta, origen, orden )
`;

async function listarObrasSociales() {
  const { data, error } = await supabase.schema('obra_social').from('obra_social').select(SELECT_OBRA_SOCIAL_COMPLETA);
  if (error) throw mapearErrorObraSocial(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ensamblarObraSocial(row));
}

async function getObraSocialById(id: string) {
  const { data, error } = await supabase
    .schema('obra_social')
    .from('obra_social')
    .select(SELECT_OBRA_SOCIAL_COMPLETA)
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapearErrorObraSocial(error, { operacion: 'listar' });
  // `data === null` cubre tanto "no existe" como "RLS filtró la fila" (mismo contrato que
  // PacienteRepository, nunca lanza en ese caso).
  if (data === null || data === undefined) return null;

  return ensamblarObraSocial(data);
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores (D7) — siempre `Error` con mensaje en castellano, nunca texto crudo.
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

const MSG_SIN_PERMISO_ESCRITURA = 'No tenés permiso para modificar obras sociales.';
const MSG_MODULO_NO_HABILITADO = 'El módulo de Obras Sociales no está habilitado en el servidor.';
const MSG_ALTA_NO_HABILITADA = 'El alta de obras sociales no está habilitada en el servidor todavía.';
const MSG_CONFIG_FACTURACION_NO_HABILITADA = 'La configuración de facturación no está habilitada en el servidor todavía.';
const MSG_PAYLOAD_INVALIDO = 'No se pudo guardar la obra social.';
const MSG_TIPO_DOCUMENTO_DUPLICADO = 'Ya existe un tipo de documento con ese nombre.';
const MSG_ITEM_SIN_NOMBRE = 'Todos los ítems del checklist necesitan un nombre.';
const MSG_ITEM_CON_DOCUMENTOS = 'No se puede quitar ese ítem: hay documentos de pacientes que lo usan.';
const MSG_ERROR_GENERICO_CARGA = 'No se pudo cargar la obra social.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar la obra social.';

function msgCuitDuplicado(cuit: string): string {
  return `Ya existe una obra social con el CUIT «${cuit}».`;
}

export function msgObraSocialInexistente(id: string): string {
  return `No existe una obra social con id "${id}".`;
}

/** Distingue las dos causas posibles de `23505` (D7): la unique de `obra_social.cuit` vs. la
 * unique de `tipos_documento.tipo` (esta última no debería ocurrir nunca en la práctica — el
 * get-or-create de D3 la previene — pero si aparece por una carrera, el mensaje lo dice sin
 * jerga). Se distingue por el nombre de constraint que Postgres deja en el mensaje crudo, nunca
 * propagado tal cual hacia la UI. */
function esConflictoDeTipoDocumento(mensaje: string): boolean {
  return mensaje.includes('tipos_documento');
}

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la UI
 * (D7). Nunca propaga `error.message` crudo. */
function mapearErrorObraSocial(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '23505') {
    if (esConflictoDeTipoDocumento(error.message)) return new Error(MSG_TIPO_DOCUMENTO_DUPLICADO);
    return new Error(msgCuitDuplicado(contexto.cuit ?? ''));
  }
  if (codigo === '23503') {
    return new Error(MSG_ITEM_CON_DOCUMENTOS);
  }
  if (codigo === '45101') {
    return new Error(MSG_ITEM_SIN_NOMBRE);
  }
  if (codigo === '45102') {
    return new Error(MSG_PAYLOAD_INVALIDO);
  }
  if (codigo === '45103') {
    return new Error(msgObraSocialInexistente(contexto.id ?? ''));
  }
  if (codigo === 'PGRST202') {
    return new Error(MSG_ALTA_NO_HABILITADA);
  }
  if (codigo === 'PGRST204') {
    return new Error(MSG_CONFIG_FACTURACION_NO_HABILITADA);
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
// Alta atómica (D6)
// ---------------------------------------------------------------------------------------------

async function crearObraSocial(data: NuevaObraSocial) {
  const { data: nuevoId, error } = await supabase
    .schema('obra_social')
    .rpc('crear_obra_social_completa', { p_os: toCrearObraSocialPayload(data) });

  if (error) throw mapearErrorObraSocial(error, { operacion: 'crear', cuit: data.cuit });

  if (typeof nuevoId !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  // Simétrico con `update()`: lo devuelto siempre es lo que quedó realmente en la base (defaults,
  // triggers, normalizaciones del servidor).
  const obraSocial = await getObraSocialById(nuevoId);
  if (!obraSocial) {
    throw new Error('No se pudo recuperar la obra social recién creada.');
  }
  return obraSocial;
}

// ---------------------------------------------------------------------------------------------
// Edición atómica (D6) — reemplazo completo de las colecciones ordenadas, no diff fino
// ---------------------------------------------------------------------------------------------

async function actualizarObraSocial(id: string, data: ActualizacionObraSocial) {
  const { data: idActualizado, error } = await supabase
    .schema('obra_social')
    .rpc('actualizar_obra_social_completa', { p_id: id, p_cambios: toActualizarObraSocialPayload(data) });

  if (error) throw mapearErrorObraSocial(error, { operacion: 'actualizar', cuit: data.cuit, id });

  if (typeof idActualizado !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  const obraSocial = await getObraSocialById(id);
  if (!obraSocial) {
    throw new Error('No se pudo recuperar la obra social actualizada.');
  }
  return obraSocial;
}

// ---------------------------------------------------------------------------------------------

export const supabaseObraSocialRepository: ObraSocialRepository = {
  list: listarObrasSociales,
  getById: getObraSocialById,
  create: crearObraSocial,
  update: actualizarObraSocial,
};
