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
//
// REAPERTURA #13 (decisión usuaria 2026-08-16, WU1 de `facturacion-cambios-ui`, migración
// `20260816110000_presupuesto_lineas.sql`): la modalidad `general` ahora SI persiste su desglose
// por prestacion (`facturacion.presupuesto_linea`).
//   * POST alta simple: `lineas` (arreglo `{ prestacionId, monto, orden }`) viaja como parametro
//     `p_lineas` de `crear_presupuesto_completo` (mismo `monto` unico ademas, sin cambios).
//   * POST alta en lote: cada item puede llevar `lineas` (misma forma) DENTRO del item --
//     `crear_presupuestos_lote` no cambio de firma (decision del WU1, ver cabecera de la
//     migracion): el desglose por item vive en `v_item -> 'lineas'`.
//   * GET (unico y listado): responde `lineas` con la MISMA forma que el resto de la API
//     (`{ id, prestacionId, monto, orden }`, resolvidas via PostgREST sobre
//     `facturacion.presupuesto_linea` -- solo lectura, RLS "Read presupuesto_linea" aplica).
//   * PATCH/DELETE: sin cambios -- la edicion no toca el desglose persistido (D9: "la edicion no
//     bifurca", el form de edicion muestra solo el monto simple) y el DELETE de la cabecera se
//     borra con CASCADE por `presupuesto_id`.
//
// presupuesto-prestaciones PR 2 (design.md D2, opcion A -- decidida en el gate de tasks.md 0.2):
// la escritura (POST) deja de hacer `.insert(...)` directo contra la tabla y pasa a invocar las RPC
// `facturacion.crear_presupuesto_completo` / `facturacion.crear_presupuestos_lote`, ambas
// SECURITY INVOKER (la sesion sigue siendo la del `userClient`, RLS aplica igual que antes -- esta
// funcion NO se convierte en un atajo que bypasee permisos). `requirePermiso` se mantiene como
// defensa en profundidad, sin cambios. Un body que es un arreglo JSON dispara el alta en lote
// (una prestacion por presupuesto, modalidad `por-prestacion`); un body que es un objeto dispara
// el alta simple (modalidad `general`) -- mismo endpoint `POST /presupuestos`, un solo llamador
// (`SupabasePresupuestoRepository.create()`/`.createLote()`) que ya elige la forma correcta segun
// D9. GET/PATCH/DELETE no cambian: siguen leyendo/escribiendo `facturacion.presupuesto` via
// PostgREST directo, RPC solo se usa para el alta (D2 no toca lectura ni edicion).

import {
  requirePermiso,
  isAuthorized,
  jsonResponse,
  CORS_HEADERS,
  extractIdFromPath,
} from '../_shared/auth.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

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
  prestacion_id: string | null;
  // Fase 6 (presupuestos-vigencia-datos-traslado-vista-previa, design.md D1/D2/D3): 13 columnas
  // nuevas, todas nullable salvo dias_semana (NOT NULL DEFAULT '{}'). km_ida/km_vuelta son
  // NUMERIC -> PostgREST las serializa como string, igual que `monto`.
  vigencia_desde: string | null;
  vigencia_hasta: string | null;
  con_dependencia: boolean | null;
  origen_ida: string | null;
  destino_ida: string | null;
  origen_vuelta: string | null;
  destino_vuelta: string | null;
  horario_entrada: string | null;
  horario_salida: string | null;
  km_ida: string | null;
  km_vuelta: string | null;
  dias_semana: string[];
  dias_mensuales: number | null;
}

/** Fila de `facturacion.presupuesto_linea` (REAPERTURA #13, 2026-08-16). */
interface PresupuestoLineaRow {
  id: string;
  presupuesto_id: string;
  prestacion_id: string;
  monto: number;
  orden: number;
}

interface PresupuestoLineaInput {
  prestacionId: string;
  monto: number;
  /** 1-based en la API; opcional (la migracion cae a 0 si falta). */
  orden?: number;
}

interface PresupuestoInput {
  pacienteId?: string;
  obraSocialId?: string;
  monto?: number;
  fechaEmision?: string;
  archivoUrl?: string;
  /** presupuesto-prestaciones PR 2 (design.md D9): poblado solo en modalidad por-prestacion. */
  prestacionId?: string;
  /** REAPERTURA #13 (2026-08-16): desglose de la modalidad `general`. Ausente == sin lineas. */
  lineas?: PresupuestoLineaInput[];
  // Fase 6 (design.md D1/D2/D3): mismo criterio D6b que el resto de esta API -- ausente == no
  // tocar (partial update); presente == escribe, incluido `conDependencia: false` (SD decidido).
  // Nombres calcados 1:1 de `PresupuestoInput` en frontend/src/shared/lib/presupuestos/
  // presupuestoMapping.ts, que ya aplana `datosTraslado` a estas mismas 10 claves planas.
  vigenciaDesde?: string;
  vigenciaHasta?: string;
  conDependencia?: boolean;
  origenIda?: string;
  destinoIda?: string;
  origenVuelta?: string;
  destinoVuelta?: string;
  horarioEntrada?: string;
  horarioSalida?: string;
  kmIda?: number;
  kmVuelta?: number;
  /** `TEXT[]` en la base (D2: "la cerradura la impone el tipo, no la base") -- se pasa tal cual,
   * sin parsear/validar server-side; el type-guard vive en el mapping del frontend (Fase 5). */
  diasSemana?: string[];
  diasMensuales?: number;
}

