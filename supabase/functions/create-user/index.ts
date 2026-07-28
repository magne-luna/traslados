// Edge Function: create-user
//
// The only way to create an account in this system — there is no public signup
// (knowledge-base/03_actores_y_roles.md: altas las hace la administradora).
// Runs with the service-role key, which per project rule may only live here,
// never in frontend code.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PermisoInput {
  modulo: string;
  nivel_acceso: 'read' | 'write' | 'admin';
}

interface CreateUserBody {
  email: string;
  password: string;
  nombre: string;
  apellido: string;
  permisos?: PermisoInput[];
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isValidBody(body: unknown): body is CreateUserBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.email === 'string' &&
    b.email.length > 0 &&
    typeof b.password === 'string' &&
    b.password.length >= 8 &&
    typeof b.nombre === 'string' &&
    b.nombre.length > 0 &&
    typeof b.apellido === 'string' &&
    b.apellido.length > 0
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

  // Client scoped to the caller's own JWT — used only to identify who is calling.
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
    return jsonResponse(403, { error: 'solo administradores pueden crear cuentas' });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'body invalido, se espera JSON' });
  }

  if (!isValidBody(body)) {
    return jsonResponse(400, {
      error: 'faltan campos requeridos: email, password (min 8 caracteres), nombre, apellido',
    });
  }

  // Service-role client — bypasses RLS, the only client allowed to call auth.admin.*
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { nombre: body.nombre, apellido: body.apellido },
  });

  if (createError || !created.user) {
    return jsonResponse(400, { error: createError?.message ?? 'no se pudo crear la cuenta' });
  }

  if (body.permisos && body.permisos.length > 0) {
    const { data: modulos, error: modulosError } = await adminClient
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
    const permisosRows = body.permisos
      .filter((p) => modulosPorTipo.has(p.modulo))
      .map((p) => ({
        usuario_id: created.user.id,
        modulo_id: modulosPorTipo.get(p.modulo),
        nivel_acceso: p.nivel_acceso,
      }));

    if (permisosRows.length > 0) {
      const { error: permisosError } = await adminClient.schema('modulos').from('permisos').insert(permisosRows);
      if (permisosError) {
        return jsonResponse(400, { error: `cuenta creada pero fallo la asignacion de permisos: ${permisosError.message}` });
      }
    }
  }

  return jsonResponse(200, { id: created.user.id, email: created.user.email });
});
