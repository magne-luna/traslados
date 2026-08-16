import { supabase } from '../supabaseClient';
import type { TipoDocumentoFactura } from '../../types/tiposDocumento';
import type { CambiosTipoDocumento, TiposDocumentoRepository } from './TiposDocumentoRepository';

// Implementación real de TiposDocumentoRepository (RF-410, mismo patron que
// SupabaseCatalogoAccesoriosRepository). Lectura y escritura directas con RLS: la migración
// `20260816120000_tipos_documento_crud` amplió la policy de lectura de
// `facturacion.tipos_documento` (solo SELECT) al set completo gestionable con `facturacion: write`
// (INSERT/UPDATE/DELETE) y agregó el trigger de auditoría. Los errores UNIQUE (`23505`) y de
// permiso (`42501`) se traducen a mensajes accionables en castellano.

interface FakeErrorLike {
  code?: string;
  message: string;
}

const MSG_SIN_PERMISO = 'No tenés permiso para gestionar el catálogo de tipos de documento.';
const MSG_TIPO_DUPLICADO_BASE = 'Ya existe un tipo de documento con ese nombre: ';
const MSG_TIPO_INEXISTENTE = 'No existe ese tipo de documento en el catálogo.';
const MSG_ERROR_GENERICO = 'No se pudo guardar el tipo de documento.';

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la
 * UI (molde `mapearErrorCatalogo`). Identifica la unique de `tipo` por el nombre del constraint
 * (`tipos_documento_tipo_key`, autogenerado por el `UNIQUE` de `20260816100000`); el `42501` de
 * escritura cubre falta de permiso sobre `facturacion`. Nunca propaga `error.message` crudo. */
export function mapearErrorTipoDocumento(error: FakeErrorLike, contexto?: { tipo?: string }): Error {
  const codigo = error.code;

  if (codigo === '23505') {
    return new Error(`${MSG_TIPO_DUPLICADO_BASE}«${contexto?.tipo ?? 'ese nombre'}».`);
  }
  if (codigo === '23503') {
    return new Error(MSG_TIPO_INEXISTENTE);
  }
  if (codigo === '42501' || codigo === 'PGRST301') {
    return new Error(MSG_SIN_PERMISO);
  }
  if (codigo === 'PGRST106') {
    return new Error('El módulo de Facturación no está habilitado en el servidor.');
  }

  return new Error(MSG_ERROR_GENERICO);
}

/** Caché por sesión (módulo-scoped, misma instancia): evita refetch en cada re-render y permite
 * que el alta/edición inline se refleje sin esperar al servidor. Se invalida en cada escritura. */
let cacheActivos: Promise<TipoDocumentoFactura[]> | null = null;
let cacheTodos: Promise<TipoDocumentoFactura[]> | null = null;

function invalidarCaches(): void {
  cacheActivos = null;
  cacheTodos = null;
}

const ORDEN = { ascending: true } as const;

const COLUMNAS = 'id, tipo, requerido, activa';

interface FilaTipoDocumento {
  id: string;
  tipo: string;
  requerido: boolean;
  activa: boolean;
}

function esFilaTipoDocumento(value: unknown): value is FilaTipoDocumento {
  if (typeof value !== 'object' || value === null) return false;
  const fila = value as Record<string, unknown>;
  return (
    typeof fila.id === 'string' &&
    typeof fila.tipo === 'string' &&
    typeof fila.requerido === 'boolean' &&
    typeof fila.activa === 'boolean'
  );
}

function aTipoDocumentoFactura(filas: unknown): TipoDocumentoFactura[] {
  if (!Array.isArray(filas)) return [];
  return filas.flatMap((fila): TipoDocumentoFactura[] => {
    if (!esFilaTipoDocumento(fila)) return [];
    return [{ id: fila.id, tipo: fila.tipo, requerido: fila.requerido, activa: fila.activa }];
  });
}

// `soloActivas === true` filtra `activa = true` (checklist del detalle de factura); `undefined` no
// filtra, trae activos E inactivos (gestión del catálogo, para poder reactivar). Mismo molde que
// `leer` de SupabaseCatalogoAccesoriosRepository (incluido el gotcha del `boolean | undefined`).
async function leer(soloActivas: boolean | undefined): Promise<TipoDocumentoFactura[]> {
  let query = supabase.schema('facturacion').from('tipos_documento').select(COLUMNAS);
  if (soloActivas !== undefined) {
    query = query.eq('activa', soloActivas);
  }
  const { data, error } = await query.order('tipo', ORDEN);
  if (error) throw mapearErrorTipoDocumento(error);
  return aTipoDocumentoFactura(data);
}

export const SupabaseTiposDocumentoRepository: TiposDocumentoRepository = {
  listarActivos(): Promise<TipoDocumentoFactura[]> {
    cacheActivos ??= leer(true);
    return cacheActivos;
  },

  listarTodos(): Promise<TipoDocumentoFactura[]> {
    cacheTodos ??= leer(undefined);
    return cacheTodos;
  },

  async crear(tipo: string, requerido: boolean): Promise<TipoDocumentoFactura> {
    const { data, error } = await supabase
      .schema('facturacion')
      .from('tipos_documento')
      .insert({ tipo: tipo.trim(), requerido })
      .select(COLUMNAS)
      .single();
    if (error) throw mapearErrorTipoDocumento(error, { tipo });
    invalidarCaches();
    const fila = aTipoDocumentoFactura([data]);
    const tipoDocumento = fila[0];
    if (tipoDocumento === undefined) throw new Error(MSG_TIPO_INEXISTENTE);
    return tipoDocumento;
  },

  async editar(id: string, cambios: CambiosTipoDocumento): Promise<TipoDocumentoFactura> {
    const { data, error } = await supabase
      .schema('facturacion')
      .from('tipos_documento')
      .update(cambios)
      .eq('id', id)
      .select(COLUMNAS)
      .single();
    if (error) throw mapearErrorTipoDocumento(error, cambios.tipo !== undefined ? { tipo: cambios.tipo } : undefined);
    invalidarCaches();
    const fila = aTipoDocumentoFactura([data]);
    const tipoDocumento = fila[0];
    if (tipoDocumento === undefined) throw new Error(MSG_TIPO_INEXISTENTE);
    return tipoDocumento;
  },

  async desactivar(id: string): Promise<void> {
    const { error } = await supabase.schema('facturacion').from('tipos_documento').update({ activa: false }).eq('id', id);
    if (error) throw mapearErrorTipoDocumento(error);
    invalidarCaches();
  },

  async reactivar(id: string): Promise<void> {
    const { error } = await supabase.schema('facturacion').from('tipos_documento').update({ activa: true }).eq('id', id);
    if (error) throw mapearErrorTipoDocumento(error);
    invalidarCaches();
  },
};