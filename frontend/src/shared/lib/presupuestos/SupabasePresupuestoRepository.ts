import { supabase } from '../supabaseClient';
import type { PresupuestoRepository } from './PresupuestoRepository';
import { esErrorNotFound, mapearErrorEdgeFunction } from './edgeFunctionErrors';
import { parsePresupuestoApi, toActualizarPresupuestoPayload, toCrearPresupuestoPayload } from './presupuestoMapping';

// Implementación real de PresupuestoRepository (design.md D1/D2/D7 del change
// `integracion-presupuestos`): toda la I/O pasa por la Edge Function `presupuestos`
// (`supabase.functions.invoke`), nunca PostgREST directo — a diferencia de los repositories de
// pacientes/obras sociales/vehículos, acá el gateo de autorización vive del lado del servidor
// (`requirePermiso('presupuestos', …)`, D3) y este archivo no lo duplica: no consulta
// `modulos.permisos` ni `modulos.modulos` (verificado por test de código fuente, 3.10).
//
// El contrato de referencia es el `toApi()`/`toDb()` real de
// `supabase/functions/presupuestos/index.ts` (tasks.md 1.1) — los mapeos puros de
// `presupuestoMapping.ts` (sección 2) ya lo respetan, este archivo solo agrega la capa de I/O.

// Nadie lo importa todavía (tasks.md §3): el swap real ocurre en un único commit en la §4.

/** `id`s van en la URL sin percent-encode explícito: son UUIDs (sin caracteres reservados), y
 * `encodeURIComponent` sobre un UUID es un no-op. */
export const supabasePresupuestoRepository: PresupuestoRepository = {
  async list() {
    const { data, error } = await supabase.functions.invoke('presupuestos', { method: 'GET' });
    if (error) {
      throw await mapearErrorEdgeFunction(error, { entidad: 'presupuesto', operacion: 'listar' });
    }

    const filas = Array.isArray(data) ? data : [];
    const presupuestos = [];
    for (const fila of filas) {
      const parseado = parsePresupuestoApi(fila);
      if (parseado) presupuestos.push(parseado);
    }
    return presupuestos;
  },

  async getById(id) {
    const { data, error } = await supabase.functions.invoke(`presupuestos/${id}`, { method: 'GET' });
    if (error) {
      if (esErrorNotFound(error)) return null;
      throw await mapearErrorEdgeFunction(error, { entidad: 'presupuesto', operacion: 'obtener' });
    }
    return parsePresupuestoApi(data);
  },

  async create(nuevo) {
    const { data, error } = await supabase.functions.invoke('presupuestos', {
      method: 'POST',
      body: toCrearPresupuestoPayload(nuevo),
    });
    if (error) {
      throw await mapearErrorEdgeFunction(error, { entidad: 'presupuesto', operacion: 'crear' });
    }
    const creado = parsePresupuestoApi(data);
    if (!creado) throw new Error('No se pudo guardar el presupuesto.');
    return creado;
  },

  async update(id, cambios) {
    const { data, error } = await supabase.functions.invoke(`presupuestos/${id}`, {
      method: 'PATCH',
      body: toActualizarPresupuestoPayload(cambios),
    });
    if (error) {
      // A diferencia de getById (3.5), acá el 404 SÍ lanza — con el mismo mensaje que ya lanza
      // `mockPresupuestoRepository.update()`, contrato que la feature ya asume (tasks.md 3.7).
      throw await mapearErrorEdgeFunction(error, { entidad: 'presupuesto', operacion: 'actualizar', id });
    }
    const actualizado = parsePresupuestoApi(data);
    if (!actualizado) throw new Error('No se pudo guardar el presupuesto.');
    return actualizado;
  },
};
