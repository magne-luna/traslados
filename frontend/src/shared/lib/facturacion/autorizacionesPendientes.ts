import type { Autorizacion, Presupuesto } from '../../types/presupuesto';
import type { PresupuestoRepository } from '../presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../presupuestos/AutorizacionRepository';

// Derivación client-side de "autorizaciones pendientes de facturar" (design.md D3 de
// `facturacion-seleccion-autorizacion`, tasks.md 2.6, capability `factura-autorizacion-seleccion`):
// insumo del selector del Paso 2 del wizard (D4, sección 3 — todavía no consumida acá).
//
// Reusa, sin agregar costo nuevo, el mismo patrón O(N) que ya paga
// `useEmisionFactura.ts` -> `resolverCupoAutorizado` (`presupuestoRepository.list()` filtrado por
// `pacienteId` + N x `autorizacionRepository.getByPresupuestoId()`): `Autorizacion` no tiene
// `pacienteId` propio (solo `presupuestoId`), y ningún repository expone `listByPacienteId` — crear
// uno tocaría dos interfaces, dos mocks y dos implementaciones Supabase para un dato ya alcanzable.
//
// "Pendiente" = `estado === 'autorizada' || estado === 'judicializada'` (corrección confirmada por
// la usuaria 2026-08-15: una autorización judicializada sigue habilitando la facturación mientras
// se resuelve el litigio), excluyendo explícitamente `'pendiente'` y `'rechazada'`. SIN filtrar por
// mes ya facturado (asunción de negocio explícita, confirmada con la usuaria — riesgo aceptado, no
// garantía del sistema): esta función NO recibe `facturasExistentes` ni ningún parámetro de
// período, a propósito.

export interface AutorizacionPendiente {
  autorizacion: Autorizacion;
  presupuesto: Presupuesto;
}

export async function autorizacionesPendientes(
  pacienteId: string,
  presupuestoRepository: PresupuestoRepository,
  autorizacionRepository: AutorizacionRepository,
): Promise<AutorizacionPendiente[]> {
  const presupuestos = await presupuestoRepository.list();
  const propios = presupuestos.filter((p) => p.pacienteId === pacienteId);

  const pendientes: AutorizacionPendiente[] = [];
  for (const presupuesto of propios) {
    const autorizacion = await autorizacionRepository.getByPresupuestoId(presupuesto.id);
    if (autorizacion !== null && (autorizacion.estado === 'autorizada' || autorizacion.estado === 'judicializada')) {
      pendientes.push({ autorizacion, presupuesto });
    }
  }

  return pendientes;
}
