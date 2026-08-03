import type { ReactNode } from 'react';
import {
  iconAndador,
  iconSillaPlegable,
  iconSillaPostural,
  iconSillaRigida,
  iconTripode,
} from '../../design-system/icons';
import type { AccesorioMovilidad } from '../../shared/types/vehiculo';

// Etiquetas legibles del conjunto cerrado de accesorios de movilidad (RN-VE-01, vehiculo.ts).
// Único lugar de la UI que conoce el mapeo unión-literal → texto, para no repetirlo en cada
// selector.
export const ACCESORIO_MOVILIDAD_LABELS: Record<AccesorioMovilidad, string> = {
  'silla-plegable': 'Silla plegable',
  'silla-rigida': 'Silla rígida',
  'silla-postural': 'Silla postural',
  andador: 'Andador',
  tripode: 'Trípode',
};

export const ACCESORIO_MOVILIDAD_OPTIONS = Object.keys(ACCESORIO_MOVILIDAD_LABELS) as AccesorioMovilidad[];

// Ídem ACCESORIO_MOVILIDAD_LABELS pero para el ícono (feedback de usuario: "hacé los accesorios
// más amigables" en PacienteDatosPersonalesFields) — mismo criterio de mapeo centralizado
// unión-literal → contenido, disponible para cualquier selector que quiera mostrarlos.
export const ACCESORIO_MOVILIDAD_ICONS: Record<AccesorioMovilidad, ReactNode> = {
  'silla-plegable': iconSillaPlegable,
  'silla-rigida': iconSillaRigida,
  'silla-postural': iconSillaPostural,
  andador: iconAndador,
  tripode: iconTripode,
};
