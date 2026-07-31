// Validación de campos requeridos del formulario de Obra Social (RF-300, tasks.md 4.3).
// Función pura: sin acceso a DOM ni al repository, para poder testearla aislada del componente.

export interface ObraSocialFormInput {
  nombre: string;
  cuit: string;
  // Los 4 campos del docx (D9, discrepancia #11): aceptados pero nunca validados como
  // obligatorios — ninguna fuente (docx ni KB) respalda esa regla. Opcionales acá para que un
  // caller pueda pasar el `ObraSocialFormValues` completo sin recortarlo primero.
  codigo?: string;
  direccion?: string;
  telefono?: string;
  condicionIva?: string;
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
