import { supabase } from '../supabaseClient';
import type { AccesorioMovilidad, ActualizacionVehiculo, MantenimientoRegistro, NuevoVehiculo } from '../../types/vehiculo';
import type { VehiculoRepository } from './VehiculoRepository';
import { esErrorNotFound, mapearErrorVehiculo } from './edgeFunctionErrors';
import { ensamblarVehiculo, toGastoRows, toMantenimientoRows, type GastoRowInput, type MantenimientoRowInput } from './vehiculoMapping';

// Implementación real de VehiculoRepository, contra la Edge Function `vehiculos`
// (`supabase/functions/vehiculos/index.ts`) vía `supabase.functions.invoke` — mismo patrón que
// `SupabasePresupuestoRepository.ts`. NO es el plan original de `tasks.md` §5 de
// `integracion-conductores-vehiculos` (RPCs `SECURITY INVOKER` sobre PostgREST directo): ese plan
// quedó SUPERSEDED por el backend real que ya escribió Enzo (ver `vehiculoMapping.ts`, cabecera y
// nota 4B). `ensamblarVehiculo`/`toGastoRows` (D1-D5, D9-D13 reconciliados) son la única capa de
// mapeo — acá solo hay I/O y el armado del payload de escritura, que sí es nuevo (ninguna función
// de `vehiculoMapping.ts` construye el body real que esta Edge Function acepta).

/** `MantenimientoRowInput` sin `id`: mismo criterio que `GastoRowInput` (`toGastoRows`) — la
 * colección se reemplaza entera (delete+insert) en `replaceMantenimientos()` del lado del
 * servidor, así que el `id` que traía el registro es un detalle de identidad del dominio/UI, no
 * algo que haya que reenviar (se regenera en cada guardado, tal como ya pasa con los gastos). */
function toMantenimientoInput(mantenimientos: MantenimientoRegistro[]): Omit<MantenimientoRowInput, 'id'>[] {
  return toMantenimientoRows(mantenimientos).map(({ id: _id, ...resto }) => resto);
}

/** Body real de POST/PATCH `vehiculos` (`VehiculoInput` en `vehiculos/index.ts`). Distinto del
 * `CrearVehiculoPayload` de `vehiculoMapping.ts` (ese apunta a la RPC `crear_vehiculo_completo`,
 * que nunca se escribió): la clave es `accesoriosCompatibles`, no `accesorios`; `mantenimientos`
 * viaja snake_case (`toMantenimientoRows()`, ya escrito para el plan de RPC pero con el mismo
 * shape que terminó aceptando la Edge Function real — ver cabecera de `vehiculos/index.ts`, cierre
 * del gap "4B.4" el 2026-08-10); `estado` va en formato de dominio (`'habilitado' |
 * 'fuera-de-servicio'`), la Edge Function hace su propia conversión a la forma de base
 * (`estadoToDb()`) — convertirlo acá con `toEstadoVehiculoRow` antes de enviarlo rompería
 * silenciosamente cualquier alta/edición a "fuera de servicio" (la Edge Function no reconocería
 * `'fuera de servicio'` con espacio como su propio `'fuera-de-servicio'` con guion, y degradaría a
 * `'habilitado'`). `notas` NO viaja: la Edge Function real ni la lee (`toDb()`) ni la expone en la
 * respuesta (`toApi()`) — gap distinto al de mantenimientos, sin resolver, no documentado en
 * design.md D9/D11; se deja fuera del payload en vez de mandarla para que no parezca que se
 * persiste. */
interface VehiculoInputPayload {
  patente: string;
  modelo: string;
  tipo: string;
  capacidad: number;
  estado: string;
  kilometraje: number;
  accesoriosCompatibles: AccesorioMovilidad[];
  gastos: GastoRowInput[];
  mantenimientos: Omit<MantenimientoRowInput, 'id'>[];
}

function toCrearVehiculoInput(nuevo: NuevoVehiculo): VehiculoInputPayload {
  return {
    patente: nuevo.patente,
    modelo: nuevo.modelo,
    tipo: nuevo.tipo,
    capacidad: nuevo.capacidad,
    estado: nuevo.estado,
    kilometraje: nuevo.kilometraje,
    accesoriosCompatibles: nuevo.accesoriosCompatibles,
    gastos: toGastoRows(nuevo.gastos),
    mantenimientos: toMantenimientoInput(nuevo.mantenimientos),
  };
}

