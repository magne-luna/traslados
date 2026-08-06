// Edge Function: facturas
//
// CRUD de facturacion.facturas, modulo 'facturacion' (ver supabase/functions/_shared/auth.ts).
// `asistencias` (facturacion.asistencia_prestacion) viaja embebida en el body, tal cual el
// contrato del frontend (Factura.asistencias[], sin repository propio, design.md Decision 1 de
// facturacion-ui) -- se persiste en tabla propia (1---N real), pero la API la trata como parte
// de la Factura: reemplazo completo del set en cada POST/PATCH que la incluya (mismo patron que
// update-permisos), nunca merge parcial.
//
// `estado`: la union del frontend ('a-facturar'|'facturado'|'cobrado'|'pagado-parcialmente') no
// coincide textualmente con el enum de la base (incluye 'pendiente', sinonimo historico de
// 'a facturar' segun el docx) -- se mapea en los dos sentidos, nunca se escribe 'pendiente'.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MODULO = 'facturacion';
const FUNCTION_NAME = 'facturas';

type EstadoDb = 'a facturar' | 'pendiente' | 'facturado' | 'cobrado' | 'pagado parcialmente';
type EstadoApi = 'a-facturar' | 'facturado' | 'cobrado' | 'pagado-parcialmente';
type IdentificadorOrigen = 'paciente.dni' | 'paciente.numeroAfiliado';

function estadoToApi(estado: EstadoDb): EstadoApi {
  if (estado === 'a facturar' || estado === 'pendiente') return 'a-facturar';
  if (estado === 'pagado parcialmente') return 'pagado-parcialmente';
  return estado;
}

function estadoToDb(estado: EstadoApi): EstadoDb {
  if (estado === 'a-facturar') return 'a facturar';
  if (estado === 'pagado-parcialmente') return 'pagado parcialmente';
  return estado;
}

interface AsistenciaRow {
  id: string;
  fecha: string;
  prestacion: string;
  dependencia: string | null;
  retorno: string | null;
  factura_sabados: boolean;
}

interface AsistenciaInput {
  fecha?: string;
  prestacion?: string;
  dependencia?: string;
  retorno?: string;
  facturaSabados?: boolean;
}

interface FacturaRow {
  id: string;
  paciente_id: string;
  descripcion: string | null;
  dias: number | null;
  valor_km: number | null;
  monto: number | null;
  estado: EstadoDb;
  fecha_init: string | null;
  fecha_tope: string | null;
  tipo: 'A' | 'B' | 'C' | null;
  cantidad_km: number | null;
  fecha_estimada_cobro: string | null;
  prestacion: string | null;
  mes_facturado: number | null;
  anio_facturado: number | null;
  dependencia_y_retorno: string | null;
  domicilio_id: string | null;
  identificador_origen: IdentificadorOrigen | null;
  identificador_valor: string | null;
  asistencia_prestacion?: AsistenciaRow[];
}

interface FacturaInput {
  pacienteId?: string;
  descripcion?: string;
  dias?: number;
  valorKm?: number;
  monto?: number;
  estado?: EstadoApi;
  fechaInicial?: string;
  fechaTope?: string;
  tipoComprobante?: 'A' | 'B' | 'C';
  cantidadKm?: number;
  fechaEstimadaCobro?: string;
  prestacion?: string;
  mesFacturado?: number;
  anioFacturado?: number;
  dependenciaYRetorno?: string;
  domicilioId?: string;
  identificadorFactura?: { origen: IdentificadorOrigen; valor: string };
  asistencias?: AsistenciaInput[];
}

const SELECT_COLUMNS = '*, asistencia_prestacion(*)';

function asistenciaToApi(row: AsistenciaRow) {
  return {
    id: row.id,
    fecha: row.fecha,
    prestacion: row.prestacion,
    dependencia: row.dependencia ?? '',
    retorno: row.retorno ?? '',
    facturaSabados: row.factura_sabados,
  };
}

function toApi(row: FacturaRow) {
  const identificadorFactura =
    row.identificador_origen && row.identificador_valor
      ? { origen: row.identificador_origen, valor: row.identificador_valor }
      : undefined;
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    descripcion: row.descripcion ?? '',
    dias: row.dias ?? 0,
    valorKm: row.valor_km === null ? 0 : Number(row.valor_km),
    monto: row.monto === null ? 0 : Number(row.monto),
    estado: estadoToApi(row.estado),
    fechaInicial: row.fecha_init,
    fechaTope: row.fecha_tope,
    tipoComprobante: row.tipo,
    cantidadKm: row.cantidad_km === null ? 0 : Number(row.cantidad_km),
    fechaEstimadaCobro: row.fecha_estimada_cobro ?? undefined,
    prestacion: row.prestacion ?? '',
    mesFacturado: row.mes_facturado ?? 0,
    anioFacturado: row.anio_facturado ?? 0,
    dependenciaYRetorno: row.dependencia_y_retorno ?? '',
    domicilioId: row.domicilio_id ?? '',
    identificadorFactura,
    asistencias: (row.asistencia_prestacion ?? []).map(asistenciaToApi),
  };
}

