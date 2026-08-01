// Edge Function: prestadores
//
// CRUD de obra_social.prestadores. Mismo patron que obra-social/index.ts (modulo 'obra_social',
// ver supabase/functions/_shared/auth.ts). Entidad propia del docx, sin relacion de FK con
// obra_social.obra_social (prestador y obra social pagadora son conceptos distintos).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'obra_social';
const FUNCTION_NAME = 'prestadores';

interface PrestadorRow {
  id: string;
  razon_social: string;
  cuit: string;
  direccion: string | null;
  telefono: string | null;
}

interface PrestadorInput {
  nombre?: string;
  cuit?: string;
  direccion?: string;
  telefono?: string;
}

function toApi(row: PrestadorRow) {
  return {
    id: row.id,
    nombre: row.razon_social,
    cuit: row.cuit,
    direccion: row.direccion ?? undefined,
    telefono: row.telefono ?? undefined,
  };
}

function toDb(input: PrestadorInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.nombre !== undefined) row.razon_social = input.nombre;
  if (input.cuit !== undefined) row.cuit = input.cuit;
  if (input.direccion !== undefined) row.direccion = input.direccion;
  if (input.telefono !== undefined) row.telefono = input.telefono;
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
      const { data, error } = await admin.schema('obra_social').from('prestadores').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'prestador no encontrado' });
      return jsonResponse(200, toApi(data as PrestadorRow));
    }
    const { data, error } = await admin.schema('obra_social').from('prestadores').select('*').order('razon_social');
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as PrestadorRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: PrestadorInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.nombre || !body.cuit) {
      return jsonResponse(400, { error: 'faltan campos requeridos: nombre, cuit' });
    }
    const { data, error } = await admin.schema('obra_social').from('prestadores').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as PrestadorRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del prestador en la URL' });
    let body: PrestadorInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await admin
      .schema('obra_social')
      .from('prestadores')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'prestador no encontrado' });
    return jsonResponse(200, toApi(data as PrestadorRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del prestador en la URL' });
    const { error } = await admin.schema('obra_social').from('prestadores').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
