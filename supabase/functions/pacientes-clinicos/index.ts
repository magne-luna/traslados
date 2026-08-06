// Edge Function: pacientes-clinicos
//
// CRUD de pacientes.clinicos (Datos Clinicos: diagnostico + condicion). Relacion 1:1 con
// paciente (paciente_id UNIQUE) -- GET/PUT por ?pacienteId=, sin id propio expuesto en la API
// (upsert: si no existe fila para ese paciente, POST la crea).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS } from '../_shared/auth.ts';

const MODULO = 'pacientes';

interface ClinicosRow {
  id: string;
  paciente_id: string;
  diagnostico: unknown;
  condicion: string | null;
}

interface ClinicosInput {
  pacienteId?: string;
  diagnostico?: unknown;
  condicion?: string;
}

function toApi(row: ClinicosRow) {
  return {
    pacienteId: row.paciente_id,
    diagnostico: row.diagnostico,
    condicion: row.condicion ?? undefined,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const pacienteId = new URL(req.url).searchParams.get('pacienteId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { userClient } = ctx;

  if (!pacienteId) return jsonResponse(400, { error: 'falta ?pacienteId=' });

  if (req.method === 'GET') {
    const { data, error } = await userClient.schema('pacientes').from('clinicos').select('*').eq('paciente_id', pacienteId).maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'sin datos clinicos para este paciente' });
    return jsonResponse(200, toApi(data as ClinicosRow));
  }

  if (req.method === 'PUT' || req.method === 'POST' || req.method === 'PATCH') {
    let body: ClinicosInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await userClient
      .schema('pacientes')
      .from('clinicos')
      .upsert({ paciente_id: pacienteId, diagnostico: body.diagnostico, condicion: body.condicion }, { onConflict: 'paciente_id' })
      .select('*')
      .single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, toApi(data as ClinicosRow));
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
