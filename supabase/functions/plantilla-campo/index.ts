// Edge Function: plantilla-campo
//
// CRUD de obra_social.plantilla_campo, modulo 'obra_social' (ver
// supabase/functions/_shared/auth.ts). Mapea casi 1:1 con `PlantillaCampo` del frontend
// (shared/types/obraSocial.ts) -- a diferencia del checklist, esta tabla no necesita resolver un
// catalogo aparte, `origen` es directamente el enum `OrigenCampoPlantilla`.
//
// Siempre se opera sobre un `?obraSocialId=` (la plantilla es propia de una obra social, nunca
// global). `identificadorOrigen` NO vive aca -- es columna de `obra_social.obra_social` (ver
// obra-social/index.ts).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'obra_social';
const FUNCTION_NAME = 'plantilla-campo';

interface PlantillaCampoRow {
  id: string;
  obra_social_id: string;
  etiqueta: string;
  origen: string;
  orden: number;
}

interface PlantillaCampoInput {
  obraSocialId?: string;
  etiqueta?: string;
  origen?: string;
  orden?: number;
}

function toApi(row: PlantillaCampoRow) {
  return {
    id: row.id,
    obraSocialId: row.obra_social_id,
    etiqueta: row.etiqueta,
    origen: row.origen,
    orden: row.orden,
  };
}

function toDb(input: PlantillaCampoInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.obraSocialId !== undefined) row.obra_social_id = input.obraSocialId;
  if (input.etiqueta !== undefined) row.etiqueta = input.etiqueta;
  if (input.origen !== undefined) row.origen = input.origen;
  if (input.orden !== undefined) row.orden = input.orden;
  return row;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const obraSocialId = new URL(req.url).searchParams.get('obraSocialId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { admin } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await admin.schema('obra_social').from('plantilla_campo').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'campo de plantilla no encontrado' });
      return jsonResponse(200, toApi(data as PlantillaCampoRow));
    }
    if (!obraSocialId) return jsonResponse(400, { error: 'falta ?obraSocialId=' });
    const { data, error } = await admin
      .schema('obra_social')
      .from('plantilla_campo')
      .select('*')
      .eq('obra_social_id', obraSocialId)
      .order('orden');
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as PlantillaCampoRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: PlantillaCampoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.obraSocialId || !body.etiqueta || !body.origen) {
      return jsonResponse(400, { error: 'faltan campos requeridos: obraSocialId, etiqueta, origen' });
    }
    const { data, error } = await admin.schema('obra_social').from('plantilla_campo').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as PlantillaCampoRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del campo en la URL' });
    let body: PlantillaCampoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await admin
      .schema('obra_social')
      .from('plantilla_campo')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'campo de plantilla no encontrado' });
    return jsonResponse(200, toApi(data as PlantillaCampoRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del campo en la URL' });
    const { error } = await admin.schema('obra_social').from('plantilla_campo').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
