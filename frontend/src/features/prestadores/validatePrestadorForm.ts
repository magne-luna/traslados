// Validación de campos requeridos del formulario de Prestador (spec prestador-crud, tasks.md 4.7).
// Función pura: sin acceso a DOM ni al repository, para poder testearla aislada del componente —
// espejo 1:1 de validateObraSocialForm.ts.

export interface PrestadorFormInput {
  razonSocial: string;
  cuit: string;
}

export interface PrestadorFormErrors {
  razonSocial?: string;
  cuit?: string;
}

export function validatePrestadorForm(input: PrestadorFormInput): PrestadorFormErrors {
  const errors: PrestadorFormErrors = {};

  if (input.razonSocial.trim() === '') {
    errors.razonSocial = 'La razón social es obligatoria.';
  }

  if (input.cuit.trim() === '') {
    errors.cuit = 'El CUIT es obligatorio.';
  }

  return errors;
}
