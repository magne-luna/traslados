import type { Vehiculo } from '../../types/vehiculo';
import type { AlertaMantenimientoVehiculo, MotivoAlertaMantenimiento } from '../../types/reportes';
import { estadoHabilitacion } from '../mantenimiento/estadoHabilitacion';
import { estadoServicePreventivo } from '../mantenimiento/estadoServicePreventivo';

// Función pura (design.md Decisión 5, tasks.md 4.6): reutiliza estadoServicePreventivo y
// estadoHabilitacion de shared/lib/mantenimiento/ — nunca reimplementa esas reglas ni sus
// umbrales. Un vehículo entra si cualquiera de las dos señales está en alerta; si tiene más de
// un motivo, aparece una sola vez enumerando todos. No se filtra por `Vehiculo.estado`: un
// vehículo `fuera-de-servicio` se evalúa igual (design.md Decisión 5) — es justamente lo que
// hay que ver.

export interface AlertasMantenimientoInput {
  vehiculos: Vehiculo[];
  /** Fecha de referencia, inyectada — mismo tipo (`Date`) que esperan las funciones dueñas. */
  ahora: Date;
}

export function alertasMantenimiento({ vehiculos, ahora }: AlertasMantenimientoInput): AlertaMantenimientoVehiculo[] {
  const resultado: AlertaMantenimientoVehiculo[] = [];

  for (const vehiculo of vehiculos) {
    const motivos: MotivoAlertaMantenimiento[] = [];

    const estadoService = estadoServicePreventivo({
      kilometraje: vehiculo.kilometraje,
      kilometrajeUltimoService: vehiculo.kilometrajeUltimoService,
      fechaUltimoService: vehiculo.fechaUltimoService,
      ahora,
    });
    if (estadoService === 'vencido' || estadoService === 'alerta-intermedia') {
      motivos.push({ tipo: 'service-preventivo', estado: estadoService });
    }

    for (const habilitacion of vehiculo.habilitaciones) {
      const estado = estadoHabilitacion({ fechaVencimiento: habilitacion.fechaVencimiento, ahora });
      if (estado === 'por-vencer' || estado === 'vencida') {
        motivos.push({ tipo: 'habilitacion', habilitacion: habilitacion.tipo, estado });
      }
    }

    if (motivos.length > 0) {
      resultado.push({ vehiculoId: vehiculo.id, patente: vehiculo.patente, motivos });
    }
  }

  return resultado;
}
