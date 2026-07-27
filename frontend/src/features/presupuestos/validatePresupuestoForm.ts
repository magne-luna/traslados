// Validación de campos requeridos del formulario de Presupuesto (tasks.md 5.3): exige paciente,
// obra social y monto. Función pura: sin acceso a DOM ni al repository, para poder testearla
// aislada del componente (mismo criterio que validateVehiculoForm/validatePacienteForm).

export interface PresupuestoFormInput {
  pacienteId: string | null;
  obraSocialId: string | null;
  monto: number;
}

export interface PresupuestoFormErrors {
  pacienteId?: string;
  obraSocialId?: string;
  monto?: string;
}

export function validatePresupuestoForm(input: PresupuestoFormInput): PresupuestoFormErrors {
  const errors: PresupuestoFormErrors = {};

  if (input.pacienteId === null) {
    errors.pacienteId = 'El paciente es obligatorio.';
  }

  if (input.obraSocialId === null) {
    errors.obraSocialId = 'La obra social es obligatoria.';
  }

  if (input.monto <= 0) {
    errors.monto = 'El monto debe ser mayor a 0.';
  }

  return errors;
}
