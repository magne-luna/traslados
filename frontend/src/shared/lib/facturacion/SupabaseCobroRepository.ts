import { supabase } from '../supabaseClient';
import type { Cobro, NuevoCobro } from '../../types/factura';
import type { CobroRepository } from './CobroRepository';
import { parseCobroRow, toCrearCobroPayload } from './facturaMapping';

// Implementación real de CobroRepository (design.md del change integracion-facturacion, D1, D6,
// D7). A diferencia de SupabaseFacturaRepository, `facturacion.cobros` es una sola tabla sin
// colección embebida y sin RPC (D6: "no hace falta RPC, es una sola tabla"). Es CRUD directo:
// select/insert/delete. Toda la traducción fila<->dominio vive en `facturaMapping.ts` (D1) vía
// `parseCobroRow` / `toCrearCobroPayload`, reusadas tal cual — no se reimplementan acá.
//
// Nadie importa este archivo todavía (fase enteramente aditiva, tasks.md sección 4).

const SELECT_COBRO = 'id, facturas_id, fecha, monto_pagado';

async function listarCobros(): Promise<Cobro[]> {
  // 4.1: una sola consulta sin filtro sobre `facturacion.cobros` — la necesita el futuro C-11.
  const { data, error } = await supabase.schema('facturacion').from('cobros').select(SELECT_COBRO);
  if (error) throw mapearErrorCobro(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => parseCobroRow(row));
}

async function listarCobrosPorFactura(facturaId: string): Promise<Cobro[]> {
  // 4.2: filtro sobre la columna `facturas_id` (OJO: nombre real, PLURAL). Un typo acá no rompe
  // compilación, solo devuelve 0 filas siempre — por eso hay un test dedicado al nombre exacto.
  const { data, error } = await supabase
    .schema('facturacion')
    .from('cobros')
    .select(SELECT_COBRO)
    .eq('facturas_id', facturaId);

  if (error) throw mapearErrorCobro(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => parseCobroRow(row));
}

async function crearCobro(data: NuevoCobro): Promise<Cobro> {
  // 4.3: `.insert()` + `.select().single()`, devuelve el `Cobro` mapeado con `parseCobroRow`.
  const { data: fila, error } = await supabase
    .schema('facturacion')
    .from('cobros')
    .insert(toCrearCobroPayload(data))
    .select(SELECT_COBRO)
    .single();

  if (error) throw mapearErrorCobro(error, { operacion: 'guardar' });
  if (fila === null || fila === undefined) {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  return parseCobroRow(fila);
}

async function eliminarCobro(id: string): Promise<void> {
  // 4.4: `.delete().eq('id', id)`.
  const { error } = await supabase.schema('facturacion').from('cobros').delete().eq('id', id);
  if (error) throw mapearErrorCobro(error, { operacion: 'guardar' });
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
}

const MSG_SIN_PERMISO_ESCRITURA = 'No tenés permiso para modificar facturas.';
const MSG_FACTURA_INEXISTENTE = 'La factura de ese cobro ya no existe.';
const MSG_ERROR_GENERICO_CARGA = 'No se pudieron cargar los cobros.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar el cobro.';

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la UI
 * (D7). Nunca propaga `error.message` crudo. */
function mapearErrorCobro(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '42501' || codigo === 'PGRST301') {
    return new Error(MSG_SIN_PERMISO_ESCRITURA);
  }
  if (codigo === '23503') {
    return new Error(MSG_FACTURA_INEXISTENTE);
  }

  return new Error(contexto.operacion === 'listar' ? MSG_ERROR_GENERICO_CARGA : MSG_ERROR_GENERICO_GUARDADO);
}

// ---------------------------------------------------------------------------------------------

export const supabaseCobroRepository: CobroRepository = {
  list: listarCobros,
  listByFactura: listarCobrosPorFactura,
  create: crearCobro,
  remove: eliminarCobro,
};
