// Edge Function: autorizaciones
//
// CRUD de facturacion.autorizacion. Mismo patron que presupuestos/index.ts (modulo 'facturacion',
// ver supabase/functions/_shared/auth.ts). RN-PA-01 (monto_autorizado <= presupuesto.monto) NO se
// revalida aca -- ya la aplica el trigger `facturacion.validar_autorizacion_monto` (ver
// 20260729130000_schema_autorizacion_monto_vigencia.sql) para no duplicar la regla en dos lugares.
//
// Soporta `?presupuestoId=` (ver AutorizacionRepository.getByPresupuestoId, relacion 1---1 con
// Presupuesto) ademas del `:id` de path -- si vienen los dos, `:id` tiene prioridad.
//
// `archivoUrl`/`archivoNombre`/`archivoCargadoEn` exponen las columnas
// `archivo_url`/`archivo_nombre`/`archivo_cargado_en` de facturacion.autorizacion, reabiertas por
// 20260818090000_add_autorizacion_archivo_meta.sql (integracion-documentos-autorizaciones, D4):
// `archivo_url` guarda la CLAVE del objeto en el bucket `documentos-autorizaciones` (no una URL
// firmada), y nombre/fecha de carga son datos reales, no derivados de la clave ni de
// `fecha_respuesta`. Las tres viajan juntas en el mismo PATCH; para quitar el archivo el cliente
// envia las tres en `null` (ver design.md de ese change).

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';

// Modulo 'presupuestos' (no 'facturacion'): split via 20260730140000_split_modulos_permisos.sql,
// que movio las RLS policies de presupuesto/autorizacion a 'presupuestos'. Este check de
// permiso a nivel app debe coincidir siempre con el modulo real de la RLS de la tabla.
const MODULO = 'presupuestos';
const FUNCTION_NAME = 'autorizaciones';

type EstadoAutorizacion = 'pendiente' | 'autorizada' | 'judicializada' | 'rechazada';

interface AutorizacionRow {
  id: string;
  presupuesto_id: string;
  estado: EstadoAutorizacion;
  fecha_respuesta: string | null;
  monto_autorizado: number | null;
  vigencia_desde: string | null;
  cupo_mensual_dias: number | null;
  cupo_mensual_km: number | null;
  archivo_url: string | null;
  archivo_nombre: string | null;
  archivo_cargado_en: string | null;
}

interface AutorizacionInput {
  presupuestoId?: string;
  estado?: EstadoAutorizacion;
  fechaRespuesta?: string;
  montoAutorizado?: number;
  vigenciaDesde?: string;
  cupoMensualDias?: number;
  cupoMensualKm?: number;
  // nullable: el flujo de "quitar archivo" (ver design.md, D5) envia los tres campos en null
  // en el mismo PATCH para limpiar la referencia.
  archivoUrl?: string | null;
  archivoNombre?: string | null;
  archivoCargadoEn?: string | null;
}

function toApi(row: AutorizacionRow) {
  return {
    id: row.id,
    presupuestoId: row.presupuesto_id,
    estado: row.estado,
    fechaRespuesta: row.fecha_respuesta ?? undefined,
    montoAutorizado: row.monto_autorizado === null ? undefined : Number(row.monto_autorizado),
    vigenciaDesde: row.vigencia_desde ?? undefined,
    cupoMensualDias: row.cupo_mensual_dias ?? undefined,
    cupoMensualKm: row.cupo_mensual_km ?? undefined,
    archivoUrl: row.archivo_url ?? undefined,
    archivoNombre: row.archivo_nombre ?? undefined,
    archivoCargadoEn: row.archivo_cargado_en ?? undefined,
  };
}

function toDb(input: AutorizacionInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.presupuestoId !== undefined) row.presupuesto_id = input.presupuestoId;
  if (input.estado !== undefined) row.estado = input.estado;
  if (input.fechaRespuesta !== undefined) row.fecha_respuesta = input.fechaRespuesta;
  if (input.montoAutorizado !== undefined) row.monto_autorizado = input.montoAutorizado;
  if (input.vigenciaDesde !== undefined) row.vigencia_desde = input.vigenciaDesde;
  if (input.cupoMensualDias !== undefined) row.cupo_mensual_dias = input.cupoMensualDias;
  if (input.cupoMensualKm !== undefined) row.cupo_mensual_km = input.cupoMensualKm;
  if (input.archivoUrl !== undefined) row.archivo_url = input.archivoUrl;
  if (input.archivoNombre !== undefined) row.archivo_nombre = input.archivoNombre;
  if (input.archivoCargadoEn !== undefined) row.archivo_cargado_en = input.archivoCargadoEn;
  return row;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const presupuestoId = new URL(req.url).searchParams.get('presupuestoId');
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { userClient } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await userClient.schema('facturacion').from('autorizacion').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'autorizacion no encontrada' });
      return jsonResponse(200, toApi(data as AutorizacionRow));
    }
    if (presupuestoId) {
      const { data, error } = await userClient
        .schema('facturacion')
        .from('autorizacion')
        .select('*')
        .eq('presupuesto_id', presupuestoId)
        .maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'este presupuesto todavia no tiene autorizacion asociada' });
      return jsonResponse(200, toApi(data as AutorizacionRow));
    }
    const { data, error } = await userClient.schema('facturacion').from('autorizacion').select('*');
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(200, (data as AutorizacionRow[]).map(toApi));
  }

  if (req.method === 'POST') {
    let body: AutorizacionInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.presupuestoId) {
      return jsonResponse(400, { error: 'falta el campo requerido: presupuestoId' });
    }
    const { data, error } = await userClient.schema('facturacion').from('autorizacion').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(201, toApi(data as AutorizacionRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la autorizacion en la URL' });
    let body: AutorizacionInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await userClient
      .schema('facturacion')
      .from('autorizacion')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'autorizacion no encontrada' });
    return jsonResponse(200, toApi(data as AutorizacionRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id de la autorizacion en la URL' });
    const { error } = await userClient.schema('facturacion').from('autorizacion').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
