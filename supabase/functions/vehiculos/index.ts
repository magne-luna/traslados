// Edge Function: vehiculos
//
// CRUD de conductores.vehiculo, modulo 'conductores' (ver supabase/functions/_shared/auth.ts --
// el docx unifica Vehiculo/Accesorios/Documentacion/Mantenimiento bajo un unico modulo
// 'conductores', sin 'vehiculos' propio).
//
// `habilitaciones`, `gastos` y `mantenimientos` (agregado 2026-08-10, cierra el gap "4B.4" de
// integracion-conductores-vehiculos) viajan embebidos en el body, igual que `asistencias` en
// facturas/index.ts -- reemplazo completo (delete+insert) en cada POST/PATCH que los incluya.
// `gastos` y `mantenimientos` viven en la MISMA tabla `conductores.mantenimiento`
// (decision confirmada: una unica tabla de intervenciones, discriminada por `categoria`) --
// `gasto` para uno, `preventivo`/`correctivo` para el otro; `replaceGastos`/`replaceMantenimientos`
// se pisan solo su propio subconjunto de filas (`categoria = 'gasto'` vs `categoria <> 'gasto'`),
// nunca el ajeno. El shape de `MantenimientoInput` es snake_case (columnas de la tabla tal cual),
// NO camelCase como el resto de esta API -- deliberado: coincide con `toMantenimientoRows()` de
// `frontend/src/shared/lib/vehiculos/vehiculoMapping.ts` (§4.4, ya escrito y testeado contra el
// plan original de RPC, cuyo jsonb ya usaba este mismo shape) y con el embed crudo que
// `ensamblarVehiculo()` (§4.7-4.8) ya sabe leer desde `record.mantenimiento` -- reusar esos dos
// evita reescribir codigo ya probado en ambas puntas.
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
  subtipo: string | null;
  detalle: string | null;
}
interface GastoInput {
  fecha?: string;
  monto?: number;
  descripcion?: string;
  categoria?: CategoriaGasto;
}

