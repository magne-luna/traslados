// Edge Function: pacientes-accesorios
//
// GET/PUT de los accesorios de movilidad de un paciente (M:N via pacientes.accesorios_pacientes
// + catalogo pacientes.accesorios). El frontend modela esto como un array simple de strings
// (AccesorioMovilidad[]), no como filas con id propio -- por eso PUT es reemplazo completo
// (mismo patron que update-permisos: lo que no se manda, se borra).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS } from '../_shared/auth.ts';

const MODULO = 'pacientes';

const ACCESORIOS_VALIDOS = ['silla-plegable', 'silla-rigida', 'silla-postural', 'andador', 'tripode'] as const;
type AccesorioMovilidad = (typeof ACCESORIOS_VALIDOS)[number];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const pacienteId = new URL(req.url).searchParams.get('pacienteId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { userClient } = ctx;

  if (!pacienteId) return jsonResponse(400, { error: 'falta ?pacienteId=' });

  if (req.method === 'GET') {
    const { data, error } = await userClient
      .schema('pacientes')
      .from('accesorios_pacientes')
      .select('accesorios(tipo)')
      .eq('paciente_id', pacienteId);
    if (error) return jsonResponse(400, { error: error.message });
    const tipos = (data as { accesorios: { tipo: string } | null }[]).map((row) => row.accesorios?.tipo).filter(Boolean);
    return jsonResponse(200, { pacienteId, accesorios: tipos });
  }

  if (req.method === 'PUT') {
    let body: { accesorios?: string[] };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!Array.isArray(body.accesorios)) {
      return jsonResponse(400, { error: 'falta el array "accesorios"' });
    }
    const invalidos = body.accesorios.filter((a) => !ACCESORIOS_VALIDOS.includes(a as AccesorioMovilidad));
    if (invalidos.length > 0) {
      return jsonResponse(400, { error: `valores invalidos: ${invalidos.join(', ')}` });
    }

    const { data: catalogo, error: catalogoError } = await userClient
      .schema('pacientes')
      .from('accesorios')
      .select('id, tipo')
      .in('tipo', body.accesorios);
    if (catalogoError) return jsonResponse(400, { error: catalogoError.message });

    const { error: deleteError } = await userClient
      .schema('pacientes')
      .from('accesorios_pacientes')
      .delete()
      .eq('paciente_id', pacienteId);
    if (deleteError) return jsonResponse(400, { error: deleteError.message });

    if (catalogo.length > 0) {
      const filas = catalogo.map((c: { id: string }) => ({ paciente_id: pacienteId, accesorio_id: c.id }));
      const { error: insertError } = await userClient.schema('pacientes').from('accesorios_pacientes').insert(filas);
      if (insertError) return jsonResponse(400, { error: insertError.message });
    }

    return jsonResponse(200, { pacienteId, accesorios: body.accesorios });
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
