import { supabase } from '../supabaseClient';
import type { ActualizacionFactura, Factura, NuevaFactura } from '../../types/factura';
import type { FacturaRepository } from './FacturaRepository';
import { ensamblarFactura, toActualizarFacturaPayload, toCrearFacturaPayload } from './facturaMapping';

// Implementación real de FacturaRepository (design.md del change integracion-facturacion,
// decisiones D1, D4, D5, D7). Toda la traducción fila<->dominio vive en `facturaMapping.ts` (D1);
// acá solo hay I/O: armar la consulta, chequear `error`, y orquestar el alta/edición atómica vía
// RPC (D4). Los datos que llegan de supabase-js sin un generic de esquema son `unknown` en la
// práctica — se narrowean con type guards explícitos en el mapeo, nunca acá con `as`.
//
// D5: todo vive en el mismo schema `facturacion`, así que list()/getById()/listByPaciente() usan
// una única consulta con el embed de asistencias — sin segunda consulta ni degradación parcial.
// Nadie importa este archivo todavía (fase enteramente aditiva, tasks.md sección 3).

const SELECT_FACTURA_COMPLETA = `
  id, paciente_id, descripcion, dias, valor_km, monto, estado, fecha_init, fecha_tope, tipo,
  cantidad_km, fecha_estimada_cobro, fecha_factura, prestacion, mes_facturado, anio_facturado,
  dependencia_y_retorno, domicilio_id, identificador_origen, identificador_valor, autorizacion_id,
  asistencia_prestacion ( id, fecha, prestacion, dependencia, retorno, factura_sabados )
`;

async function listarFacturas(): Promise<Factura[]> {
  const { data, error } = await supabase.schema('facturacion').from('facturas').select(SELECT_FACTURA_COMPLETA);
  if (error) throw mapearErrorFactura(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ensamblarFactura(row));
}

async function getFacturaById(id: string): Promise<Factura | null> {
  const { data, error } = await supabase
    .schema('facturacion')
    .from('facturas')
    .select(SELECT_FACTURA_COMPLETA)
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapearErrorFactura(error, { operacion: 'listar' });
  // `data === null` cubre tanto "no existe" como "RLS filtró la fila" (mismo contrato que
  // SupabaseObraSocialRepository/SupabasePacienteRepository, nunca lanza en ese caso).
  if (data === null || data === undefined) return null;

  return ensamblarFactura(data);
}

