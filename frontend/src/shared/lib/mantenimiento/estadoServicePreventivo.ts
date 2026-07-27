import { KM_ALERTA_INTERMEDIA, KM_SERVICE, MESES_SERVICE } from './constantes';

export type EstadoServicePreventivo = 'ok' | 'alerta-intermedia' | 'vencido';

export interface EstadoServicePreventivoInput {
  kilometraje: number;
  kilometrajeUltimoService: number;
  /** ISO date del último service. */
  fechaUltimoService: string;
  /** Fecha de referencia inyectada (nunca `new Date()` real acá — ver design.md Risks/Trade-offs). */
  ahora: Date;
}

/** Meses calendario completos transcurridos entre `from` y `to` (>= from). */
function mesesTranscurridos(from: Date, to: Date): number {
  let meses = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) meses -= 1;
  return meses;
}

/**
 * RN-VE-03: estado del mantenimiento preventivo (cambio de aceite), calculado client-side por
 * km desde el último service y por antigüedad, lo que ocurra primero, con alerta intermedia a
 * los 5.000 km.
 */
export function estadoServicePreventivo({
  kilometraje,
  kilometrajeUltimoService,
  fechaUltimoService,
  ahora,
}: EstadoServicePreventivoInput): EstadoServicePreventivo {
  const kmDesdeService = kilometraje - kilometrajeUltimoService;
  const mesesDesdeService = mesesTranscurridos(new Date(fechaUltimoService), ahora);

  if (kmDesdeService >= KM_SERVICE || mesesDesdeService >= MESES_SERVICE) {
    return 'vencido';
  }

  if (kmDesdeService >= KM_ALERTA_INTERMEDIA) {
    return 'alerta-intermedia';
  }

  return 'ok';
}