/** Semántica parcial (misma trampa que `toActualizarVehiculoPayload`, D9): una clave ausente en
 * `cambios` no debe aparecer en el body — la Edge Function la interpreta como "no tocar" vía
 * `if (input.x !== undefined)` en `toDb()`/los `replace*`. */
function toActualizarVehiculoInput(cambios: ActualizacionVehiculo): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  if (cambios.patente !== undefined) payload.patente = cambios.patente;
  if (cambios.modelo !== undefined) payload.modelo = cambios.modelo;
  if (cambios.tipo !== undefined) payload.tipo = cambios.tipo;
  if (cambios.capacidad !== undefined) payload.capacidad = cambios.capacidad;
  if (cambios.estado !== undefined) payload.estado = cambios.estado;
  if (cambios.kilometraje !== undefined) payload.kilometraje = cambios.kilometraje;
  if (cambios.accesoriosCompatibles !== undefined) payload.accesoriosCompatibles = cambios.accesoriosCompatibles;
  if (cambios.gastos !== undefined) payload.gastos = toGastoRows(cambios.gastos);
  if (cambios.mantenimientos !== undefined) payload.mantenimientos = toMantenimientoInput(cambios.mantenimientos);
  return payload;
}

export const supabaseVehiculoRepository: VehiculoRepository = {
  async list() {
    const { data, error } = await supabase.functions.invoke('vehiculos', { method: 'GET' });
    if (error) throw await mapearErrorVehiculo(error, { operacion: 'listar' });

    const filas = Array.isArray(data) ? data : [];
    const vehiculos = [];
    for (const fila of filas) {
      const vehiculo = ensamblarVehiculo(fila);
      if (vehiculo) vehiculos.push(vehiculo);
    }
    return vehiculos;
  },

  async getById(id) {
    const { data, error } = await supabase.functions.invoke(`vehiculos/${id}`, { method: 'GET' });
    if (error) {
      if (esErrorNotFound(error)) return null;
      throw await mapearErrorVehiculo(error, { operacion: 'obtener' });
    }
    return ensamblarVehiculo(data);
  },

  async create(nuevo) {
    const { data, error } = await supabase.functions.invoke('vehiculos', {
      method: 'POST',
      body: toCrearVehiculoInput(nuevo),
    });
    if (error) throw await mapearErrorVehiculo(error, { operacion: 'crear' });
    const creado = ensamblarVehiculo(data);
    if (!creado) throw new Error('No se pudo guardar el vehículo.');
    return creado;
  },

  async update(id, cambios) {
    const body = toActualizarVehiculoInput(cambios);

    // Bug real encontrado en vivo (2026-08-10, ver historial de esta función): si `cambios` solo
    // toca una clave que esta función no traduce a ninguna columna/colección real (`notas` es el
    // caso que queda hoy — `mantenimientos` se resolvió el mismo día), el body arma `{}`. Postgres,
    // ante un UPDATE sin columnas para setear, devuelve 0 filas — la Edge Function lo interpreta
    // como "vehiculo no encontrado" (404) y el vehículo, que existe perfecto, parece haber
    // desaparecido. Cortar acá con un mensaje honesto es mejor que dejar que ese 404 engañoso
    // llegue a la UI. `cambios` vacío (`{}`, un no-op real) sigue su curso normal — no es este caso.
    if (Object.keys(body).length === 0 && Object.keys(cambios).length > 0) {
      throw new Error('Este cambio todavía no se puede guardar contra el servidor real (ej. historial de mantenimiento).');
    }

    const { data, error } = await supabase.functions.invoke(`vehiculos/${id}`, { method: 'PATCH', body });
    if (error) throw await mapearErrorVehiculo(error, { operacion: 'actualizar', id });
    const actualizado = ensamblarVehiculo(data);
    if (!actualizado) throw new Error('No se pudo guardar el vehículo.');
    return actualizado;
  },
};
