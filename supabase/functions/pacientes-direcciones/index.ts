// Edge Function: pacientes-direcciones
//
// CRUD de pacientes.direcciones. Sub-recurso de pacientes, mismo patron que pacientes-cud.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'pacientes';
const FUNCTION_NAME = 'pacientes-direcciones';

type TipoDireccion = 'domicilio' | 'escuela' | 'terapia' | 'ciset' | 'otro';

interface DireccionRow {
  id: string;
  paciente_id: string;
  calle: string;
  numero: string | null;
  tipo_lugar: TipoDireccion;
  localidad: string;
  dias: string | null;
  horario: string | null;
}

interface DireccionInput {
  pacienteId?: string;
  calle?: string;
  numero?: string;
  tipo?: TipoDireccion;
  localidad?: string;
  dias?: string;
  horario?: string;
}

function toApi(row: DireccionRow) {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    calle: row.calle,
    numero: row.numero ?? undefined,
    tipo: row.tipo_lugar,
    localidad: row.localidad,
    dias: row.dias ?? undefined,
    horario: row.horario ?? undefined,
  };
}

function toDb(input: DireccionInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.pacienteId !== undefined) row.paciente_id = input.pacienteId;
  if (input.calle !== undefined) row.calle = input.calle;
  if (input.numero !== undefined) row.numero = input.numero;
  if (input.tipo !== undefined) row.tipo_lugar = input.tipo;
  if (input.localidad !== undefined) row.localidad = input.localidad;
  if (input.dias !== undefined) row.dias = input.dias;
  if (input.horario !== undefined) row.horario = input.horario;
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
      const { data, error } = await admin.schema('pacientes').from('direcciones').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'direccion no encontrada' });
      return jsonResponse(200, toApi(data as DireccionRow));
    }
    if (!pacienteId) return jsonResponse(400, { error: 'falta ?pacienteId= para listar' });
    const { data, error } = await admin.schema('pacientes').from('direcciones').select('*').eq('paciente_id', pacienteId);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as DireccionRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: DireccionInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.pacienteId || !body.calle || !body.tipo || !body.localidad) {
      return jsonResponse(400, { error: 'faltan campos requeridos: pacienteId, calle, tipo, localidad' });
    }
    const { data, error } = await admin.schema('pacientes').from('direcciones').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as DireccionRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la direccion en la URL' });
    let body: DireccionInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await admin
      .schema('pacientes')
      .from('direcciones')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'direccion no encontrada' });
    return jsonResponse(200, toApi(data as DireccionRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la direccion en la URL' });
    const { error } = await admin.schema('pacientes').from('direcciones').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