function toApiLinea(row: PresupuestoLineaRow) {
  return {
    id: row.id,
    prestacionId: row.prestacion_id,
    monto: Number(row.monto),
    orden: row.orden,
  };
}

/** For de payload de RPC: `{ prestacion_id, monto, orden }` (el nombre de la columna manda). */
function toDbLineas(lineas: PresupuestoLineaInput[]) {
  return lineas.map((linea) => ({
    prestacion_id: linea.prestacionId,
    monto: linea.monto,
    ...(linea.orden !== undefined ? { orden: linea.orden } : {}),
  }));
}

function toApi(row: PresupuestoRow, lineas: PresupuestoLineaInput[]) {
  return {
    id: row.id,
    pacienteId: row.paciente_id,
    obraSocialId: row.obra_social_id,
    monto: Number(row.monto),
    fechaEmision: row.fecha_emision,
    archivoUrl: row.archivo_url ?? undefined,
    prestacionId: row.prestacion_id ?? undefined,
    lineas,
    // Fase 6 (design.md D1/D2/D3): mismo criterio ?? undefined que el resto de columnas
    // nullable de esta fila. km_ida/km_vuelta son NUMERIC -> Number(), igual que `monto`.
    vigenciaDesde: row.vigencia_desde ?? undefined,
    vigenciaHasta: row.vigencia_hasta ?? undefined,
    conDependencia: row.con_dependencia ?? undefined,
    origenIda: row.origen_ida ?? undefined,
    destinoIda: row.destino_ida ?? undefined,
    origenVuelta: row.origen_vuelta ?? undefined,
    destinoVuelta: row.destino_vuelta ?? undefined,
    horarioEntrada: row.horario_entrada ?? undefined,
    horarioSalida: row.horario_salida ?? undefined,
    kmIda: row.km_ida === null ? undefined : Number(row.km_ida),
    kmVuelta: row.km_vuelta === null ? undefined : Number(row.km_vuelta),
    // dias_semana es NOT NULL DEFAULT '{}': nunca null, se pasa tal cual (D2).
    diasSemana: row.dias_semana,
    diasMensuales: row.dias_mensuales ?? undefined,
  };
}

/**
 * Lineas de `facturacion.presupuesto_linea` agrupadas por presupuesto, ordenadas por `orden`
 * (REAPERTURA #13, 2026-08-16). Devuelve un Map presupuesto_id -> lineas (filas API).
 */
async function lineasPorPresupuestoIds(userClient: SupabaseClient, presupuestoIds: string[]) {
  const { data, error } = await userClient
    .schema('facturacion')
    .from('presupuesto_linea')
    .select('*')
    .in('presupuesto_id', presupuestoIds)
    .order('orden', { ascending: true });
  const mapa = new Map<string, PresupuestoLineaInput[]>();
  if (!error) {
    for (const linea of (data as PresupuestoLineaRow[] | null) ?? []) {
      const grupo = mapa.get(linea.presupuesto_id) ?? [];
      grupo.push(toApiLinea(linea));
      mapa.set(linea.presupuesto_id, grupo);
    }
  }
  return mapa;
}

function toDb(input: PresupuestoInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.pacienteId !== undefined) row.paciente_id = input.pacienteId;
  if (input.obraSocialId !== undefined) row.obra_social_id = input.obraSocialId;
  if (input.monto !== undefined) row.monto = input.monto;
  if (input.fechaEmision !== undefined) row.fecha_emision = input.fechaEmision;
  if (input.archivoUrl !== undefined) row.archivo_url = input.archivoUrl;
  if (input.prestacionId !== undefined) row.prestacion_id = input.prestacionId;
  // Fase 6 (design.md D1/D2/D3): partial update, ausente == no tocar. `conDependencia` chequea
  // `!== undefined` (no truthy) para permitir escribir `false` (SD, decisión tomada -- D3).
  if (input.vigenciaDesde !== undefined) row.vigencia_desde = input.vigenciaDesde;
  if (input.vigenciaHasta !== undefined) row.vigencia_hasta = input.vigenciaHasta;
  if (input.conDependencia !== undefined) row.con_dependencia = input.conDependencia;
  if (input.origenIda !== undefined) row.origen_ida = input.origenIda;
  if (input.destinoIda !== undefined) row.destino_ida = input.destinoIda;
  if (input.origenVuelta !== undefined) row.origen_vuelta = input.origenVuelta;
  if (input.destinoVuelta !== undefined) row.destino_vuelta = input.destinoVuelta;
  if (input.horarioEntrada !== undefined) row.horario_entrada = input.horarioEntrada;
  if (input.horarioSalida !== undefined) row.horario_salida = input.horarioSalida;
  if (input.kmIda !== undefined) row.km_ida = input.kmIda;
  if (input.kmVuelta !== undefined) row.km_vuelta = input.kmVuelta;
  if (input.diasSemana !== undefined) row.dias_semana = input.diasSemana;
  if (input.diasMensuales !== undefined) row.dias_mensuales = input.diasMensuales;
  return row;
}

