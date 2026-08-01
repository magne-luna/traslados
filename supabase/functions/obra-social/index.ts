// Edge Function: obra-social
//
// CRUD de obra_social.obra_social. Mismo patron que pacientes/index.ts (ver
// supabase/functions/_shared/auth.ts). No incluye todavia checklist (requisitos_os) ni
// plantilla_factura (plantilla_campo) -- sub-recursos propios, para despues.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'obra_social';
const FUNCTION_NAME = 'obra-social';

interface ObraSocialRow {
  id: string;
  razon_social: string;
  cuit: string;
  codigo: string | null;
  direccion: string | null;
  telefono: string | null;
  condicion_iva: string | null;
  tipo_comprobante: 'A' | 'B' | 'C' | null;
  plazo_cobro_dias: number;
  modalidad_facturacion: 'por-prestacion' | 'general';
  admite_pagos_parciales: boolean;
  identificador_origen: 'paciente.dni' | 'paciente.numeroAfiliado';
}

interface ObraSocialInput {
  nombre?: string;
  cuit?: string;
  codigo?: string;
  direccion?: string;
  telefono?: string;
  condicionIva?: string;
  tipoComprobante?: 'A' | 'B' | 'C';
  plazoCobroDias?: number;
  modalidadFacturacion?: 'por-prestacion' | 'general';
  admitePagosParciales?: boolean;
  identificadorOrigen?: 'paciente.dni' | 'paciente.numeroAfiliado';
}

function toApi(row: ObraSocialRow) {
  return {
    id: row.id,
    nombre: row.razon_social,
    cuit: row.cuit,
    codigo: row.codigo ?? undefined,
    direccion: row.direccion ?? undefined,
    telefono: row.telefono ?? undefined,
    condicionIva: row.condicion_iva ?? undefined,
    tipoComprobante: row.tipo_comprobante ?? undefined,
    plazoCobroDias: row.plazo_cobro_dias,
    modalidadFacturacion: row.modalidad_facturacion,
    admitePagosParciales: row.admite_pagos_parciales,
    identificadorOrigen: row.identificador_origen,
  };
}

function toDb(input: ObraSocialInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.nombre !== undefined) row.razon_social = input.nombre;
  if (input.cuit !== undefined) row.cuit = input.cuit;
  if (input.codigo !== undefined) row.codigo = input.codigo;
  if (input.direccion !== undefined) row.direccion = input.direccion;
  if (input.telefono !== undefined) row.telefono = input.telefono;
  if (input.condicionIva !== undefined) row.condicion_iva = input.condicionIva;
  if (input.tipoComprobante !== undefined) row.tipo_comprobante = input.tipoComprobante;
  if (input.plazoCobroDias !== undefined) row.plazo_cobro_dias = input.plazoCobroDias;
  if (input.modalidadFacturacion !== undefined) row.modalidad_facturacion = input.modalidadFacturacion;
  if (input.admitePagosParciales !== undefined) row.admite_pagos_parciales = input.admitePagosParciales;
  if (input.identificadorOrigen !== undefined) row.identificador_origen = input.identificadorOrigen;
  return row;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { admin } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await admin.schema('obra_social').from('obra_social').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'obra social no encontrada' });
      return jsonResponse(200, toApi(data as ObraSocialRow));
    }
    const { data, error } = await admin.schema('obra_social').from('obra_social').select('*').order('razon_social');
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as ObraSocialRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: ObraSocialInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.nombre || !body.cuit) {
      return jsonResponse(400, { error: 'faltan campos requeridos: nombre, cuit' });
    }
    const { data, error } = await admin.schema('obra_social').from('obra_social').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as ObraSocialRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la obra social en la URL' });
    let body: ObraSocialInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await admin
      .schema('obra_social')
      .from('obra_social')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'obra social no encontrada' });
    return jsonResponse(200, toApi(data as ObraSocialRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la obra social en la URL' });
    const { error } = await admin.schema('obra_social').from('obra_social').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
