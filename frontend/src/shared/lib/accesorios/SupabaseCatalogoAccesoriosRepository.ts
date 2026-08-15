import { supabase } from '../supabaseClient';
import type { AccesorioCatalogo } from '../../types/catalogoAccesorios';
import type { CambiosAccesorio, CatalogoAccesoriosRepository } from './CatalogoAccesoriosRepository';

// Implementación real de CatalogoAccesoriosRepository (design.md D5, plan recortado de la
// usuaria: SIN RPC nueva, SIN Edge Function, un solo PR). Lectura y escritura directas con RLS:
// la policy de lectura de `pacientes.accesorios` fue ajustada por la migración
// `20260816090000_catalogo_accesorios_icono_activa` para cubrir a los módulos consumidores
// (pacientes/vehiculos/conductores); la escritura queda SOLO para `pacientes`. Los errores
// UNIQUE (`23505`) y de permiso (`42501`) se traducen a mensajes accionables en castellano.

interface FakeErrorLike {
  code?: string;
  message: string;
}

const MSG_SIN_PERMISO = 'No tenés permiso para gestionar el catálogo de accesorios.';
const MSG_ACCESORIO_DUPLICADO_BASE = 'Ya existe un accesorio con ese nombre: ';
const MSG_ACCESORIO_INEXISTENTE = 'No existe ese accesorio en el catálogo.';
const MSG_ERROR_GENERICO = 'No se pudo guardar el accesorio.';

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la
 * UI (molde `mapearErrorObraSocial`). Identifica la unique de `tipo` por el nombre del
 * constraint (`accesorios_tipo_unique`); el `42501` de escritura cubre falta de permiso sobre
 * `pacientes`. Nunca propaga `error.message` crudo. */
export function mapearErrorCatalogo(error: FakeErrorLike, contexto?: { tipo?: string }): Error {
  const codigo = error.code;

  if (codigo === '23505') {
    return new Error(`${MSG_ACCESORIO_DUPLICADO_BASE}«${contexto?.tipo ?? 'ese nombre'}».`);
  }
  if (codigo === '23503') {
    return new Error(MSG_ACCESORIO_INEXISTENTE);
  }
  if (codigo === '42501' || codigo === 'PGRST301') {
    return new Error(MSG_SIN_PERMISO);
  }
  if (codigo === 'PGRST106') {
    return new Error('El módulo de Accesorios no está habilitado en el servidor.');
  }

  return new Error(MSG_ERROR_GENERICO);
}

/** Caché por sesión (módulo-scoped, misma instancia): evita refetch en cada re-render y permite
 * que el alta inline se refleje sin esperar al servidor. Se invalida en cada escritura. */
let cacheActivos: Promise<AccesorioCatalogo[]> | null = null;
let cacheTodos: Promise<AccesorioCatalogo[]> | null = null;

function invalidarCaches(): void {
  cacheActivos = null;
  cacheTodos = null;
}

const ORDEN = { ascending: true } as const;

interface FilaAccesorio {
  id: string;
  tipo: string;
  descripcion?: string | null;
  icono: string;
  activa: boolean;
}

function esFilaAccesorio(value: unknown): value is FilaAccesorio {
  if (typeof value !== 'object' || value === null) return false;
  const fila = value as Record<string, unknown>;
  return (
    typeof fila.id === 'string' &&
    typeof fila.tipo === 'string' &&
    typeof fila.icono === 'string' &&
    typeof fila.activa === 'boolean'
  );
}

function aAccesorioCatalogo(filas: unknown): AccesorioCatalogo[] {
  if (!Array.isArray(filas)) return [];
  return filas.flatMap((fila): AccesorioCatalogo[] => {
    if (!esFilaAccesorio(fila)) return [];
    return [
      {
        id: fila.id,
        tipo: fila.tipo,
        descripcion: fila.descripcion ?? undefined,
        icono: fila.icono,
        activa: fila.activa,
      },
    ];
  });
}

// `soloActivas === true` filtra `activa = true` (selectores de asignación); `undefined` no
// filtra, trae activos E inactivos (gestión del catálogo, para poder reactivar). Antes esta
// función recibía un `boolean` sin la opción "sin filtro", y `listarTodos()` terminaba pidiendo
// `leer(false)` — es decir, filtraba por `activa = false` (solo inactivos) en vez de traer todo,
// dejando la lista vacía en cualquier base donde no hubiera accesorios desactivados.
async function leer(soloActivas: boolean | undefined): Promise<AccesorioCatalogo[]> {
  let query = supabase.schema('pacientes').from('accesorios').select('id, tipo, descripcion, icono, activa');
  if (soloActivas !== undefined) {
    query = query.eq('activa', soloActivas);
  }
  const { data, error } = await query.order('tipo', ORDEN);
  if (error) throw mapearErrorCatalogo(error);
  return aAccesorioCatalogo(data);
}

export const SupabaseCatalogoAccesoriosRepository: CatalogoAccesoriosRepository = {
  listarActivos(): Promise<AccesorioCatalogo[]> {
    cacheActivos ??= leer(true);
    return cacheActivos;
  },

  listarTodos(): Promise<AccesorioCatalogo[]> {
    cacheTodos ??= leer(undefined);
    return cacheTodos;
  },

  async crear(tipo: string, icono: string): Promise<AccesorioCatalogo> {
    const { data, error } = await supabase
      .schema('pacientes')
      .from('accesorios')
      .insert({ tipo: tipo.trim(), icono })
      .select('id, tipo, descripcion, icono, activa')
      .single();
    if (error) throw mapearErrorCatalogo(error, { tipo });
    invalidarCaches();
    const fila = aAccesorioCatalogo([data]);
    const accesorio = fila[0];
    if (accesorio === undefined) throw new Error(MSG_ACCESORIO_INEXISTENTE);
    return accesorio;
  },

  async editar(id: string, cambios: CambiosAccesorio): Promise<AccesorioCatalogo> {
    const { data, error } = await supabase
      .schema('pacientes')
      .from('accesorios')
      .update(cambios)
      .eq('id', id)
      .select('id, tipo, descripcion, icono, activa')
      .single();
    if (error) throw mapearErrorCatalogo(error, cambios.tipo !== undefined ? { tipo: cambios.tipo } : undefined);
    invalidarCaches();
    const fila = aAccesorioCatalogo([data]);
    const accesorio = fila[0];
    if (accesorio === undefined) throw new Error(MSG_ACCESORIO_INEXISTENTE);
    return accesorio;
  },

  async desactivar(id: string): Promise<void> {
    const { error } = await supabase.schema('pacientes').from('accesorios').update({ activa: false }).eq('id', id);
    if (error) throw mapearErrorCatalogo(error);
    invalidarCaches();
  },

  async reactivar(id: string): Promise<void> {
    const { error } = await supabase.schema('pacientes').from('accesorios').update({ activa: true }).eq('id', id);
    if (error) throw mapearErrorCatalogo(error);
    invalidarCaches();
  },
};