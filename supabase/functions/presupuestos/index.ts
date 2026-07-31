// Edge Function: presupuestos
//
// CRUD de facturacion.presupuesto. Mismo patron que pacientes/obra-social (ver
// supabase/functions/_shared/auth.ts). El modulo de permisos es 'facturacion' -- Presupuesto y
// Autorizacion comparten modulo con Facturas/Cobros/Gastos de Vehiculos (ver la nota del docx en
// supabase/migrations/20260724100005_schema_facturacion.sql).
//
// `archivoUrl` expone directamente la columna existente (sin nombre/fecha de carga aparte -- el
// nombre ya viaja en la URL y la fecha del presupuesto ya es fecha_emision, agregar columnas
// separadas para eso era redundante).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

// Modulo 'presupuestos' (no 'facturacion'): split via 20260730140000_split_modulos_permisos.sql,
// que movio las RLS policies de presupuesto/autorizacion a 'presupuestos'. Este check de
// permiso a nivel app debe coincidir siempre con el modulo real de la RLS de la tabla.
const MODULO = 'presupuestos';
const FUNCTION_NAME = 'presupuestos';

interface PresupuestoRow {
  id: string;
  obra_social_id: string;
  paciente_id: string;
  monto: number;
  fecha_emision: string;
  archivo_url: string | null;
}

interface PresupuestoInput {
  pacienteId?: string;
  obraSocialId?: string;
  monto?: number;
  fechaEmision?: string;
  archivoUrl?: string;
}

function toApi(row: PresupuestoRow) {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    obraSocialId: row.obra_social_id,
    monto: Number(row.monto),
    fechaEmision: row.fecha_emision,
    archivoUrl: row.archivo_url ?? undefined,
  };
}

function toDb(input: PresupuestoInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.pacienteId !== undefined) row.paciente_id = input.pacienteId;
  if (input.obraSocialId !== undefined) row.obra_social_id = input.obraSocialId;
  if (input.monto !== undefined) row.monto = input.monto;
  if (input.fechaEmision !== undefined) row.fecha_emision = input.fechaEmision;
  if (input.archivoUrl !== undefined) row.archivo_url = input.archivoUrl;
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
      const { data, error } = await admin.schema('facturacion').from('presupuesto').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'presupuesto no encontrado' });
      return jsonResponse(200, toApi(data as PresupuestoRow));
    }
    const { data, error } = await admin.schema('facturacion').from('presupuesto').select('*').order('fecha_emision', { ascending: false });
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as PresupuestoRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: PresupuestoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.pacienteId || !body.obraSocialId || body.monto === undefined || !body.fechaEmision) {
      return jsonResponse(400, { error: 'faltan campos requeridos: pacienteId, obraSocialId, monto, fechaEmision' });
    }
    const { data, error } = await admin.schema('facturacion').from('presupuesto').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as PresupuestoRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del presupuesto en la URL' });
    let body: PresupuestoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await admin
      .schema('facturacion')
      .from('presupuesto')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'presupuesto no encontrado' });
    return jsonResponse(200, toApi(data as PresupuestoRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del presupuesto en la URL' });
    const { error } = await admin.schema('facturacion').from('presupuesto').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
