import { supabase } from '../supabaseClient';
import type { ActualizacionConductor, Conductor, NuevoConductor } from '../../types/conductor';
import type { Pagina, RangoPagina } from '../../types/paginacion';
import type { ConductorRepository, FiltrosConductor } from './ConductorRepository';
import { ensamblarConductor, toActualizarConductorPayload, toCrearConductorPayload } from './conductorMapping';
import { construirFiltroBusqueda } from '../paginacion/construirFiltroBusqueda';
import { rangoSupabase } from '../paginacion/rangoSupabase';

// Implementación real de ConductorRepository (change integracion-conductores-vehiculos,
// design.md D9/D11/D12; tasks.md §7, desbloqueada por 1B.11). A diferencia de Vehículo (§5, que
// terminó llamando a la Edge Function `vehiculos` porque Enzo resolvió la atomicidad server-side),
// no existe ninguna Edge Function `conductores` en `supabase/functions/` (verificado, tasks.md
// §7) — este repository sigue el plan original de `tasks.md` §1B.8: PostgREST directo para
// lectura y las dos RPC `SECURITY INVOKER` de `20260811110000_conductores_rpc.sql` para
// escritura. Toda la traducción fila<->dominio vive en `conductorMapping.ts` (§6); acá solo hay
// I/O — armar la consulta, chequear `error`, y traducir el resultado a `Error` en castellano
// (D12), nunca `error.message` crudo.
//
// Lectura: un único `select` a `conductores.conductores` con el embed `conductores_vehiculos`
// (D11) — nunca N+1. Sin `vehiculos: read`, RLS filtra las filas del embed en silencio (no hay
// error que capturar: es la misma semántica que el resto de la serie, D10 caso 4) y
// `ensamblarConductor` ya degrada un embed vacío/ausente a `asignaciones: []` sin romper la
// lectura del conductor — el caso contra-intuitivo del change (la pantalla de Conductores
// necesita el permiso de Vehículos para su grilla de asignación semanal).
//
// Escritura: `create`/`update` llaman a las RPC `SECURITY INVOKER` (D9), que escriben las dos
// tablas en una sola transacción, y releen con `getById` después — lo devuelto siempre es lo que
// quedó realmente en la base.

const SELECT_CONDUCTOR_CON_ASIGNACIONES = `
  id, nombre, apellido, dni, cuil, telefono, fecha_nacimiento, domicilio, estado, notas,
  conductores_vehiculos ( id, vehiculo_id, fecha_init, fecha_fin_semana )
`;

// ---------------------------------------------------------------------------------------------
// Lectura (D11)
// ---------------------------------------------------------------------------------------------

