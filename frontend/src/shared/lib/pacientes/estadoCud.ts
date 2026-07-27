import type { Cud } from '../../types/paciente';

export type EstadoCud = 'vigente' | 'por-vencer' | 'vencido';

const MS_POR_DIA = 24 * 60 * 60 * 1000;

/** Umbral por defecto de "por vencer" (días), alineable con la alerta de facturación (RF-104). */
const UMBRAL_DIAS_POR_DEFECTO = 60;

/**
 * RF-104: estado de vigencia del CUD (Certificado Único de Discapacidad), derivado de forma
 * pura a partir de la fecha de referencia recibida por parámetro — nunca lee `Date.now()` ni
 * ningún reloj global, para ser determinística y testeable (mismo patrón que estadoHabilitacion
 * de FE-2/vehiculos-ui). El componente de UI le pasa `new Date()` en el borde.
 */
export function estadoCud(cud: Cud, hoy: Date, umbralDias: number = UMBRAL_DIAS_POR_DEFECTO): EstadoCud {
  const vencimiento = new Date(cud.fechaVencimiento);
  const diasHastaVencimiento = Math.ceil((vencimiento.getTime() - hoy.getTime()) / MS_POR_DIA);

  if (diasHastaVencimiento < 0) return 'vencido';
  if (diasHastaVencimiento <= umbralDias) return 'por-vencer';
  return 'vigente';
}
