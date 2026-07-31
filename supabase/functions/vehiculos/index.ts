// Edge Function: vehiculos
//
// CRUD de conductores.vehiculo, modulo 'conductores' (ver supabase/functions/_shared/auth.ts --
// el docx unifica Vehiculo/Accesorios/Documentacion/Mantenimiento bajo un unico modulo
// 'conductores', sin 'vehiculos' propio).
//
// `habilitaciones` (VTV/RTO) y `gastos` viajan embebidos en el body, igual que `asistencias` en
// facturas/index.ts -- reemplazo completo (delete+insert) en cada POST/PATCH que los incluya.
// `gastos` vive en `conductores.mantenimiento` con `categoria = 'gasto'` (decision confirmada:
// una unica tabla de intervenciones, no una tabla de gastos aparte) -- preventivo/correctivo se
// gestionan por separado en supabase/functions/mantenimiento/index.ts.
// `accesoriosCompatibles` resuelve contra el catalogo compartido `pacientes.accesorios` (mismo
// catalogo que usa pacientes-accesorios/index.ts) via 2 consultas (find, nunca create -- el
// catalogo es un conjunto cerrado de 5 valores, seedeado en 20260729140000_seed_accesorios.sql),
// porque el embedding de PostgREST no cruza schemas expuestos por separado.
// `kilometrajeUltimoService`/`fechaUltimoService` se derivan del ultimo registro `preventivo` de
// `mantenimiento` -- nunca se guardan como columna propia, para no tener 2 fuentes de verdad.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS, extractIdFromPath } from '../_shared/auth.ts';
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

// Modulo 'vehiculos' (no 'conductores'): split via 20260730140000_split_modulos_permisos.sql,
// que movio las RLS policies de vehiculo/accesorios_vehiculo/documentacion_vehiculo/
// mantenimiento/conductores_vehiculos a 'vehiculos'. Este check de permiso a nivel app debe
// coincidir siempre con el modulo real de la RLS de la tabla.
const MODULO = 'vehiculos';
const FUNCTION_NAME = 'vehiculos';

type EstadoDb = 'habilitado' | 'fuera de servicio';
type EstadoApi = 'habilitado' | 'fuera-de-servicio';
type TipoHabilitacion = 'vtv' | 'rto';
type CategoriaGasto = 'mantenimiento' | 'reparacion' | 'service';
type AccesorioMovilidad = 'silla-plegable' | 'silla-rigida' | 'silla-postural' | 'andador' | 'tripode';

function estadoToApi(estado: EstadoDb): EstadoApi {
  return estado === 'fuera de servicio' ? 'fuera-de-servicio' : 'habilitado';
}
function estadoToDb(estado: EstadoApi): EstadoDb {
  return estado === 'fuera-de-servicio' ? 'fuera de servicio' : 'habilitado';
}

interface HabilitacionRow {
  id: string;
  tipo: TipoHabilitacion;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
}
interface HabilitacionInput {
  tipo?: TipoHabilitacion;
  fechaEmision?: string;
  fechaVencimiento?: string;
}

interface MantenimientoRow {
  id: string;
  categoria: 'gasto' | 'preventivo' | 'correctivo';
  fecha: string;
  fecha_proximo_vencimiento: string | null;
  km_actual: number | null;
  km_proximo_vencimiento: number | null;
  monto: number | null;
  descripcion: string | null;
  categoria_gasto: CategoriaGasto | null;
}
interface GastoInput {
  fecha?: string;
  monto?: number;
  descripcion?: string;
  categoria?: CategoriaGasto;
}

interface VehiculoRow {
  id: string;
  patente: string;
  modelo: string | null;
  tipo: string | null;
  capacidad: number | null;
  estado: EstadoDb;
  kilometraje: number | null;
  habilitaciones_vehiculo?: HabilitacionRow[];
  mantenimiento?: MantenimientoRow[];
}

interface VehiculoInput {
  patente?: string;
  modelo?: string;
  tipo?: string;
  capacidad?: number;
  estado?: EstadoApi;
  kilometraje?: number;
  accesoriosCompatibles?: AccesorioMovilidad[];
  habilitaciones?: HabilitacionInput[];
  gastos?: GastoInput[];
}

