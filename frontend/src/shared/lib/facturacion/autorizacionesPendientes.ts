import type { Autorizacion, Presupuesto } from '../../types/presupuesto';
import type { PresupuestoRepository } from '../presupuestos/PresupuestoRepository';
import type { AutorizacionRepository } from '../presupuestos/AutorizacionRepository';

// Derivación client-side de "autorizaciones pendientes de facturar" (design.md D3 de
// `facturacion-seleccion-autorizacion`, tasks.md 2.6, capability `factura-autorizacion-seleccion`):
// insumo del selector del Paso 2 del wizard (D4, sección 3 — todavía no consumida acá).
//
// Reusa, sin agregar costo nuevo, el mismo patrón O(N) que ya paga
// `useEmisionFactura.ts` -> `resolverCupoAutorizado` (`presupuestoRepository.list()` filtrado por
// `pacienteId` + N x `autorizacionRepository.listByPresupuestoId()`): `Autorizacion` no tiene
// `pacienteId` propio (solo `presupuestoId`), y ningún repository expone `listByPacienteId` — crear
// uno tocaría dos interfaces, dos mocks y dos implementaciones Supabase para un dato ya alcanzable.
//
// "Pendiente" = `estado === 'autorizada' || estado === 'judicializada'` (corrección confirmada por
// la usuaria 2026-08-15: una autorización judicializada sigue habilitando la facturación mientras
// se resuelve el litigio), excluyendo explícitamente `'pendiente'` y `'rechazada'`. SIN filtrar por
// mes ya facturado (asunción de negocio explícita, confirmada con la usuaria — riesgo aceptado, no
// garantía del sistema): esta función NO recibe `facturasExistentes` ni ningún parámetro de
// período, a propósito.
//
// ⚠️ `autorizacion-mensual` (design.md D5, tasks.md Fase 4/4.5): `getByPresupuestoId` (1 fila o
// `null`) se reemplaza por `listByPresupuestoId` (N filas por mes). Adaptación MÍNIMA para este
// change (Fase 4, repository layer) — `flatMap` sobre TODAS las filas de cada presupuesto, mismo
// filtro de estado que antes aplicado por fila, para no descartar en silencio los meses ya
// respondidos de un presupuesto con varios (el requisito explícito de esta fase). Lo que
// `autorizacion-mensual` tasks.md 5.2/5.3 todavía no hace acá: ordenar por `periodoMes` (legacy
// primero) y diferenciar la etiqueta por mes en el picker — eso es trabajo de Fase 5
// (`etiquetaAutorizacion.ts`), no de esta fase.
// TODO(autorizacion-mensual Fase 5): ordenar el resultado por `periodoMes` (legacy primero) antes
// de devolverlo — hoy queda en el orden que resuelva `listByPresupuestoId` (la Edge Function real
// ya ordena `periodo_mes NULLS FIRST`, D5; el mock lo replica, ver `mockAutorizacionRepository`).

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
    const autorizaciones = await autorizacionRepository.listByPresupuestoId(presupuesto.id);
    for (const autorizacion of autorizaciones) {
      if (autorizacion.estado === 'autorizada' || autorizacion.estado === 'judicializada') {
        pendientes.push({ autorizacion, presupuesto });
      }
    }
  }

  return pendientes;
}
