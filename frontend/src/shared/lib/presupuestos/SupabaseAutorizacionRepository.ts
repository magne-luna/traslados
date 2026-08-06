import { supabase } from '../supabaseClient';
import type { AutorizacionRepository } from './AutorizacionRepository';
import { esErrorNotFound, mapearErrorEdgeFunction } from './edgeFunctionErrors';
import { parseAutorizacionApi, toActualizarAutorizacionPayload, toCrearAutorizacionPayload } from './autorizacionMapping';

// Implementación real de AutorizacionRepository (design.md D1/D2/D4/D7 del change
// `integracion-presupuestos`), mismo criterio que SupabasePresupuestoRepository.ts: toda la I/O
// pasa por la Edge Function `autorizaciones`, nunca PostgREST directo, y este archivo no consulta
// `modulos.permisos` ni `modulos.modulos` (el gateo real es del servidor, D3; verificado por test de
// código fuente, 3.10).

// Nadie lo importa todavía (tasks.md §3): el swap real ocurre en un único commit en la §4.

export const supabaseAutorizacionRepository: AutorizacionRepository = {
  async list() {
    const { data, error } = await supabase.functions.invoke('autorizaciones', { method: 'GET' });
    if (error) {
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'listar' });
    }

    const filas = Array.isArray(data) ? data : [];
    const autorizaciones = [];
    for (const fila of filas) {
      const parseada = parseAutorizacionApi(fila);
      if (parseada) autorizaciones.push(parseada);
    }
    return autorizaciones;
  },

  async getById(id) {
    const { data, error } = await supabase.functions.invoke(`autorizaciones/${id}`, { method: 'GET' });
    if (error) {
      if (esErrorNotFound(error)) return null;
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'obtener' });
    }
    return parseAutorizacionApi(data);
  },

  async getByPresupuestoId(presupuestoId) {
    // `presupuestoId` va como querystring, no como segmento de path (D4/nota de implementación):
    // percent-encoded para no romper la URL si algún día deja de ser un UUID limpio.
    const { data, error } = await supabase.functions.invoke(`autorizaciones?presupuestoId=${encodeURIComponent(presupuestoId)}`, {
      method: 'GET',
    });
    if (error) {
      // El 404 acá es el caso normal (todavía no hay autorización asociada), no un error — mismo
      // criterio que getById.
      if (esErrorNotFound(error)) return null;
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'obtener' });
    }
    return parseAutorizacionApi(data);
  },

  async create(nueva) {
    const { data, error } = await supabase.functions.invoke('autorizaciones', {
      method: 'POST',
      body: toCrearAutorizacionPayload(nueva),
    });
    if (error) {
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'crear' });
    }
    const creada = parseAutorizacionApi(data);
    if (!creada) throw new Error('No se pudo guardar la autorización.');
    return creada;
  },

  async update(id, cambios) {
    const { data, error } = await supabase.functions.invoke(`autorizaciones/${id}`, {
      method: 'PATCH',
      body: toActualizarAutorizacionPayload(cambios),
    });
    if (error) {
      // Asimetría con getById (mismo criterio que SupabasePresupuestoRepository.update, 3.7): acá
      // el 404 SÍ lanza, con el mismo mensaje que ya lanza mockAutorizacionRepository.update().
      throw await mapearErrorEdgeFunction(error, { entidad: 'autorizacion', operacion: 'actualizar', id });
    }
    const actualizada = parseAutorizacionApi(data);
    if (!actualizada) throw new Error('No se pudo guardar la autorización.');
    return actualizada;
  },
};