const SELECT_COLUMNS = '*, habilitaciones_vehiculo(*), mantenimiento(*)';

function habilitacionToApi(row: HabilitacionRow) {
  return { tipo: row.tipo, fechaEmision: row.fecha_emision, fechaVencimiento: row.fecha_vencimiento };
}

function gastoToApi(row: MantenimientoRow) {
  return {
    id: row.id,
    fecha: row.fecha,
    monto: row.monto === null ? 0 : Number(row.monto),
    descripcion: row.descripcion ?? undefined,
    categoria: row.categoria_gasto ?? 'mantenimiento',
  };
}

async function resolveAccesorioIds(admin: SupabaseClient, tipos: AccesorioMovilidad[]): Promise<{ ids: string[] } | { error: string }> {
  if (tipos.length === 0) return { ids: [] };
  const { data, error } = await admin.schema('pacientes').from('accesorios').select('id, tipo').in('tipo', tipos);
  if (error) return { error: error.message };
  const found = data as { id: string; tipo: string }[];
  const missing = tipos.filter((t) => !found.some((f) => f.tipo === t));
  if (missing.length > 0) return { error: `accesorio(s) desconocido(s): ${missing.join(', ')}` };
  return { ids: found.map((f) => f.id) };
}

async function toApi(admin: SupabaseClient, row: VehiculoRow) {
  const preventivos = (row.mantenimiento ?? []).filter((m) => m.categoria === 'preventivo').sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const ultimoService = preventivos[0];

  const { data: accesoriosRows, error: accesoriosError } = await admin
    .schema('conductores')
    .from('accesorios_vehiculo')
    .select('accesorio_id')
    .eq('vehiculo_id', row.id);
  let accesoriosCompatibles: string[] = [];
  if (!accesoriosError && accesoriosRows && accesoriosRows.length > 0) {
    const ids = (accesoriosRows as { accesorio_id: string }[]).map((r) => r.accesorio_id);
    const { data: catalogo } = await admin.schema('pacientes').from('accesorios').select('id, tipo').in('id', ids);
    accesoriosCompatibles = ((catalogo as { id: string; tipo: string }[]) ?? []).map((c) => c.tipo);
  }

  return {
    id: row.id,
    patente: row.patente,
    modelo: row.modelo ?? '',
    tipo: row.tipo ?? '',
    capacidad: row.capacidad ?? 0,
    accesoriosCompatibles,
    estado: estadoToApi(row.estado),
    kilometraje: row.kilometraje ?? 0,
    kilometrajeUltimoService: ultimoService?.km_actual ?? 0,
    fechaUltimoService: ultimoService?.fecha ?? '',
    habilitaciones: (row.habilitaciones_vehiculo ?? []).map(habilitacionToApi),
    gastos: (row.mantenimiento ?? []).filter((m) => m.categoria === 'gasto').map(gastoToApi),
  };
}

function toDb(input: VehiculoInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.patente !== undefined) row.patente = input.patente;
  if (input.modelo !== undefined) row.modelo = input.modelo;
  if (input.tipo !== undefined) row.tipo = input.tipo;
  if (input.capacidad !== undefined) row.capacidad = input.capacidad;
  if (input.estado !== undefined) row.estado = estadoToDb(input.estado);
  if (input.kilometraje !== undefined) row.kilometraje = input.kilometraje;
  return row;
}

async function replaceHabilitaciones(admin: SupabaseClient, vehiculoId: string, habilitaciones: HabilitacionInput[]): Promise<string | null> {
  const { error: deleteError } = await admin.schema('conductores').from('habilitaciones_vehiculo').delete().eq('vehiculo_id', vehiculoId);
  if (deleteError) return deleteError.message;
  if (habilitaciones.length === 0) return null;
  const rows = habilitaciones.map((h) => ({
    vehiculo_id: vehiculoId,
    tipo: h.tipo,
    fecha_emision: h.fechaEmision,
    fecha_vencimiento: h.fechaVencimiento,
  }));
  const { error: insertError } = await admin.schema('conductores').from('habilitaciones_vehiculo').insert(rows);
  return insertError ? insertError.message : null;
}

