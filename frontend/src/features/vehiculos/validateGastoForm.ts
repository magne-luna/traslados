// Validación del alta de gasto del vehículo (RF-508, tasks.md 7.2): monto positivo y fecha
// obligatoria. Función pura, testeable sin DOM ni repository.

export interface GastoFormInput {
  fecha: string;
  monto: number;
}

export interface GastoFormErrors {
  fecha?: string;
  monto?: string;
}

export function validateGastoForm(input: GastoFormInput): GastoFormErrors {
  const errors: GastoFormErrors = {};

  if (input.fecha.trim() === '') {
    errors.fecha = 'La fecha es obligatoria.';
  }

  if (Number.isNaN(input.monto) || input.monto <= 0) {
    errors.monto = 'El monto debe ser un número positivo.';
  }

  return errors;
}
