// Validación de campos requeridos del formulario de alta de cuenta (tasks.md 7.1, design.md D9).
// Función pura: sin acceso a DOM ni al repository, para poder testearla aislada del componente
// — mismo patrón que validateObraSocialForm. La contraseña es obligatoria acá porque `create-user`
// la exige (design.md: "password es obligatorio... aunque el resumen del roadmap lo omitía").

export interface CuentaFormInput {
  email: string;
  nombre: string;
  apellido: string;
  password: string;
}

export interface CuentaFormErrors {
  email?: string;
  nombre?: string;
  apellido?: string;
  password?: string;
}

const LONGITUD_MINIMA_PASSWORD = 8;

export function validateCuentaForm(input: CuentaFormInput): CuentaFormErrors {
  const errors: CuentaFormErrors = {};

  if (input.email.trim() === '') {
    errors.email = 'El email es obligatorio.';
  }

  if (input.nombre.trim() === '') {
    errors.nombre = 'El nombre es obligatorio.';
  }

  if (input.apellido.trim() === '') {
    errors.apellido = 'El apellido es obligatorio.';
  }

  if (input.password.length < LONGITUD_MINIMA_PASSWORD) {
    errors.password = 'La contraseña debe tener 8 caracteres o más.';
  }

  return errors;
}
