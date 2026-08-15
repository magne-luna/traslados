import type { ReactNode } from 'react';
import {
  iconAccesorioGenerico,
  iconAndador,
  iconSillaPlegable,
  iconSillaPostural,
  iconSillaRigida,
  iconTripode,
} from '../../../design-system/icons';

// Display del catálogo de accesorios de movilidad (design.md D4, plan recortado): reemplaza a
// `accesorioMovilidadOptions.ts` (labels + iconos estáticos del conjunto cerrado). Hoy el `icono`
// es string (clave del DS); acá se resuelve a SVG con fallback defensivo, y el `tipo` libre se
// humaniza para mostrarse. Los labels de los 5 valores del seed se conservan EXACTOS para no
// cambiar nada en pantallas existentes.

/** Resuelve el `icono` (string) de un `AccesorioCatalogo` a su SVG del design system. Clave
 * desconocida → `iconoAccesorioFallback` (defensivo, no silencioso: el genérico se ve). */
export const iconoAccesorioMap: Record<string, ReactNode> = {
  'silla-plegable': iconSillaPlegable,
  'silla-rigida': iconSillaRigida,
  'silla-postural': iconSillaPostural,
  andador: iconAndador,
  tripode: iconTripode,
};

/** Glifo genérico para iconos que no están (todavía) en el mapeo. */
export const iconoAccesorioFallback: ReactNode = iconAccesorioGenerico;

export function iconoAccesorioPara(icono: string | undefined | null): ReactNode {
  if (icono === undefined || icono === null) return iconoAccesorioFallback;
  return iconoAccesorioMap[icono] ?? iconoAccesorioFallback;
}

/** Labels exactos de los 5 valores del seed (mismo texto que ACCESORIO_MOVILIDAD_LABELS). */
const LABELS_EXACTOS: Record<string, string> = {
  'silla-plegable': 'Silla plegable',
  'silla-rigida': 'Silla rígida',
  'silla-postural': 'Silla postural',
  andador: 'Andador',
  tripode: 'Trípode',
};

/** Humaniza un `tipo` libre: guiones → espacios, primera letra en mayúscula ("silla-electrica" →
 * "Silla electrica"). */
export function humanizarTipoAccesorio(tipo: string): string {
  const conEspacios = tipo.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  if (conEspacios.length === 0) return tipo;
  return conEspacios.charAt(0).toUpperCase() + conEspacios.slice(1);
}

/** Etiqueta legible de un `tipo`: label exacto si es uno de los 5 del seed, si no humanizado. */
export function labelAccesorio(tipo: string): string {
  return LABELS_EXACTOS[tipo] ?? humanizarTipoAccesorio(tipo);
}