function faltanCamposRequeridos(input: PresupuestoInput): boolean {
  return !input.pacienteId || !input.obraSocialId || input.monto === undefined || !input.fechaEmision;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { userClient } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await userClient.schema('facturacion').from('presupuesto').select('*').eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'presupuesto no encontrado' });
      const lineas = await lineasPorPresupuestoIds(userClient, [id]);
      return jsonResponse(200, toApi(data as PresupuestoRow, lineas.get(id) ?? []));
    }
    const { data, error } = await userClient.schema('facturacion').from('presupuesto').select('*').order('fecha_emision', { ascending: false });
    if (error) return jsonResponse(400, { error: error.message });
    const rows = (data as PresupuestoRow[] | null) ?? [];
    const lineas = await lineasPorPresupuestoIds(userClient, rows.map((row) => row.id));
    return jsonResponse(200, rows.map((row) => toApi(row, lineas.get(row.id) ?? [])));
  }

  if (req.method === 'POST') {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }

    // Alta en lote (modalidad por-prestacion, D9/D2 opcion A): un arreglo dispara
    // crear_presupuestos_lote -- atomica, o entran todos o no entra ninguno.
    if (Array.isArray(body)) {
      const items = body as PresupuestoInput[];
      if (items.length === 0) {
        return jsonResponse(400, { error: 'el lote de presupuestos no puede estar vacio' });
      }
      for (const item of items) {
        if (faltanCamposRequeridos(item)) {
          return jsonResponse(400, { error: 'faltan campos requeridos: pacienteId, obraSocialId, monto, fechaEmision' });
        }
      }

      const { data: ids, error } = await userClient
        .schema('facturacion')
        .rpc('crear_presupuestos_lote', {
          p_presupuestos: items.map((item) => ({
            ...toDb(item),
            // REAPERTURA #13: desglose por item DENTRO del lote (la firma de la RPC no cambio).
            ...(item.lineas !== undefined ? { lineas: toDbLineas(item.lineas) } : {}),
          })),
        });
      if (error) return jsonResponse(400, { error: error.message });

      const { data, error: errorSelect } = await userClient
        .schema('facturacion')
        .from('presupuesto')
        .select('*')
        .in('id', (ids as string[] | null) ?? []);
      if (errorSelect) return jsonResponse(400, { error: errorSelect.message });
      const rows = (data as PresupuestoRow[] | null) ?? [];
      const lineas = await lineasPorPresupuestoIds(userClient, rows.map((row) => row.id));
      return jsonResponse(201, rows.map((row) => toApi(row, lineas.get(row.id) ?? [])));
    }

    // Alta simple (modalidad general): un objeto dispara crear_presupuesto_completo.
    const single = body as PresupuestoInput;
    if (faltanCamposRequeridos(single)) {
      return jsonResponse(400, { error: 'faltan campos requeridos: pacienteId, obraSocialId, monto, fechaEmision' });
    }

    const { data: nuevoId, error } = await userClient
      .schema('facturacion')
      .rpc('crear_presupuesto_completo', {
        p_presupuesto: toDb(single),
        // REAPERTURA #13: desglose de modalidad `general` (parametro nuevo con DEFAULT NULL en la
        // RPC -- los llamadores viejos que no lo mandan siguen funcionando).
        ...(single.lineas !== undefined ? { p_lineas: toDbLineas(single.lineas) } : {}),
      });
    if (error) return jsonResponse(400, { error: error.message });

    const { data, error: errorSelect } = await userClient
      .schema('facturacion')
      .from('presupuesto')
      .select('*')
      .eq('id', nuevoId as string)
      .maybeSingle();
    if (errorSelect) return jsonResponse(400, { error: errorSelect.message });
    if (!data) return jsonResponse(404, { error: 'presupuesto no encontrado' });
    const lineas = await lineasPorPresupuestoIds(userClient, [(nuevoId as string)]);
    return jsonResponse(201, toApi(data as PresupuestoRow, lineas.get(nuevoId as string) ?? []));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del presupuesto en la URL' });
    let body: PresupuestoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await userClient
      .schema('facturacion')
      .from('presupuesto')
      .update(toDb(body))
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'presupuesto no encontrado' });
    const lineas = await lineasPorPresupuestoIds(userClient, [id]);
    return jsonResponse(200, toApi(data as PresupuestoRow, lineas.get(id) ?? []));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del presupuesto en la URL' });
    const { error } = await userClient.schema('facturacion').from('presupuesto').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
