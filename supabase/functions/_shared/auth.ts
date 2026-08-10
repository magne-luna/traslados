// Helper compartido por todas las Edge Functions de recurso (pacientes, obra_social,
// facturacion, conductores, etc.). Evita repetir en cada funcion el mismo boilerplate de
// create-user/update-permisos: verificar el JWT del caller y chequear su permiso via
// modulos.tiene_permiso() -- la misma funcion que ya usan todas las policies de RLS, para que
// la regla de autorizacion viva en un solo lugar (la base), no duplicada en cada Edge Function.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Bug fix (2026-08-10, encontrado probando `vehiculos` PATCH en vivo desde el navegador): sin
// `Access-Control-Allow-Methods` explícito, el preflight solo deja pasar los métodos "simples"
// del spec de CORS (GET/POST/HEAD) — cualquier PATCH/DELETE contra CUALQUIER Edge Function que use
// este helper quedaba bloqueado por el navegador antes de llegar siquiera a `requirePermiso()`. Los
// tests nunca lo detectaron porque mockean `supabase.functions.invoke` (sin fetch real, sin
// preflight). Afecta a todas las funciones que importan `CORS_HEADERS`, no solo `vehiculos`.
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

export type NivelAcceso = 'read' | 'write' | 'admin';

export interface AuthorizedContext {
  userId: string;
  /** Cliente service-role -- bypasea RLS. La autorizacion ya se verifico via tiene_permiso(); RLS
   * queda como segunda capa de defensa sobre las tablas, no como el unico gate. */
  admin: SupabaseClient;
  /** Cliente scoped al JWT/sesion del caller (mismo cliente usado internamente para verificar
   * el permiso). Las escrituras hechas con este cliente pasan por RLS como ese usuario, por lo
   * que auth.uid() resuelve correctamente en triggers/auditoria. Usar en vez de `admin` para las
   * escrituras finales cuando la RLS de la tabla ya cubre exactamente lo mismo que verifico
   * requirePermiso(). */
  userClient: SupabaseClient;
}

/**
 * Verifica el JWT del caller y chequea que tenga al menos `nivel` sobre `modulo`, llamando a
 * modulos.tiene_permiso() -- la misma funcion que ya usan las RLS policies de cada tabla, para
 * no tener dos implementaciones de la regla de autorizacion.
 *
 * Devuelve el contexto autorizado, o un Response listo para retornar tal cual (401/403/400).
 */
export async function requirePermiso(
  req: Request,
  modulo: string,
  nivel: NivelAcceso,
): Promise<AuthorizedContext | Response> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse(401, { error: 'falta el header Authorization' });
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(401, { error: 'token invalido' });
  }

  const { data: tienePermiso, error: permisoError } = await callerClient
    .schema('modulos')
    .rpc('tiene_permiso', { modulo_req: modulo, nivel_req: nivel });

  if (permisoError) {
    return jsonResponse(400, { error: `error verificando permisos: ${permisoError.message}` });
  }

  if (!tienePermiso) {
    return jsonResponse(403, { error: `no tenes permiso de '${nivel}' sobre el modulo '${modulo}'` });
  }

  return {
    userId: user.id,
    admin: createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY),
    userClient: callerClient,
  };
}

export function isAuthorized(ctx: AuthorizedContext | Response): ctx is AuthorizedContext {
  return !(ctx instanceof Response);
}

/** Extrae el segmento de path despues del nombre de la funcion (ej. el :id de /pacientes/:id). */
export function extractIdFromPath(req: Request, functionName: string): string | null {
  const parts = new URL(req.url).pathname.split('/').filter(Boolean);
  const idx = parts.indexOf(functionName);
  const rest = idx >= 0 ? parts.slice(idx + 1) : parts.slice(1);
  return rest[0] ?? null;
}
