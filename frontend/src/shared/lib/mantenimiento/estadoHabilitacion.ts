import { DIAS_AVISO_HABILITACION } from './constantes';

export type EstadoHabilitacion = 'vigente' | 'por-vencer' | 'vencida';

export interface EstadoHabilitacionInput {
  /** ISO date de vencimiento de la habilitación (VTV o RTO). */
  fechaVencimiento: string;
  /** Fecha de referencia inyectada (nunca `new Date()` real acá). */
  ahora: Date;
}

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/**
 * RN-VE-04: estado de vencimiento de una habilitación (VTV o RTO), evaluada de forma
 * independiente de la otra — cada llamada solo conoce su propia fecha de vencimiento.
 */
export function estadoHabilitacion({ fechaVencimiento, ahora }: EstadoHabilitacionInput): EstadoHabilitacion {
  const vencimiento = new Date(fechaVencimiento);
  const diasHastaVencimiento = Math.ceil((vencimiento.getTime() - ahora.getTime()) / MS_POR_DIA);

  if (diasHastaVencimiento < 0) return 'vencida';
  if (diasHastaVencimiento <= DIAS_AVISO_HABILITACION) return 'por-vencer';
  return 'vigente';
}