async function listarConductores(): Promise<Conductor[]> {
  const { data, error } = await supabase
    .schema('conductores')
    .from('conductores')
    .select(SELECT_CONDUCTOR_CON_ASIGNACIONES);

  if (error) throw mapearErrorConductor(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  const conductores: Conductor[] = [];
  for (const row of rows) {
    const conductor = ensamblarConductor(row);
    if (conductor) conductores.push(conductor);
  }
  return conductores;
}

// paginacion-listados (design.md §D5, búsqueda simple sin checkpoint): mismas columnas que
// filtra `ConductoresList.tsx` hoy client-side (`apellido`, `nombre`, `documento`/dni, `cuil`).
const COLUMNAS_BUSQUEDA_CONDUCTOR = ['apellido', 'nombre', 'dni', 'cuil'] as const;

/** Página server-side con búsqueda (design.md §D3, ADITIVO — `listarConductores`/`list()` de
 * arriba no cambia). Orden total determinista con desempate por `id` (§D4). `count: 'exact'`
 * viaja en el mismo `select` y se propaga a `Pagina.total`, el universo filtrado. */
async function listarConductoresPagina(query: RangoPagina & { filtros: FiltrosConductor }): Promise<Pagina<Conductor>> {
  const { pagina, tamanio, filtros } = query;
  const { desde, hasta } = rangoSupabase({ pagina, tamanio });

  let consulta = supabase
    .schema('conductores')
    .from('conductores')
    .select(SELECT_CONDUCTOR_CON_ASIGNACIONES, { count: 'exact' })
    .order('apellido', { ascending: true })
    .order('nombre', { ascending: true })
    .order('id', { ascending: true })
    .range(desde, hasta);

  const filtro = construirFiltroBusqueda(filtros.busqueda, COLUMNAS_BUSQUEDA_CONDUCTOR);
  if (filtro) {
    for (const expresion of filtro.expresionesOr) {
      consulta = consulta.or(expresion);
    }
  }

  const { data, error, count } = await consulta;
  if (error) throw mapearErrorConductor(error, { operacion: 'listar' });

  const rows: unknown = data;
  const filasCrudas = Array.isArray(rows) ? rows : [];
  const items: Conductor[] = [];
  for (const row of filasCrudas) {
    const conductor = ensamblarConductor(row);
    if (conductor) items.push(conductor);
  }

  return { items, total: count ?? 0, pagina, tamanio };
}

async function getConductorPorId(id: string): Promise<Conductor | null> {
  const { data, error } = await supabase
    .schema('conductores')
    .from('conductores')
    .select(SELECT_CONDUCTOR_CON_ASIGNACIONES)
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapearErrorConductor(error, { operacion: 'listar' });
  // `data === null` cubre tanto "no existe" como "RLS filtró la fila" (contrato: nunca lanza).
  if (data === null || data === undefined) return null;

  return ensamblarConductor(data);
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores (D12) — siempre `Error` con mensaje en castellano, nunca texto crudo.
// ---------------------------------------------------------------------------------------------

interface FakeErrorLike {
  code?: string;
  message: string;
  details?: string;
}

type OperacionError = 'listar' | 'crear' | 'actualizar';

interface ContextoError {
  operacion: OperacionError;
  id?: string;
  documento?: string;
}

const MSG_ERROR_GENERICO_CARGA = 'No se pudo cargar el conductor.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar el conductor.';
const MSG_MODULO_NO_DISPONIBLE = 'El módulo de Conductores no está habilitado en el servidor.';
const MSG_GUARDADO_NO_HABILITADO = 'El guardado de conductores no está habilitado en el servidor todavía.';
const MSG_SIN_PERMISO_LECTURA = 'No tenés permiso para consultar conductores.';
const MSG_SIN_PERMISO_ESCRITURA_CONDUCTORES = 'No tenés permiso para modificar conductores.';
const MSG_SIN_PERMISO_ESCRITURA_VEHICULOS = 'No tenés permiso para modificar asignaciones de vehículos.';
const MSG_VEHICULO_INEXISTENTE = 'El vehículo seleccionado ya no existe.';
const MSG_COLISION_OTRO_VEHICULO = 'Ese conductor ya tiene otro vehículo asignado en esa semana.';
const MSG_COLISION_MISMO_VEHICULO = 'Ese conductor ya tiene ese vehículo asignado en esa semana.';

// Nombre real del constraint que garantiza la colisión semanal (D7 §Colisión, migración
// `20260811100000_conductores_vehiculos_colision_semanal.sql`) — no hay validación de colisión en
// la RPC (D9), la barrera es este `UNIQUE (conductor_id, fecha_init)` de la base.
const CONSTRAINT_COLISION_SEMANAL = 'uq_conductor_semana';
// Nombre por defecto que Postgres le da al `UNIQUE(conductor_id, vehiculo_id, fecha_init)` ya
// existente desde `20260724100006_schema_conductores.sql` (D12: el par exacto repetido).
const CONSTRAINT_MISMO_PAR = 'conductores_vehiculos_conductor_id_vehiculo_id_fecha_init_key';
// Nombre por defecto que Postgres le da al `dni TEXT NOT NULL UNIQUE` de `conductores.conductores`
// (`20260724100006_schema_conductores.sql`) — es el único `23505` que NO es de asignaciones; todo
// lo demás (incluido un nombre de constraint no reconocido) se trata como colisión de
// `conductores_vehiculos`, que es la única otra tabla escrita por estas RPC con un `UNIQUE`.
const CONSTRAINT_DNI = 'conductores_dni_key';

function msgConductorInexistente(id: string): string {
  return `No existe un conductor con id "${id}".`;
}

function msgDocumentoDuplicado(documento: string): string {
  return `Ya existe un conductor con el documento «${documento}».`;
}

/** El `23505` de `conductores_vehiculos` viaja con el nombre del constraint en `message`/`details`
 * (`duplicate key value violates unique constraint "…"`, D12) — los dos mensajes se parecen y se
 * confunden fácil («otro» vs. «ese»), por eso el nombre del constraint decide, no el orden de
 * llegada. Constraint no reconocido (nombre ausente o inesperado) -> fallback genérico. */
function mensajeColisionAsignacion(error: FakeErrorLike): string {
  const texto = `${error.message} ${error.details ?? ''}`;
  if (texto.includes(CONSTRAINT_COLISION_SEMANAL)) return MSG_COLISION_OTRO_VEHICULO;
  if (texto.includes(CONSTRAINT_MISMO_PAR)) return MSG_COLISION_MISMO_VEHICULO;
  return 'Ya existe una asignación así para ese conductor.';
}

/** Distingue si un `23505` de unicidad vino de `conductores.dni` o de `conductores_vehiculos`
 * (D12) por el nombre del constraint, no por conjetura de tabla. Solo `conductores_dni_key` es
 * `dni`; cualquier otro nombre (incluido uno no reconocido) es una colisión de asignaciones —
 * es la única otra tabla que estas RPC escriben con un `UNIQUE`. */
function mensajeUniqueViolation(error: FakeErrorLike, contexto: ContextoError): string {
  const texto = `${error.message} ${error.details ?? ''}`;
  if (texto.includes(CONSTRAINT_DNI)) return msgDocumentoDuplicado(contexto.documento ?? '');
  return mensajeColisionAsignacion(error);
}

/** El `42501` de RLS no distingue tabla por código, solo por el texto del mensaje de Postgres
 * (`new row violates row-level security policy for table "…"`, D12: `conductores` vs.
 * `vehiculos`, que en la base es la tabla `conductores_vehiculos`). Ambigüedad razonable
 * (mensaje sin ninguna tabla reconocible) degrada al mensaje de `conductores` — es el permiso
 * mínimo esperable para cualquier escritura de esta pantalla. */
function mensajePermisoEscritura(error: FakeErrorLike): string {
  if (error.message.includes('conductores_vehiculos')) return MSG_SIN_PERMISO_ESCRITURA_VEHICULOS;
  return MSG_SIN_PERMISO_ESCRITURA_CONDUCTORES;
}

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la UI
 * (D12). Nunca propaga `error.message` crudo ni nombres de tabla; un código desconocido degrada
 * al genérico de la operación. No existe `45205` (no hay validación de colisión en la RPC, D9). */
function mapearErrorConductor(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '23505') return new Error(mensajeUniqueViolation(error, contexto));
  if (codigo === '23503') return new Error(MSG_VEHICULO_INEXISTENTE);
  if (codigo === '45201') return new Error(MSG_ERROR_GENERICO_GUARDADO);
  if (codigo === '45202') return new Error(msgConductorInexistente(contexto.id ?? ''));
  if (codigo === 'PGRST202') return new Error(MSG_GUARDADO_NO_HABILITADO);
  if (codigo === 'PGRST204') return new Error(MSG_MODULO_NO_DISPONIBLE);
  if (codigo === 'PGRST106') return new Error(MSG_MODULO_NO_DISPONIBLE);
  if (codigo === '42501' || codigo === 'PGRST301') {
    return new Error(contexto.operacion === 'listar' ? MSG_SIN_PERMISO_LECTURA : mensajePermisoEscritura(error));
  }

  return new Error(contexto.operacion === 'listar' ? MSG_ERROR_GENERICO_CARGA : MSG_ERROR_GENERICO_GUARDADO);
}

// ---------------------------------------------------------------------------------------------
// Escritura atómica (D9) — una sola RPC por operación, relectura con `getById` después.
// ---------------------------------------------------------------------------------------------

async function crearConductor(data: NuevoConductor): Promise<Conductor> {
  const { data: nuevoId, error } = await supabase
    .schema('conductores')
    .rpc('crear_conductor_completo', { p_conductor: toCrearConductorPayload(data) });

  if (error) throw mapearErrorConductor(error, { operacion: 'crear', documento: data.documento });

  if (typeof nuevoId !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  // Simétrico con `update()` (D9): lo devuelto siempre es lo que quedó realmente en la base.
  const conductor = await getConductorPorId(nuevoId);
  if (!conductor) {
    throw new Error('No se pudo recuperar el conductor recién creado.');
  }
  return conductor;
}

async function actualizarConductor(id: string, data: ActualizacionConductor): Promise<Conductor> {
  const { data: resultado, error } = await supabase
    .schema('conductores')
    .rpc('actualizar_conductor_completo', { p_id: id, p_cambios: toActualizarConductorPayload(data) });

  if (error) throw mapearErrorConductor(error, { operacion: 'actualizar', id, documento: data.documento });

  if (typeof resultado !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  const conductor = await getConductorPorId(id);
  if (!conductor) {
    throw new Error('No se pudo recuperar el conductor actualizado.');
  }
  return conductor;
}

// ---------------------------------------------------------------------------------------------

export const supabaseConductorRepository: ConductorRepository = {
  list: listarConductores,
  listPage: listarConductoresPagina,
  getById: getConductorPorId,
  create: crearConductor,
  update: actualizarConductor,
};