async function listarFacturasPorPaciente(pacienteId: string): Promise<Factura[]> {
  const { data, error } = await supabase
    .schema('facturacion')
    .from('facturas')
    .select(SELECT_FACTURA_COMPLETA)
    .eq('paciente_id', pacienteId);

  if (error) throw mapearErrorFactura(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => ensamblarFactura(row));
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores (D7) — siempre `Error` con mensaje en castellano, nunca texto crudo.
// ---------------------------------------------------------------------------------------------

interface FakeErrorLike {
  code?: string;
  message: string;
}

type OperacionError = 'listar' | 'guardar';

interface ContextoError {
  operacion: OperacionError;
  id?: string;
}

const MSG_SIN_PERMISO_ESCRITURA = 'No tenés permiso para modificar facturas.';
const MSG_PACIENTE_INEXISTENTE = 'El paciente seleccionado ya no existe.';
const MSG_DOMICILIO_INEXISTENTE = 'El domicilio seleccionado ya no existe en la ficha del paciente.';
const MSG_MES_FUERA_DE_RANGO = 'El mes facturado debe estar entre 1 y 12.';
const MSG_PAYLOAD_INVALIDO = 'No se pudo guardar la factura.';
const MSG_ASISTENCIAS_INCOMPLETAS = 'Todas las asistencias necesitan fecha y prestación.';
const MSG_ALTA_NO_HABILITADA = 'El alta de facturas no está habilitada en el servidor todavía.';
const MSG_FECHA_FACTURA_NO_HABILITADA = 'La fecha de emisión de factura no está habilitada en el servidor todavía.';
const MSG_MODULO_NO_HABILITADO = 'El módulo de Facturación no está habilitado en el servidor.';
const MSG_ERROR_GENERICO_CARGA = 'No se pudo cargar la factura.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar la factura.';

export function msgFacturaInexistente(id: string): string {
  return `No existe una factura con id "${id}".`;
}

/** Distingue las dos causas posibles de `23503` (D7): la FK sobre `paciente_id` vs. la FK sobre
 * `domicilio_id`. Se distingue por el nombre de columna/constraint que Postgres deja en el mensaje
 * crudo, nunca propagado tal cual hacia la UI. */
function esConflictoDeDomicilio(mensaje: string): boolean {
  return mensaje.includes('domicilio_id');
}

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la UI
 * (D7). Nunca propaga `error.message` crudo. */
function mapearErrorFactura(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '42501' || codigo === 'PGRST301') {
    return new Error(MSG_SIN_PERMISO_ESCRITURA);
  }
  if (codigo === '23503') {
    return new Error(esConflictoDeDomicilio(error.message) ? MSG_DOMICILIO_INEXISTENTE : MSG_PACIENTE_INEXISTENTE);
  }
  if (codigo === '23514') {
    return new Error(MSG_MES_FUERA_DE_RANGO);
  }
  if (codigo === '22P02') {
    return new Error(MSG_PAYLOAD_INVALIDO);
  }
  if (codigo === '45201') {
    return new Error(MSG_ASISTENCIAS_INCOMPLETAS);
  }
  if (codigo === '45202') {
    return new Error(MSG_PAYLOAD_INVALIDO);
  }
  if (codigo === '45203') {
    return new Error(msgFacturaInexistente(contexto.id ?? ''));
  }
  if (codigo === '45204') {
    return new Error(MSG_MES_FUERA_DE_RANGO);
  }
  if (codigo === 'PGRST202') {
    return new Error(MSG_ALTA_NO_HABILITADA);
  }
  if (codigo === 'PGRST204') {
    return new Error(MSG_FECHA_FACTURA_NO_HABILITADA);
  }
  if (codigo === 'PGRST106') {
    return new Error(MSG_MODULO_NO_HABILITADO);
  }

  return new Error(contexto.operacion === 'listar' ? MSG_ERROR_GENERICO_CARGA : MSG_ERROR_GENERICO_GUARDADO);
}

// ---------------------------------------------------------------------------------------------
// Alta atómica (D4) — una sola RPC, ningún insert directo sobre asistencia_prestacion
// ---------------------------------------------------------------------------------------------

async function crearFactura(data: NuevaFactura): Promise<Factura> {
  const { data: nuevoId, error } = await supabase
    .schema('facturacion')
    .rpc('crear_factura_completa', { p_factura: toCrearFacturaPayload(data) });

  if (error) throw mapearErrorFactura(error, { operacion: 'guardar' });

  if (typeof nuevoId !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  // Simétrico con `update()`: lo devuelto siempre es lo que quedó realmente en la base (defaults,
  // triggers, normalizaciones del servidor).
  const factura = await getFacturaById(nuevoId);
  if (!factura) {
    throw new Error('No se pudo recuperar la factura recién creada.');
  }
  return factura;
}

// ---------------------------------------------------------------------------------------------
// Edición atómica (D4) — reemplazo completo de asistencias solo si la clave está presente
// ---------------------------------------------------------------------------------------------

async function actualizarFactura(id: string, data: ActualizacionFactura): Promise<Factura> {
  const { data: idActualizado, error } = await supabase
    .schema('facturacion')
    .rpc('actualizar_factura_completa', { p_id: id, p_cambios: toActualizarFacturaPayload(data) });

  if (error) throw mapearErrorFactura(error, { operacion: 'guardar', id });

  if (typeof idActualizado !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  const factura = await getFacturaById(id);
  if (!factura) {
    throw new Error('No se pudo recuperar la factura actualizada.');
  }
  return factura;
}

// ---------------------------------------------------------------------------------------------

export const supabaseFacturaRepository: FacturaRepository = {
  list: listarFacturas,
  getById: getFacturaById,
  listByPaciente: listarFacturasPorPaciente,
  create: crearFactura,
  update: actualizarFactura,
};
