// Edge Function: pacientes-coberturas
//
// CRUD de obra_social.coberturas_paciente (historial de afiliacion de un paciente a una obra
// social -- RN-ID-02: valor + formato del identificador de afiliado). Vive fisicamente en el
// schema obra_social, pero conceptualmente es un sub-recurso de paciente, por eso se agrupa
// junto a las demas Edge Functions de pacientes. Gateado por el modulo 'obra_social' (docx:
// "Cobertura del Paciente... modulo obra_social"), no por 'pacientes'.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'obra_social';
const FUNCTION_NAME = 'pacientes-coberturas';

type FormatoAfiliado = 'numero-documento' | 'alfanumerico' | 'cuil-con-sufijo';

interface CoberturaRow {
  id: string;
  paciente_id: string;
  obra_social_id: string;
  num_afiliado: string | null;
  formato_afiliado: FormatoAfiliado;
  fecha_desde: string | null;
  fecha_hasta: string | null;
}

interface CoberturaInput {
  pacienteId?: string;
  obraSocialId?: string;
  numeroAfiliado?: string;
  formatoAfiliado?: FormatoAfiliado;
  fechaDesde?: string;
  fechaHasta?: string;
}

function toApi(row: CoberturaRow) {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    obraSocialId: row.obra_social_id,
    numeroAfiliado: { formato: row.formato_afiliado, valor: row.num_afiliado ?? '' },
    fechaDesde: row.fecha_desde ?? undefined,
    fechaHasta: row.fecha_hasta ?? undefined,
  };
}

function toDb(input: CoberturaInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.pacienteId !== undefined) row.paciente_id = input.pacienteId;
  if (input.obraSocialId !== undefined) row.obra_social_id = input.obraSocialId;
  if (input.numeroAfiliado !== undefined) row.num_afiliado = input.numeroAfiliado;
  if (input.formatoAfiliado !== undefined) row.formato_afiliado = input.formatoAfiliado;
  if (input.fechaDesde !== undefined) row.fecha_desde = input.fechaDesde;
  if (input.fechaHasta !== undefined) row.fecha_hasta = input.fechaHasta;
  return row;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const pacienteId = new URL(req.url).searchParams.get('pacienteId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { admin } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await admin.schema('obra_social').from('coberturas_paciente').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'cobertura no encontrada' });
      return jsonResponse(200, toApi(data as CoberturaRow));
    }
    if (!pacienteId) return jsonResponse(400, { error: 'falta ?pacienteId= para listar' });
    const { data, error } = await admin
      .schema('obra_social')
      .from('coberturas_paciente')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('fecha_desde', { ascending: false });
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as CoberturaRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: CoberturaInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.pacienteId || !body.obraSocialId || !body.formatoAfiliado) {
      return jsonResponse(400, { error: 'faltan campos requeridos: pacienteId, obraSocialId, formatoAfiliado' });
    }
    const { data, error } = await admin.schema('obra_social').from('coberturas_paciente').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as CoberturaRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la cobertura en la URL' });
    let body: CoberturaInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await admin
      .schema('obra_social')
      .from('coberturas_paciente')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'cobertura no encontrada' });
    return jsonResponse(200, toApi(data as CoberturaRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la cobertura en la URL' });
    const { error } = await admin.schema('obra_social').from('coberturas_paciente').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
