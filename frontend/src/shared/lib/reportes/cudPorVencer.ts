import type { PacienteResumen } from '../../types/paciente';
import type { PacienteCudPorVencer } from '../../types/reportes';
import { estadoCud } from '../pacientes/estadoCud';

// Función pura (design.md Decisión 5, tasks.md 4.5): reutiliza estadoCud de
// shared/lib/pacientes/ — nunca reimplementa la regla de vigencia del CUD. Un paciente con
// `cud: null` se omite sin generar error.

export interface CudPorVencerInput {
  pacientes: PacienteResumen[];
  /** Fecha de referencia, inyectada — mismo tipo (`Date`) que espera `estadoCud`. */
  hoy: Date;
  umbralDias: number;
}

export function cudPorVencer({ pacientes, hoy, umbralDias }: CudPorVencerInput): PacienteCudPorVencer[] {
  const resultado: PacienteCudPorVencer[] = [];

  for (const paciente of pacientes) {
    if (paciente.cud === null) continue;

    const estado = estadoCud(paciente.cud, hoy, umbralDias);
    if (estado === 'vigente') continue;

    resultado.push({
      pacienteId: paciente.id,
      apellido: paciente.apellido,
      nombre: paciente.nombre,
      fechaVencimiento: paciente.cud.fechaVencimiento,
      estado,
    });
  }

  return resultado;
}
