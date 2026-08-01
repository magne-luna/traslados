// Edge Function: pacientes
//
// CRUD de pacientes.paciente. Piloto del patron "Edge Function por recurso" (una funcion por
// tabla, ruteo por metodo + :id en el path) -- reemplaza el acceso directo del frontend a la
// tabla via PostgREST/RLS por una API explicita, como una app Node normal. RLS se deja intacta
// como segunda capa de defensa (ver supabase/functions/_shared/auth.ts).
//
// No incluye todavia las entidades relacionadas (cud, direcciones, personas_a_cargo,
// accesorios_pacientes, coberturas_paciente, documentos) -- se suman como sub-recursos propios
// una vez validado este patron.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

const MODULO = 'pacientes';
const FUNCTION_NAME = 'pacientes';

interface PacienteRow {
  id: string;
  nombre_a: string;
  nombre_b: string | null;
  apellido_a: string;
  apellido_b: string | null;
  fecha_nacimiento: string | null;
  dni: string;
  cuil_titular: string | null;
  domicilio: string | null;
  obra_social_id: string | null;
  amparo_judicial: boolean;
  amparo_judicial_aclaracion: string | null;
}

interface PacienteInput {
  nombre?: string;
  segundoNombre?: string;
  apellido?: string;
  segundoApellido?: string;
  fechaNacimiento?: string;
  dni?: string;
  cuilTitular?: string;
  domicilio?: string;
  obraSocialId?: string | null;
  amparoJudicial?: boolean;
  amparoJudicialAclaracion?: string;
}

function toApi(row: PacienteRow) {
  return {
    id: row.id,
    nombre: row.nombre_a,
    segundoNombre: row.nombre_b ?? undefined,
    apellido: row.apellido_a,
    segundoApellido: row.apellido_b ?? undefined,
    fechaNacimiento: row.fecha_nacimiento,
    dni: row.dni,
    cuilTitular: row.cuil_titular,
    domicilio: row.domicilio,
    obraSocialId: row.obra_social_id,
    amparoJudicial: row.amparo_judicial,
    amparoJudicialAclaracion: row.amparo_judicial_aclaracion ?? undefined,
  };
}

function toDb(input: PacienteInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.nombre !== undefined) row.nombre_a = input.nombre;
  if (input.segundoNombre !== undefined) row.nombre_b = input.segundoNombre;
  if (input.apellido !== undefined) row.apellido_a = input.apellido;
  if (input.segundoApellido !== undefined) row.apellido_b = input.segundoApellido;
  if (input.fechaNacimiento !== undefined) row.fecha_nacimiento = input.fechaNacimiento;
  if (input.dni !== undefined) row.dni = input.dni;
  if (input.cuilTitular !== undefined) row.cuil_titular = input.cuilTitular;
  if (input.domicilio !== undefined) row.domicilio = input.domicilio;
  if (input.obraSocialId !== undefined) row.obra_social_id = input.obraSocialId;
  if (input.amparoJudicial !== undefined) row.amparo_judicial = input.amparoJudicial;
  if (input.amparoJudicialAclaracion !== undefined) row.amparo_judicial_aclaracion = input.amparoJudicialAclaracion;
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
      const { data, error } = await admin.schema('pacientes').from('paciente').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'paciente no encontrado' });
      return jsonResponse(200, toApi(data as PacienteRow));
    }
    const { data, error } = await admin.schema('pacientes').from('paciente').select('*').order('apellido_a');
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as PacienteRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: PacienteInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.nombre || !body.apellido || !body.dni) {
      return jsonResponse(400, { error: 'faltan campos requeridos: nombre, apellido, dni' });
    }
    const { data, error } = await admin.schema('pacientes').from('paciente').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as PacienteRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del paciente en la URL' });
    let body: PacienteInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await admin
      .schema('pacientes')
      .from('paciente')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'paciente no encontrado' });
    return jsonResponse(200, toApi(data as PacienteRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del paciente en la URL' });
    const { error } = await admin.schema('pacientes').from('paciente').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
