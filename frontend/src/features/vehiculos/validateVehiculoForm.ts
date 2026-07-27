// Validación de campos requeridos del formulario de Vehículo (RF-500, tasks.md 5.3). Función
// pura: sin acceso a DOM ni al repository, para poder testearla aislada del componente.

export interface VehiculoFormInput {
  patente: string;
  capacidad: number;
  /** Kilometraje ingresado en el form. Solo se valida contra `kilometrajeMinimo` si se provee. */
  kilometraje?: number;
  /** RF-505: kilometraje ya registrado del vehículo (edición); ausente en alta. */
  kilometrajeMinimo?: number;
}

export interface VehiculoFormErrors {
  patente?: string;
  capacidad?: string;
  kilometraje?: string;
}

const CAPACIDAD_MINIMA = 1;
const CAPACIDAD_MAXIMA = 6; // RF-500: capacidad de hasta 6 pasajeros.

export function validateVehiculoForm(input: VehiculoFormInput): VehiculoFormErrors {
  const errors: VehiculoFormErrors = {};

  if (input.patente.trim() === '') {
    errors.patente = 'La patente es obligatoria.';
  }

  if (input.capacidad < CAPACIDAD_MINIMA || input.capacidad > CAPACIDAD_MAXIMA) {
    errors.capacidad = `La capacidad debe estar entre ${CAPACIDAD_MINIMA} y ${CAPACIDAD_MAXIMA}.`;
  }

  if (
    input.kilometrajeMinimo !== undefined &&
    input.kilometraje !== undefined &&
    input.kilometraje < input.kilometrajeMinimo
  ) {
    errors.kilometraje = `El kilometraje no puede ser menor al registrado (${input.kilometrajeMinimo}).`;
  }

  return errors;
}
