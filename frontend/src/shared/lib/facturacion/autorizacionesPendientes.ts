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
// `autorizacion-mensual` (design.md D5/D6c, tasks.md Fase 4/5): `getByPresupuestoId` (1 fila o
// `null`) se reemplazó por `listByPresupuestoId` (N filas por mes) en Fase 4 — `flatMap` sobre
// TODAS las filas de cada presupuesto, mismo filtro de estado que antes aplicado por fila, para no
// descartar en silencio los meses ya respondidos de un presupuesto con varios. Fase 5 (tasks.md
// 5.2) agrega el orden: el resultado final se ordena por `periodoMes` ascendente, legacy
// (`undefined`) primero — mismo criterio que ya usa `mockAutorizacionRepository.listByPresupuestoId`
// para que el picker del Paso 2 (`FacturaForm.tsx`) se lea "mes 1, mes 2, mes 3…" como Andrea lo
// piensa, sin depender del orden de `presupuestoRepository.list()` ni de a qué presupuesto
// pertenece cada mes (design.md D6c: el orden es sobre TODA la lista de pendientes, no por
// presupuesto).

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

  return ordenarPorPeriodoMes(pendientes);
}

// design.md D6c: legacy (`periodoMes === undefined`) primero, después ascendente por mes -- mismo
// comparador que `mockAutorizacionRepository.listByPresupuestoId` (design.md D5) para que el orden
// del picker no dependa de qué repository esté detrás.
function ordenarPorPeriodoMes(pendientes: AutorizacionPendiente[]): AutorizacionPendiente[] {
  return [...pendientes].sort((a, b) => {
    const periodoA = a.autorizacion.periodoMes;
    const periodoB = b.autorizacion.periodoMes;
    if (periodoA === periodoB) return 0;
    if (periodoA === undefined) return -1;
    if (periodoB === undefined) return 1;
    return periodoA.localeCompare(periodoB);
  });
}
