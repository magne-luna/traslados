import type { EstadoHabilitacion } from '../../shared/lib/mantenimiento/estadoHabilitacion';
import type { EstadoServicePreventivo } from '../../shared/lib/mantenimiento/estadoServicePreventivo';
import type { RegistroHabilitacion } from '../../shared/types/vehiculo';

// Copys compartidos entre VehiculosList y VehiculoDetail (sin emoji — InlineIcon en su lugar,
// ver design-system/icons.tsx). VehiculoMantenimiento.tsx tiene su propia versión con emoji,
// fuera de alcance de este archivo: no se tocó para no romper su comportamiento ya probado.
export const SERVICE_COPY: Record<EstadoServicePreventivo, { texto: string; kind: 'success' | 'warning' | 'danger' }> = {
  ok: { texto: 'Al día', kind: 'success' },
  'alerta-intermedia': { texto: 'Se acerca', kind: 'warning' },
  vencido: { texto: 'Vencido', kind: 'danger' },
};

export const HABILITACION_COPY: Record<EstadoHabilitacion, { texto: string; kind: 'success' | 'warning' | 'danger' }> = {
  vigente: { texto: 'Vigente', kind: 'success' },
  'por-vencer': { texto: 'Por vencer', kind: 'warning' },
  vencida: { texto: 'Vencida', kind: 'danger' },
};

export const TIPO_HABILITACION_LABELS: Record<RegistroHabilitacion['tipo'], string> = {
  vtv: 'VTV',
  rto: 'RTO',
};

// Texto plano coloreado en vez de Chip/pill para los 3 estados de arriba (feedback de usuario,
// VehiculosList/VehiculoDetail: "sacarle el formato pill a todo... dejá el color nomás") —
// compartido entre VehiculosList y VehiculoDetail, igual que el resto de este archivo.
export const ESTADO_TEXT_CLASS: Record<'success' | 'warning' | 'danger', string> = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};
