// Edge Function: pacientes-documentos
//
// CRUD de pacientes.documentos (metadata del documento; la subida del archivo en si va directo
// a Storage via el cliente, protegida por las RLS policies de storage.objects de C-03 -- esto
// solo administra la fila que linkea paciente + tipo_documento + archivo_url).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'pacientes';
const FUNCTION_NAME = 'pacientes-documentos';

interface DocumentoRow {
  id: string;
  paciente_id: string;
  id_tipo_documento: string;
  archivo_url: string;
  created_at: string;
}

interface DocumentoInput {
  pacienteId?: string;
  tipoDocumentoId?: string;
  archivoUrl?: string;
}

function toApi(row: DocumentoRow) {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    tipoDocumentoId: row.id_tipo_documento,
    archivoUrl: row.archivo_url,
    createdAt: row.created_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const pacienteId = new URL(req.url).searchParams.get('pacienteId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { userClient } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await userClient.schema('pacientes').from('documentos').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'documento no encontrado' });
      return jsonResponse(200, toApi(data as DocumentoRow));
    }
    if (!pacienteId) return jsonResponse(400, { error: 'falta ?pacienteId= para listar' });
    const { data, error } = await userClient.schema('pacientes').from('documentos').select('*').eq('paciente_id', pacienteId);
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
    if (!body.pacienteId || !body.tipoDocumentoId || !body.archivoUrl) {
      return jsonResponse(400, { error: 'faltan campos requeridos: pacienteId, tipoDocumentoId, archivoUrl' });
    }
    const { data, error } = await userClient
      .schema('pacientes')
      .from('documentos')
      .insert({ paciente_id: body.pacienteId, id_tipo_documento: body.tipoDocumentoId, archivo_url: body.archivoUrl })
      .select('*')
      .single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as DocumentoRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del documento en la URL' });
    const { error } = await userClient.schema('pacientes').from('documentos').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
