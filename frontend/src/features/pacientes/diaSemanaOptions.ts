import type { DiaSemana } from '../../shared/types/recorridoHabitual';

// Etiquetas legibles de la unión cerrada DiaSemana (RF-110). Mismo criterio que
// TIPO_DIRECCION_LABELS (direccionOptions.ts): un único mapeo, nunca reinventado por componente.
export const DIA_SEMANA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export const DIA_SEMANA_OPTIONS = Object.keys(DIA_SEMANA_LABELS) as DiaSemana[];
