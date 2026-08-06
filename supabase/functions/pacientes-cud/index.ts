// Edge Function: pacientes-cud
//
// CRUD de pacientes.cud (Certificado Unico de Discapacidad). Sub-recurso de pacientes, mismo
// patron de auth que pacientes/index.ts. Listar/crear filtra por ?pacienteId=; get/update/delete
// por el id propio del registro de CUD.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'pacientes';
const FUNCTION_NAME = 'pacientes-cud';

interface CudRow {
  id: string;
  paciente_id: string;
  numero_cud: string;
  emision: string | null;
  vencimiento: string | null;
  vigente: boolean;
}

interface CudInput {
  pacienteId?: string;
  numero?: string;
  fechaEmision?: string;
  fechaVencimiento?: string;
  vigente?: boolean;
}

function toApi(row: CudRow) {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    numero: row.numero_cud,
    fechaEmision: row.emision,
    fechaVencimiento: row.vencimiento,
    vigente: row.vigente,
  };
}

function toDb(input: CudInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.pacienteId !== undefined) row.paciente_id = input.pacienteId;
  if (input.numero !== undefined) row.numero_cud = input.numero;
  if (input.fechaEmision !== undefined) row.emision = input.fechaEmision;
  if (input.fechaVencimiento !== undefined) row.vencimiento = input.fechaVencimiento;
  if (input.vigente !== undefined) row.vigente = input.vigente;
  return row;
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
      const { data, error } = await userClient.schema('pacientes').from('cud').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'CUD no encontrado' });
      return jsonResponse(200, toApi(data as CudRow));
    }
    if (!pacienteId) return jsonResponse(400, { error: 'falta ?pacienteId= para listar' });
    const { data, error } = await userClient.schema('pacientes').from('cud').select('*').eq('paciente_id', pacienteId);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as CudRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: CudInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.pacienteId || !body.numero) {
      return jsonResponse(400, { error: 'faltan campos requeridos: pacienteId, numero' });
    }
    const { data, error } = await userClient.schema('pacientes').from('cud').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as CudRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del CUD en la URL' });
    let body: CudInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await userClient.schema('pacientes').from('cud').update(toDb(body)).eq('id', id).select('*').maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'CUD no encontrado' });
    return jsonResponse(200, toApi(data as CudRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del CUD en la URL' });
    const { error } = await userClient.schema('pacientes').from('cud').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
