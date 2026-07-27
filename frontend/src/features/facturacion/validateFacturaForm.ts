// Validación de campos requeridos del formulario de Factura (tasks.md 7.4): paciente, período
// (mes 1-12 + año), valor del km y cantidad de días. Función pura: sin acceso al repository —
// si hay errores, FacturaForm no invoca crear()/actualizar() (mismo criterio que
// validatePresupuestoForm/validateVehiculoForm).
export interface FacturaFormInput {
  pacienteId: string | null;
  mesFacturado: number | null;
  anioFacturado: number | null;
  valorKm: number;
  dias: number;
}

export interface FacturaFormErrors {
  pacienteId?: string;
  periodo?: string;
  valorKm?: string;
  dias?: string;
}

export function validateFacturaForm(input: FacturaFormInput): FacturaFormErrors {
  const errors: FacturaFormErrors = {};

  if (input.pacienteId === null) {
    errors.pacienteId = 'El paciente es obligatorio.';
  }

  if (
    input.mesFacturado === null ||
    input.anioFacturado === null ||
    input.mesFacturado < 1 ||
    input.mesFacturado > 12
  ) {
    errors.periodo = 'El período (mes y año) es obligatorio.';
  }

  if (input.valorKm <= 0) {
    errors.valorKm = 'El valor del km es obligatorio.';
  }

  if (input.dias <= 0) {
    errors.dias = 'La cantidad de días es obligatoria.';
  }

  return errors;
}