function toDb(input: FacturaInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.pacienteId !== undefined) row.paciente_id = input.pacienteId;
  if (input.descripcion !== undefined) row.descripcion = input.descripcion;
  if (input.dias !== undefined) row.dias = input.dias;
  if (input.valorKm !== undefined) row.valor_km = input.valorKm;
  if (input.monto !== undefined) row.monto = input.monto;
  if (input.estado !== undefined) row.estado = estadoToDb(input.estado);
  if (input.fechaInicial !== undefined) row.fecha_init = input.fechaInicial;
  if (input.fechaTope !== undefined) row.fecha_tope = input.fechaTope;
  if (input.tipoComprobante !== undefined) row.tipo = input.tipoComprobante;
  if (input.cantidadKm !== undefined) row.cantidad_km = input.cantidadKm;
  if (input.fechaEstimadaCobro !== undefined) row.fecha_estimada_cobro = input.fechaEstimadaCobro;
  if (input.prestacion !== undefined) row.prestacion = input.prestacion;
  if (input.mesFacturado !== undefined) row.mes_facturado = input.mesFacturado;
  if (input.anioFacturado !== undefined) row.anio_facturado = input.anioFacturado;
  if (input.dependenciaYRetorno !== undefined) row.dependencia_y_retorno = input.dependenciaYRetorno;
  if (input.domicilioId !== undefined) row.domicilio_id = input.domicilioId;
  if (input.identificadorFactura !== undefined) {
    row.identificador_origen = input.identificadorFactura.origen;
    row.identificador_valor = input.identificadorFactura.valor;
  }
  return row;
}

/** Reemplazo completo (delete + insert): nunca merge parcial contra las asistencias existentes.
 * Recibe userClient -- facturacion.asistencia_prestacion esta cubierta por el mismo modulo
 * 'facturacion' que ya verifico requirePermiso() para este request. */
async function replaceAsistencias(userClient: SupabaseClient, facturaId: string, asistencias: AsistenciaInput[]): Promise<string | null> {
  const { error: deleteError } = await userClient.schema('facturacion').from('asistencia_prestacion').delete().eq('factura_id', facturaId);
  if (deleteError) return deleteError.message;
  if (asistencias.length === 0) return null;

  const rows = asistencias.map((a) => ({
    factura_id: facturaId,
    fecha: a.fecha,
    prestacion: a.prestacion,
    dependencia: a.dependencia,
    retorno: a.retorno,
    factura_sabados: a.facturaSabados ?? false,
  }));
  const { error: insertError } = await userClient.schema('facturacion').from('asistencia_prestacion').insert(rows);
  return insertError ? insertError.message : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const pacienteId = new URL(req.url).searchParams.get('pacienteId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { userClient } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await userClient.schema('facturacion').from('facturas').select(SELECT_COLUMNS).eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'factura no encontrada' });
      return jsonResponse(200, toApi(data as FacturaRow));
    }
    let query = userClient.schema('facturacion').from('facturas').select(SELECT_COLUMNS);
    if (pacienteId) query = query.eq('paciente_id', pacienteId);
    const { data, error } = await query.order('fecha_init', { ascending: false });
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as FacturaRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: FacturaInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.pacienteId) {
      return jsonResponse(400, { error: 'falta el campo requerido: pacienteId' });
    }
    const { data, error } = await userClient.schema('facturacion').from('facturas').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    const factura = data as FacturaRow;

    if (body.asistencias !== undefined) {
      const asistenciaError = await replaceAsistencias(userClient, factura.id, body.asistencias);
      if (asistenciaError) return jsonResponse(400, { error: asistenciaError });
    }

    const { data: withAsistencias, error: refetchError } = await userClient
      .schema('facturacion')
      .from('facturas')
      .select(SELECT_COLUMNS)
      .eq('id', factura.id)
      .single();
    if (refetchError) return jsonResponse(400, { error: refetchError.message });
    return jsonResponse(201, toApi(withAsistencias as FacturaRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la factura en la URL' });
    let body: FacturaInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await userClient.schema('facturacion').from('facturas').update(toDb(body)).eq('id', id).select('*').maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'factura no encontrada' });

    if (body.asistencias !== undefined) {
      const asistenciaError = await replaceAsistencias(userClient, id, body.asistencias);
      if (asistenciaError) return jsonResponse(400, { error: asistenciaError });
    }

    const { data: withAsistencias, error: refetchError } = await userClient
      .schema('facturacion')
      .from('facturas')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .single();
    if (refetchError) return jsonResponse(400, { error: refetchError.message });
    return jsonResponse(200, toApi(withAsistencias as FacturaRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la factura en la URL' });
    const { error } = await userClient.schema('facturacion').from('facturas').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
