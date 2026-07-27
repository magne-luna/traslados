// Validación de campos requeridos del formulario de Conductor (US-600, tasks.md 5.3). Función
// pura: sin acceso a DOM ni al repository, para poder testearla aislada del componente.

export interface ConductorFormInput {
  apellido: string;
  nombre: string;
  documento: string;
}

export interface ConductorFormErrors {
  apellido?: string;
  nombre?: string;
  documento?: string;
}

export function validateConductorForm(input: ConductorFormInput): ConductorFormErrors {
  const errors: ConductorFormErrors = {};

  if (input.apellido.trim() === '') {
    errors.apellido = 'El apellido es obligatorio.';
  }

  if (input.nombre.trim() === '') {
    errors.nombre = 'El nombre es obligatorio.';
  }

  if (input.documento.trim() === '') {
    errors.documento = 'El documento es obligatorio.';
  }

  return errors;
}
