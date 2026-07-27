// Validación de campos requeridos del formulario de Obra Social (RF-300, tasks.md 4.3).
// Función pura: sin acceso a DOM ni al repository, para poder testearla aislada del componente.

export interface ObraSocialFormInput {
  nombre: string;
  cuit: string;
}

export interface ObraSocialFormErrors {
  nombre?: string;
  cuit?: string;
}

export function validateObraSocialForm(input: ObraSocialFormInput): ObraSocialFormErrors {
  const errors: ObraSocialFormErrors = {};

  if (input.nombre.trim() === '') {
    errors.nombre = 'El nombre es obligatorio.';
  }

  if (input.cuit.trim() === '') {
    errors.cuit = 'El CUIT es obligatorio.';
  }

  return errors;
}
