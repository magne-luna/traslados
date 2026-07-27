// Validación de campos requeridos del formulario de Paciente (tasks.md 6.5). Función pura: sin
// acceso a DOM ni al repository, para poder testearla aislada del componente.

export interface PacienteFormInput {
  apellido: string;
  nombre: string;
  dni: string;
}

export interface PacienteFormErrors {
  apellido?: string;
  nombre?: string;
  dni?: string;
}

export function validatePacienteForm(input: PacienteFormInput): PacienteFormErrors {
  const errors: PacienteFormErrors = {};

  if (input.apellido.trim() === '') {
    errors.apellido = 'El apellido es obligatorio.';
  }

  if (input.nombre.trim() === '') {
    errors.nombre = 'El nombre es obligatorio.';
  }

  if (input.dni.trim() === '') {
    errors.dni = 'El DNI es obligatorio.';
  }

  return errors;
}
