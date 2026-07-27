import type { EstadoAutorizacion } from '../../types/presupuesto';

// Etiquetas y color por estado de autorización — compartido entre PresupuestosList y
// PresupuestoDetail (mismo criterio que CUD_CHIP_KIND/CUD_CHIP_LABEL de pacientes-ui).
export const ESTADO_AUTORIZACION_CHIP_KIND: Record<EstadoAutorizacion, 'success' | 'warning' | 'danger' | 'info'> = {
  pendiente: 'warning',
  autorizada: 'success',
  judicializada: 'info',
  rechazada: 'danger',
};

export const ESTADO_AUTORIZACION_LABEL: Record<EstadoAutorizacion, string> = {
  pendiente: 'Pendiente',
  autorizada: 'Autorizada',
  judicializada: 'Judicializada',
  rechazada: 'Rechazada',
};
