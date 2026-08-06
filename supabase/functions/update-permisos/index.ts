// Edge Function: update-permisos
//
// Sets the complete permission set for an existing account (full replace, not a patch):
// upserts every {modulo, nivel_acceso} given, and removes any module not included in the
// call. Meant to back an "editar permisos" screen where the admin sees all modules at once
// and submits the whole desired state.
//
// Admin-only, same reasoning as create-user: RLS already lets an admin write
// modulos.permisos directly, but this packages the array-diff logic (upsert + delete-the-rest)
// so the frontend doesn't have to reimplement it per screen.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NIVELES = ['read', 'write', 'admin'] as const;
type NivelAcceso = (typeof NIVELES)[number];

interface PermisoInput {
  modulo: string;
  nivel_acceso: NivelAcceso;
}

interface UpdatePermisosBody {
  usuario_id: string;
  permisos: PermisoInput[];
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isValidBody(body: unknown): body is UpdatePermisosBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.usuario_id !== 'string' || !UUID_RE.test(b.usuario_id)) return false;
  if (!Array.isArray(b.permisos)) return false;
  return b.permisos.every(
    (p) =>
      typeof p === 'object' &&
      p !== null &&
      typeof (p as Record<string, unknown>).modulo === 'string' &&
      NIVELES.includes((p as Record<string, unknown>).nivel_acceso as NivelAcceso),
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method not allowed' });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(401, { error: 'falta el header Authorization' });
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user: caller },
    error: callerError,
  } = await callerClient.auth.getUser();

  if (callerError || !caller) {
    return jsonResponse(401, { error: 'token invalido' });
  }

  const { data: callerProfile, error: profileError } = await callerClient
    .schema('usuarios')
    .from('usuarios')
    .select('rol')
    .eq('id', caller.id)
    .single();

  if (profileError || callerProfile?.rol !== 'admin') {
    return jsonResponse(403, { error: 'solo administradores pueden editar permisos' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'body invalido, se espera JSON' });
  }

  if (!isValidBody(body)) {
    return jsonResponse(400, {
      error: 'faltan campos requeridos: usuario_id (uuid), permisos ({modulo, nivel_acceso}[])',
    });
  }

  // Ambas lecturas siguientes son RLS-publicas (usuarios.usuarios: "Users can read all profiles",
  // qual = true; modulos.modulos: "Everyone can read modulos", qual = true) -- no hace falta
  // service-role para ninguna de las dos, alcanza con callerClient.
  const { data: usuario, error: usuarioError } = await callerClient
    .schema('usuarios')
    .from('usuarios')
    .select('id')
    .eq('id', body.usuario_id)
    .maybeSingle();

  if (usuarioError) {
    return jsonResponse(400, { error: `error verificando la cuenta: ${usuarioError.message}` });
  }
  if (!usuario) {
    return jsonResponse(404, { error: 'no existe una cuenta con ese usuario_id' });
  }

  const { data: modulos, error: modulosError } = await callerClient
    .schema('modulos')
    .from('modulos')
    .select('id, tipo_modulo')
    .in(
      'tipo_modulo',
      body.permisos.map((p) => p.modulo),
    );

  if (modulosError) {
    return jsonResponse(400, { error: `error leyendo catalogo de modulos: ${modulosError.message}` });
  }

  const modulosPorTipo = new Map(modulos.map((m) => [m.tipo_modulo as string, m.id as string]));
  const desconocidos = body.permisos.filter((p) => !modulosPorTipo.has(p.modulo)).map((p) => p.modulo);
  if (desconocidos.length > 0) {
    return jsonResponse(400, { error: `modulo(s) inexistente(s): ${desconocidos.join(', ')}` });
  }

  // Se escribe con callerClient (scoped al JWT del admin que llama), no con adminClient: la RLS
  // de modulos.permisos ("Admins manage permisos") exige que auth.uid() resuelva al admin real --
  // ya lo verificamos arriba (callerProfile.rol === 'admin') -- para que auditoria.log_action()
  // registre ese usuario en vez de NULL.
  const { error: deleteError } = await callerClient
    .schema('modulos')
    .from('permisos')
    .delete()
    .eq('usuario_id', body.usuario_id);

  if (deleteError) {
    return jsonResponse(400, { error: `no se pudo limpiar los permisos anteriores: ${deleteError.message}` });
  }

  if (body.permisos.length === 0) {
    return jsonResponse(200, { usuario_id: body.usuario_id, permisos: [] });
  }

  const nuevasFilas = body.permisos.map((p) => ({
    usuario_id: body.usuario_id,
    modulo_id: modulosPorTipo.get(p.modulo),
    nivel_acceso: p.nivel_acceso,
  }));

  const { error: insertError } = await callerClient.schema('modulos').from('permisos').insert(nuevasFilas);

  if (insertError) {
    return jsonResponse(400, { error: `no se pudieron guardar los permisos nuevos: ${insertError.message}` });
  }

  return jsonResponse(200, { usuario_id: body.usuario_id, permisos: body.permisos });
});
