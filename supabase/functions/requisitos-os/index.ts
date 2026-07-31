// Edge Function: requisitos-os
//
// CRUD del checklist de documentacion por obra social (obra_social.requisitos_os), modulo
// 'obra_social' (ver supabase/functions/_shared/auth.ts). El docx modela esto como una tabla de
// vinculo contra un catalogo compartido (obra_social.tipos_documento) -- distinto del array
// embebido `ObraSocial.checklist: ChecklistItem[]` del frontend (discrepancia documentada en
// CHANGES.md, C-04). Esta funcion expone el contrato simple del frontend (`{id, nombre,
// requerido}`, sin tipoDocumentoId) y resuelve el catalogo por dentro: busca `tipos_documento`
// por nombre, lo crea si no existe (find-or-create), para que el caller nunca tenga que conocer
// el id del catalogo.
//
// Siempre se opera sobre un `?obraSocialId=` (el checklist es propio de una obra social, nunca
// global). El orden es explicito (`orden`, no la posicion en el array) porque cada item se
// referencia por su propio id.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

const MODULO = 'obra_social';
const FUNCTION_NAME = 'requisitos-os';

interface RequisitoRow {
  id: string;
  obra_social_id: string;
  orden: number;
  requerido: boolean;
  tipos_documento: { tipo: string } | null;
}

interface RequisitoInput {
  obraSocialId?: string;
  nombre?: string;
  orden?: number;
  requerido?: boolean;
}

const SELECT_COLUMNS = 'id, obra_social_id, orden, requerido, tipos_documento(tipo)';

function toApi(row: RequisitoRow) {
  return {
    id: row.id,
    obraSocialId: row.obra_social_id,
    nombre: row.tipos_documento?.tipo ?? '',
    orden: row.orden,
    requerido: row.requerido,
  };
}

async function resolveTipoDocumentoId(admin: SupabaseClient, nombre: string): Promise<{ id: string } | { error: string }> {
  const { data: existing, error: findError } = await admin
    .schema('obra_social')
    .from('tipos_documento')
    .select('id')
    .eq('tipo', nombre)
    .maybeSingle();
  if (findError) return { error: findError.message };
  if (existing) return { id: existing.id as string };

  const { data: created, error: createError } = await admin
    .schema('obra_social')
    .from('tipos_documento')
    .insert({ tipo: nombre })
    .select('id')
    .single();
  if (createError) return { error: createError.message };
  return { id: created.id as string };
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
      const { data, error } = await admin.schema('obra_social').from('requisitos_os').select(SELECT_COLUMNS).eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'requisito no encontrado' });
      return jsonResponse(200, toApi(data as unknown as RequisitoRow));
    }
    if (!obraSocialId) return jsonResponse(400, { error: 'falta ?obraSocialId=' });
    const { data, error } = await admin
      .schema('obra_social')
      .from('requisitos_os')
      .select(SELECT_COLUMNS)
      .eq('obra_social_id', obraSocialId)
      .order('orden');
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as unknown as RequisitoRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: RequisitoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.obraSocialId || !body.nombre) {
      return jsonResponse(400, { error: 'faltan campos requeridos: obraSocialId, nombre' });
    }
    const tipoDocumento = await resolveTipoDocumentoId(admin, body.nombre);
    if ('error' in tipoDocumento) return jsonResponse(400, { error: tipoDocumento.error });

    const { data, error } = await admin
      .schema('obra_social')
      .from('requisitos_os')
      .insert({
        obra_social_id: body.obraSocialId,
        tipo_documento_id: tipoDocumento.id,
        orden: body.orden ?? 0,
        requerido: body.requerido ?? true,
      })
      .select(SELECT_COLUMNS)
      .single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as unknown as RequisitoRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del requisito en la URL' });
    let body: RequisitoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const row: Record<string, unknown> = {};
    if (body.orden !== undefined) row.orden = body.orden;
    if (body.requerido !== undefined) row.requerido = body.requerido;
    if (body.nombre !== undefined) {
      const tipoDocumento = await resolveTipoDocumentoId(admin, body.nombre);
      if ('error' in tipoDocumento) return jsonResponse(400, { error: tipoDocumento.error });
      row.tipo_documento_id = tipoDocumento.id;
    }

    const { data, error } = await admin.schema('obra_social').from('requisitos_os').update(row).eq('id', id).select(SELECT_COLUMNS).maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'requisito no encontrado' });
    return jsonResponse(200, toApi(data as unknown as RequisitoRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del requisito en la URL' });
    const { error } = await admin.schema('obra_social').from('requisitos_os').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
