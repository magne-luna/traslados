import type { ReactNode } from 'react';
import { iconCasa, iconEscuela, iconUbicacion } from '../../design-system/icons';
import type { TipoDireccion, Tramo } from '../../shared/types/paciente';

// Etiquetas legibles de las uniones cerradas de tipo/tramo de dirección (RF-113, RN-HR-02).
export const TIPO_DIRECCION_LABELS: Record<TipoDireccion, string> = {
  domicilio: 'Domicilio',
  escuela: 'Escuela',
  terapia: 'Terapia',
  ciset: 'CISET',
  otro: 'Otro',
};

export const TIPO_DIRECCION_OPTIONS = Object.keys(TIPO_DIRECCION_LABELS) as TipoDireccion[];

// Ícono por tipo de lugar (InlineIcon) — domicilio/escuela tienen ícono propio, el resto
// (terapia/CISET/otro) comparte un pin genérico de ubicación.
export const TIPO_DIRECCION_ICON: Record<TipoDireccion, ReactNode> = {
  domicilio: iconCasa,
  escuela: iconEscuela,
  terapia: iconUbicacion,
  ciset: iconUbicacion,
  otro: iconUbicacion,
};

export const TRAMO_LABELS: Record<Tramo, string> = {
  ida: 'Ida',
  vuelta: 'Vuelta',
};

export const TRAMO_OPTIONS = Object.keys(TRAMO_LABELS) as Tramo[];
