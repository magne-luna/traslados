// Edge Function: vehiculo-documentos
//
// CRUD de conductores.documentacion_vehiculo (metadata del documento; la subida del archivo en
// si va directo a Storage via el cliente, protegida por las RLS policies de storage.objects de
// C-03 -- esto solo administra la fila que linkea vehiculo + tipo_documento + archivo_url).
// Mismo patron que pacientes-documentos/index.ts. `tipo_documento` es TEXT libre (no FK a un
// catalogo, a diferencia de pacientes.documentos).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

// Modulo 'vehiculos' (no 'conductores'): split via 20260730140000_split_modulos_permisos.sql,
// que movio la RLS policy de documentacion_vehiculo a 'vehiculos'.
const MODULO = 'vehiculos';
const FUNCTION_NAME = 'vehiculo-documentos';

interface DocumentoRow {
  id: string;
  vehiculo_id: string;
  tipo_documento: string;
  archivo_url: string;
  created_at: string;
}

interface DocumentoInput {
  vehiculoId?: string;
  tipoDocumento?: string;
  archivoUrl?: string;
}

function toApi(row: DocumentoRow) {
  return {
    id: row.id,
    vehiculoId: row.vehiculo_id,
    tipoDocumento: row.tipo_documento,
    archivoUrl: row.archivo_url,
    createdAt: row.created_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const vehiculoId = new URL(req.url).searchParams.get('vehiculoId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { admin } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await admin.schema('conductores').from('documentacion_vehiculo').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'documento no encontrado' });
      return jsonResponse(200, toApi(data as DocumentoRow));
    }
    if (!vehiculoId) return jsonResponse(400, { error: 'falta ?vehiculoId= para listar' });
    const { data, error } = await admin.schema('conductores').from('documentacion_vehiculo').select('*').eq('vehiculo_id', vehiculoId);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as DocumentoRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: DocumentoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.vehiculoId || !body.tipoDocumento || !body.archivoUrl) {
      return jsonResponse(400, { error: 'faltan campos requeridos: vehiculoId, tipoDocumento, archivoUrl' });
    }
    const { data, error } = await admin
      .schema('conductores')
      .from('documentacion_vehiculo')
      .insert({ vehiculo_id: body.vehiculoId, tipo_documento: body.tipoDocumento, archivo_url: body.archivoUrl })
      .select('*')
      .single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as DocumentoRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del documento en la URL' });
    const { error } = await admin.schema('conductores').from('documentacion_vehiculo').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
