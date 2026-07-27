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