async function replaceGastos(admin: SupabaseClient, vehiculoId: string, gastos: GastoInput[]): Promise<string | null> {
  const { error: deleteError } = await admin
    .schema('conductores')
    .from('mantenimiento')
    .delete()
    .eq('vehiculo_id', vehiculoId)
    .eq('categoria', 'gasto');
  if (deleteError) return deleteError.message;
  if (gastos.length === 0) return null;
  const rows = gastos.map((g) => ({
    vehiculo_id: vehiculoId,
    categoria: 'gasto',
    fecha: g.fecha,
    monto: g.monto,
    descripcion: g.descripcion,
    categoria_gasto: g.categoria,
  }));
  const { error: insertError } = await admin.schema('conductores').from('mantenimiento').insert(rows);
  return insertError ? insertError.message : null;
}

async function replaceAccesorios(admin: SupabaseClient, vehiculoId: string, tipos: AccesorioMovilidad[]): Promise<string | null> {
  const resolved = await resolveAccesorioIds(admin, tipos);
  if ('error' in resolved) return resolved.error;
  const { error: deleteError } = await admin.schema('conductores').from('accesorios_vehiculo').delete().eq('vehiculo_id', vehiculoId);
  if (deleteError) return deleteError.message;
  if (resolved.ids.length === 0) return null;
  const rows = resolved.ids.map((accesorioId) => ({ vehiculo_id: vehiculoId, accesorio_id: accesorioId }));
  const { error: insertError } = await admin.schema('conductores').from('accesorios_vehiculo').insert(rows);
  return insertError ? insertError.message : null;
}

async function refetch(admin: SupabaseClient, id: string) {
  return admin.schema('conductores').from('vehiculo').select(SELECT_COLUMNS).eq('id', id).single();
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
      const { data, error } = await admin.schema('conductores').from('vehiculo').select(SELECT_COLUMNS).eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'vehiculo no encontrado' });
      return jsonResponse(200, await toApi(admin, data as VehiculoRow));
    }
    const { data, error } = await admin.schema('conductores').from('vehiculo').select(SELECT_COLUMNS).order('patente');
    if (error) return jsonResponse(400, { error: error.message });
    const result = await Promise.all((data as VehiculoRow[]).map((row) => toApi(admin, row)));
    return jsonResponse(200, result);
  }

  if (req.method === 'POST') {
    let body: VehiculoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    if (!body.patente) {
      return jsonResponse(400, { error: 'falta el campo requerido: patente' });
    }
    const { data, error } = await admin.schema('conductores').from('vehiculo').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    const vehiculo = data as VehiculoRow;

    if (body.habilitaciones !== undefined) {
      const err = await replaceHabilitaciones(admin, vehiculo.id, body.habilitaciones);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.gastos !== undefined) {
      const err = await replaceGastos(admin, vehiculo.id, body.gastos);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.accesoriosCompatibles !== undefined) {
      const err = await replaceAccesorios(admin, vehiculo.id, body.accesoriosCompatibles);
      if (err) return jsonResponse(400, { error: err });
    }

    const { data: fresh, error: refetchError } = await refetch(admin, vehiculo.id);
    if (refetchError) return jsonResponse(400, { error: refetchError.message });
    return jsonResponse(201, await toApi(admin, fresh as VehiculoRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del vehiculo en la URL' });
    let body: VehiculoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    const { data, error } = await admin.schema('conductores').from('vehiculo').update(toDb(body)).eq('id', id).select('*').maybeSingle();
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'vehiculo no encontrado' });

    if (body.habilitaciones !== undefined) {
      const err = await replaceHabilitaciones(admin, id, body.habilitaciones);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.gastos !== undefined) {
      const err = await replaceGastos(admin, id, body.gastos);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.accesoriosCompatibles !== undefined) {
      const err = await replaceAccesorios(admin, id, body.accesoriosCompatibles);
      if (err) return jsonResponse(400, { error: err });
    }

    const { data: fresh, error: refetchError } = await refetch(admin, id);
    if (refetchError) return jsonResponse(400, { error: refetchError.message });
    return jsonResponse(200, await toApi(admin, fresh as VehiculoRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del vehiculo en la URL' });
    const { error } = await admin.schema('conductores').from('vehiculo').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