// Shape snake_case a propósito, ver cabecera del archivo: coincide con
// `MantenimientoRowInput`/`toMantenimientoRows()` de `vehiculoMapping.ts`. `categoria` solo admite
// 'preventivo'/'correctivo' acá (nunca 'gasto' -- eso es `GastoInput`, tabla compartida pero
// colección separada del lado del dominio).
interface MantenimientoInput {
  categoria?: 'preventivo' | 'correctivo';
  subtipo?: string | null;
  detalle?: string | null;
  descripcion?: string | null;
  fecha?: string;
  km_actual?: number | null;
  fecha_proximo_vencimiento?: string | null;
  km_proximo_vencimiento?: number | null;
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
  mantenimientos?: MantenimientoInput[];
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

// `userClient` cubre la lectura de conductores.accesorios_vehiculo (modulo 'vehiculos', ya
// verificado por requirePermiso). `admin` queda solo para el catalogo compartido
// pacientes.accesorios -- modulo 'pacientes', nunca verificado en esta request.
async function toApi(admin: SupabaseClient, userClient: SupabaseClient, row: VehiculoRow) {
  const preventivos = (row.mantenimiento ?? []).filter((m) => m.categoria === 'preventivo').sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  const ultimoService = preventivos[0];

  const { data: accesoriosRows, error: accesoriosError } = await userClient
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
    // Clave singular `mantenimiento` (no `mantenimientos`), a propósito: coincide con el nombre
    // del embed de PostgREST y con lo que `ensamblarVehiculo()`/`parseMantenimientoRow()` de
    // `vehiculoMapping.ts` ya leen desde `record.mantenimiento` -- filas crudas (snake_case), sin
    // traducir a camelCase como el resto de esta respuesta (mismo motivo que `MantenimientoInput`
    // en la escritura, ver cabecera del archivo).
    mantenimiento: (row.mantenimiento ?? []).filter((m) => m.categoria !== 'gasto'),
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

// Ambas reciben userClient -- conductores.habilitaciones_vehiculo y conductores.mantenimiento
// estan cubiertas por el mismo modulo 'vehiculos' que ya verifico requirePermiso() para este
// request.
async function replaceHabilitaciones(userClient: SupabaseClient, vehiculoId: string, habilitaciones: HabilitacionInput[]): Promise<string | null> {
  const { error: deleteError } = await userClient.schema('conductores').from('habilitaciones_vehiculo').delete().eq('vehiculo_id', vehiculoId);
  if (deleteError) return deleteError.message;
  if (habilitaciones.length === 0) return null;
  const rows = habilitaciones.map((h) => ({
    vehiculo_id: vehiculoId,
    tipo: h.tipo,
    fecha_emision: h.fechaEmision,
    fecha_vencimiento: h.fechaVencimiento,
  }));
  const { error: insertError } = await userClient.schema('conductores').from('habilitaciones_vehiculo').insert(rows);
  return insertError ? insertError.message : null;
}

async function replaceGastos(userClient: SupabaseClient, vehiculoId: string, gastos: GastoInput[]): Promise<string | null> {
  const { error: deleteError } = await userClient
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
  const { error: insertError } = await userClient.schema('conductores').from('mantenimiento').insert(rows);
  return insertError ? insertError.message : null;
}

// `.neq('categoria', 'gasto')` en el delete (simétrico al `.eq('categoria', 'gasto')` de
// `replaceGastos`): cada función pisa solo su propio subconjunto de filas de la misma tabla,
// nunca el ajeno.
async function replaceMantenimientos(userClient: SupabaseClient, vehiculoId: string, mantenimientos: MantenimientoInput[]): Promise<string | null> {
  const { error: deleteError } = await userClient
    .schema('conductores')
    .from('mantenimiento')
    .delete()
    .eq('vehiculo_id', vehiculoId)
    .neq('categoria', 'gasto');
  if (deleteError) return deleteError.message;
  if (mantenimientos.length === 0) return null;
  const rows = mantenimientos.map((m) => ({
    vehiculo_id: vehiculoId,
    categoria: m.categoria,
    subtipo: m.subtipo ?? null,
    detalle: m.detalle ?? null,
    descripcion: m.descripcion ?? null,
    fecha: m.fecha,
    km_actual: m.km_actual ?? null,
    fecha_proximo_vencimiento: m.fecha_proximo_vencimiento ?? null,
    km_proximo_vencimiento: m.km_proximo_vencimiento ?? null,
  }));
  const { error: insertError } = await userClient.schema('conductores').from('mantenimiento').insert(rows);
  return insertError ? insertError.message : null;
}

// `admin` se usa solo para resolver el catalogo compartido pacientes.accesorios -- ese modulo
// ('pacientes') nunca se verifico en esta request (requirePermiso solo chequeo 'vehiculos'), asi
// que esa lectura no puede pasar a userClient. El delete/insert de conductores.accesorios_vehiculo
// si esta cubierto por el modulo 'vehiculos' ya verificado, por eso recibe un cliente aparte.
async function replaceAccesorios(
  admin: SupabaseClient,
  userClient: SupabaseClient,
  vehiculoId: string,
  tipos: AccesorioMovilidad[],
): Promise<string | null> {
  const resolved = await resolveAccesorioIds(admin, tipos);
  if ('error' in resolved) return resolved.error;
  const { error: deleteError } = await userClient.schema('conductores').from('accesorios_vehiculo').delete().eq('vehiculo_id', vehiculoId);
  if (deleteError) return deleteError.message;
  if (resolved.ids.length === 0) return null;
  const rows = resolved.ids.map((accesorioId) => ({ vehiculo_id: vehiculoId, accesorio_id: accesorioId }));
  const { error: insertError } = await userClient.schema('conductores').from('accesorios_vehiculo').insert(rows);
  return insertError ? insertError.message : null;
}

async function refetch(userClient: SupabaseClient, id: string) {
  return userClient.schema('conductores').from('vehiculo').select(SELECT_COLUMNS).eq('id', id).single();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const id = extractIdFromPath(req, FUNCTION_NAME);
  const nivel = req.method === 'GET' ? 'read' : 'write';

  const ctx = await requirePermiso(req, MODULO, nivel);
  if (!isAuthorized(ctx)) return ctx;
  const { admin, userClient } = ctx;

  if (req.method === 'GET') {
    if (id) {
      const { data, error } = await userClient.schema('conductores').from('vehiculo').select(SELECT_COLUMNS).eq('id', id).maybeSingle();
      if (error) return jsonResponse(400, { error: error.message });
      if (!data) return jsonResponse(404, { error: 'vehiculo no encontrado' });
      return jsonResponse(200, await toApi(admin, userClient, data as VehiculoRow));
    }
    const { data, error } = await userClient.schema('conductores').from('vehiculo').select(SELECT_COLUMNS).order('patente');
    if (error) return jsonResponse(400, { error: error.message });
    const result = await Promise.all((data as VehiculoRow[]).map((row) => toApi(admin, userClient, row)));
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
    const { data, error } = await userClient.schema('conductores').from('vehiculo').insert(toDb(body)).select('*').single();
    if (error) return jsonResponse(400, { error: error.message });
    const vehiculo = data as VehiculoRow;

    if (body.habilitaciones !== undefined) {
      const err = await replaceHabilitaciones(userClient, vehiculo.id, body.habilitaciones);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.gastos !== undefined) {
      const err = await replaceGastos(userClient, vehiculo.id, body.gastos);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.mantenimientos !== undefined) {
      const err = await replaceMantenimientos(userClient, vehiculo.id, body.mantenimientos);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.accesoriosCompatibles !== undefined) {
      const err = await replaceAccesorios(admin, userClient, vehiculo.id, body.accesoriosCompatibles);
      if (err) return jsonResponse(400, { error: err });
    }

    const { data: fresh, error: refetchError } = await refetch(userClient, vehiculo.id);
    if (refetchError) return jsonResponse(400, { error: refetchError.message });
    return jsonResponse(201, await toApi(admin, userClient, fresh as VehiculoRow));
  }

  if (req.method === 'PATCH') {
    if (!id) return jsonResponse(400, { error: 'falta el id del vehiculo en la URL' });
    let body: VehiculoInput;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'body invalido, se espera JSON' });
    }
    // Bug real encontrado en vivo (2026-08-10): `toDb(body)` solo traduce columnas propias de
    // `vehiculo` (patente/modelo/tipo/capacidad/estado/kilometraje) -- `habilitaciones`, `gastos`,
    // `mantenimientos` y `accesoriosCompatibles` viven en otras tablas y las manejan los `replace*`
    // de abajo, nunca `toDb()`. Un PATCH que solo toca una de esas colecciones (ej. agregar un
    // mantenimiento) produce `toDb(body) === {}` -- Postgres, ante un `.update({})`, no devuelve
    // ninguna fila, y eso se leía como "vehiculo no encontrado" (404) para un vehículo que existía
    // perfecto. Si no hay columnas propias que tocar, alcanza con un `select` para confirmar que el
    // id existe -- nunca se manda un `.update({})` vacío.
    const camposPropios = toDb(body);
    const consultaBase =
      Object.keys(camposPropios).length > 0
        ? userClient.schema('conductores').from('vehiculo').update(camposPropios).eq('id', id).select('*').maybeSingle()
        : userClient.schema('conductores').from('vehiculo').select('*').eq('id', id).maybeSingle();
    const { data, error } = await consultaBase;
    if (error) return jsonResponse(400, { error: error.message });
    if (!data) return jsonResponse(404, { error: 'vehiculo no encontrado' });

    if (body.habilitaciones !== undefined) {
      const err = await replaceHabilitaciones(userClient, id, body.habilitaciones);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.gastos !== undefined) {
      const err = await replaceGastos(userClient, id, body.gastos);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.mantenimientos !== undefined) {
      const err = await replaceMantenimientos(userClient, id, body.mantenimientos);
      if (err) return jsonResponse(400, { error: err });
    }
    if (body.accesoriosCompatibles !== undefined) {
      const err = await replaceAccesorios(admin, userClient, id, body.accesoriosCompatibles);
      if (err) return jsonResponse(400, { error: err });
    }

    const { data: fresh, error: refetchError } = await refetch(userClient, id);
    if (refetchError) return jsonResponse(400, { error: refetchError.message });
    return jsonResponse(200, await toApi(admin, userClient, fresh as VehiculoRow));
  }

  if (req.method === 'DELETE') {
    if (!id) return jsonResponse(400, { error: 'falta el id del vehiculo en la URL' });
    const { error } = await userClient.schema('conductores').from('vehiculo').delete().eq('id', id);
    if (error) return jsonResponse(400, { error: error.message });
    return jsonResponse(204, null);
  }

  return jsonResponse(405, { error: 'metodo no soportado' });
});
