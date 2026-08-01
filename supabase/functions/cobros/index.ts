// Edge Function: cobros
//
// CRUD de facturacion.cobros, modulo 'facturacion' (ver supabase/functions/_shared/auth.ts). Sin
// PATCH: CobroRepository del frontend no tiene `update` -- un cobro se crea o se borra, nunca se
// edita (llegan a lo largo de meses, con su propio ciclo de vida, design.md Decision 1 de
// facturacion-ui). `?facturaId=` filtra (CobroRepository.listByFactura); sin filtro, devuelve
// todos los cobros de todas las facturas en una sola lectura (CobroRepository.list(), lo
// necesita C-11 para agregar facturado/cobrado por periodo sin N+1).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'facturacion';
const FUNCTION_NAME = 'cobros';

interface CobroRow {
  id: string;
  facturas_id: string;
  fecha: string;
  monto_pagado: number;
}

interface CobroInput {
  facturaId?: string;
  fecha?: string;
  montoPagado?: number;
}

function toApi(row: CobroRow) {
  return {
    id: row.id,
    facturaId: row.facturas_id,
    fecha: row.fecha,
    montoPagado: Number(row.monto_pagado),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const facturaId = new URL(req.url).searchParams.get('facturaId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { admin } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await admin.schema('facturacion').from('cobros').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'cobro no encontrado' });
      return jsonResponse(200, toApi(data as CobroRow));
    }
    let query = admin.schema('facturacion').from('cobros').select('*');
    if (facturaId) query = query.eq('facturas_id', facturaId);
    const { data, error } = await query.order('fecha');
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as CobroRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: CobroInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.facturaId || !body.fecha || body.montoPagado === undefined) {
      return jsonResponse(400, { error: 'faltan campos requeridos: facturaId, fecha, montoPagado' });
    }
    const { data, error } = await admin
      .schema('facturacion')
      .from('cobros')
      .insert({ facturas_id: body.facturaId, fecha: body.fecha, monto_pagado: body.montoPagado })
      .select('*')
      .single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as CobroRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del cobro en la URL' });
    const { error } = await admin.schema('facturacion').from('cobros').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
