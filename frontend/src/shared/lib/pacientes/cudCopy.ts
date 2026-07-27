import type { EstadoCud } from './estadoCud';

// Etiquetas y color por estado del CUD — compartido entre PacientesList, PacienteResumen y
// PacienteDetail (antes cada uno tenía su propia copia de este mismo mapa).
export const CUD_CHIP_KIND: Record<EstadoCud, 'success' | 'warning' | 'danger'> = {
  vigente: 'success',
  'por-vencer': 'warning',
  vencido: 'danger',
};

export const CUD_CHIP_LABEL: Record<EstadoCud, string> = {
  vigente: 'Vigente',
  'por-vencer': 'Por vencer',
  vencido: 'Vencido',
};
