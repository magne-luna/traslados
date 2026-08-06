// Edge Function: pacientes-personas-a-cargo
//
// CRUD de pacientes.personas_a_cargo. Sub-recurso de pacientes, mismo patron que pacientes-cud.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'pacientes';
const FUNCTION_NAME = 'pacientes-personas-a-cargo';

interface PersonaACargoRow {
  id: string;
  paciente_id: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  telefono: string | null;
  telefono_alternativo: string | null;
}

interface PersonaACargoInput {
  pacienteId?: string;
  nombre?: string;
  apellido?: string;
  dni?: string;
  telefono?: string;
  telefonoAlternativo?: string;
}

function toApi(row: PersonaACargoRow) {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    nombre: row.nombre,
    apellido: row.apellido,
    dni: row.dni ?? undefined,
    telefono: row.telefono ?? undefined,
    telefonoAlternativo: row.telefono_alternativo ?? undefined,
  };
}

function toDb(input: PersonaACargoInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.pacienteId !== undefined) row.paciente_id = input.pacienteId;
  if (input.nombre !== undefined) row.nombre = input.nombre;
  if (input.apellido !== undefined) row.apellido = input.apellido;
  if (input.dni !== undefined) row.dni = input.dni;
  if (input.telefono !== undefined) row.telefono = input.telefono;
  if (input.telefonoAlternativo !== undefined) row.telefono_alternativo = input.telefonoAlternativo;
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
      const { data, error } = await userClient.schema('pacientes').from('personas_a_cargo').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'persona a cargo no encontrada' });
      return jsonResponse(200, toApi(data as PersonaACargoRow));
    }
    if (!pacienteId) return jsonResponse(400, { error: 'falta ?pacienteId= para listar' });
    const { data, error } = await userClient.schema('pacientes').from('personas_a_cargo').select('*').eq('paciente_id', pacienteId);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as PersonaACargoRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: PersonaACargoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.pacienteId || !body.nombre || !body.apellido) {
      return jsonResponse(400, { error: 'faltan campos requeridos: pacienteId, nombre, apellido' });
    }
    const { data, error } = await userClient.schema('pacientes').from('personas_a_cargo').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as PersonaACargoRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id en la URL' });
    let body: PersonaACargoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await userClient
      .schema('pacientes')
      .from('personas_a_cargo')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'persona a cargo no encontrada' });
    return jsonResponse(200, toApi(data as PersonaACargoRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id en la URL' });
    const { error } = await userClient.schema('pacientes').from('personas_a_cargo').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
