// Edge Function: autorizaciones
//
// CRUD de facturacion.autorizacion. Mismo patron que presupuestos/index.ts (modulo 'facturacion',
// ver supabase/functions/_shared/auth.ts). RN-PA-01 (monto_autorizado <= presupuesto.monto) NO se
// revalida aca -- ya la aplica el trigger `facturacion.validar_autorizacion_monto` (ver
// 20260729130000_schema_autorizacion_monto_vigencia.sql) para no duplicar la regla en dos lugares.
//
// Soporta `?presupuestoId=` (ver AutorizacionRepository.getByPresupuestoId, relacion 1:N con
// Presupuesto -- autorizacion-mensual tasks.md Fase 2, design.md D5; antes 1---1, una fila por
// mes cargado ademas de las legacy sin mes) ademas del `:id` de path -- si vienen los dos, `:id`
// tiene prioridad.
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
  // Fase 6 (presupuestos-vigencia-datos-traslado-vista-previa, design.md D1/D3): completa el par
  // pedido/concedido -- `vigencia_hasta`/`con_dependencia` ya existen en `presupuesto` (lo pedido),
  // estas son lo concedido. `archivo_tipo_mime` (D6c) puede ser null en filas subidas antes del
  // 2026-08-18 (bucket vivo antes de que la columna existiera) -- ver `archivo_url` mas arriba.
  vigencia_hasta: string | null;
  con_dependencia: boolean | null;
  archivo_tipo_mime: string | null;
  // autorizacion-mensual (tasks.md 2.1, design.md D1/D2/D3): DATE dia-1 absoluto (`YYYY-MM-01`).
  // `NULL` == fila legacy, creada bajo el modelo 1:1 anterior a este change -- nunca se le fabrica
  // un mes. Unico en (presupuesto_id, periodo_mes) via indice parcial (D1); ver GET ?presupuestoId=.
  periodo_mes: string | null;
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
  // Fase 6 (design.md D1/D3): mismo criterio D6b que el resto de esta API -- ausente == no tocar
  // (partial update); presente == escribe, incluido `conDependencia: false` (SD, desmarcable
  // aunque el pedido haya sido CD -- design.md D3).
  vigenciaHasta?: string;
  conDependencia?: boolean;
  /** D6c: viaja desde `File.type` en el upload (tarea 7.3, fuera de alcance de esta fase). */
  archivoTipoMime?: string | null;
  // autorizacion-mensual (tasks.md 2.1, design.md D2): mismo criterio `!== undefined` que el resto
  // de esta API -- ausente == no tocar (partial update); presente == escribe (alta o correccion
  // manual de mes en edicion, D11). Formato ISO `YYYY-MM-01`, normalizado en el frontend antes de
  // llegar aca (`normalizarPeriodoMes`); el `CHECK` de la base es la segunda linea de defensa.
  periodoMes?: string;
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
    // Fase 6 (design.md D1/D3/D6c).
    vigenciaHasta: row.vigencia_hasta ?? undefined,
    conDependencia: row.con_dependencia ?? undefined,
    archivoTipoMime: row.archivo_tipo_mime ?? undefined,
    // autorizacion-mensual (design.md D2/D3): `undefined` == legacy, nunca un mes inventado.
    periodoMes: row.periodo_mes ?? undefined,
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
  // Fase 6 (design.md D1/D3/D6c): partial update, ausente == no tocar. `conDependencia` chequea
  // `!== undefined` (no truthy) para permitir escribir `false` (SD, desmarcable -- D3).
  if (input.vigenciaHasta !== undefined) row.vigencia_hasta = input.vigenciaHasta;
  if (input.conDependencia !== undefined) row.con_dependencia = input.conDependencia;
  if (input.archivoTipoMime !== undefined) row.archivo_tipo_mime = input.archivoTipoMime;
  // autorizacion-mensual (tasks.md 2.1): partial update, mismo patron que el resto del archivo.
  if (input.periodoMes !== undefined) row.periodo_mes = input.periodoMes;
  return row;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const url = new URL(req.url);
  const presupuestoId = url.searchParams.get('presupuestoId');
  // autorizacion-mensual (tasks.md 2.3, design.md D5): filtro opcional para leer un mes puntual
  // sin traer todas las filas del presupuesto. Solo tiene efecto junto con `?presupuestoId=`.
  const periodoMes = url.searchParams.get('periodoMes');
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
      // autorizacion-mensual (tasks.md 2.2, design.md D5): la cardinalidad Presupuesto<->Autorizacion
      // paso de 1:1 a 1:N -- un presupuesto puede tener varias autorizaciones, una por
      // `periodo_mes`, mas las legacy sin mes. `.maybeSingle()` sale: con N filas reales rompia
      // (PostgREST devuelve error, no "la primera"). Se devuelve la LISTA completa, ordenada por
      // `periodo_mes` (`NULLS FIRST` -- legacy primero, D3), y el `404` de "todavia no tiene
      // autorizacion" desaparece: un presupuesto sin filas es `200 []`, no un error (D5).
      let query = userClient
        .schema('facturacion')
        .from('autorizacion')
        .select('*')
        .eq('presupuesto_id', presupuestoId)
        .order('periodo_mes', { ascending: true, nullsFirst: true });
      if (periodoMes) {
        query = query.eq('periodo_mes', periodoMes);
      }
      const { data, error } = await query;
      if (error) return jsonResponse(400, { error: error.message });
      return jsonResponse(200, (data as AutorizacionRow[]).map(toApi));
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
