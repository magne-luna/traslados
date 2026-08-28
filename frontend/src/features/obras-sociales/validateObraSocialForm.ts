// Validación de campos del formulario de Obra Social (RF-300, tasks.md 4.3).
// Función pura: sin acceso a DOM ni al repository, para poder testearla aislada del componente.

import { esCondicionIvaArca } from '../../shared/types/obraSocial';

export interface ObraSocialFormInput {
  nombre: string;
  cuit: string;
  // Los 4 campos del docx (D9, discrepancia #11): aceptados pero nunca validados como
  // obligatorios — ninguna fuente (docx ni KB) respalda esa regla. Opcionales acá para que un
  // caller pueda pasar el `ObraSocialFormValues` completo sin recortarlo primero.
  codigo?: string;
  direccion?: string;
  telefono?: string;
  /** '' = sin especificar (válido); cualquier otra cosa debe ser uno de los 8 códigos de ARCA
   * (change `facturacion-electronica-arca` D4-bis). */
  condicionIva?: string;
}

export interface ObraSocialFormErrors {
  nombre?: string;
  cuit?: string;
  condicionIva?: string;
}

export function validateObraSocialForm(input: ObraSocialFormInput): ObraSocialFormErrors {
  const errors: ObraSocialFormErrors = {};

  if (input.nombre.trim() === '') {
    errors.nombre = 'El nombre es obligatorio.';
  }

  if (input.cuit.trim() === '') {
    errors.cuit = 'El CUIT es obligatorio.';
  }

  if (input.condicionIva !== undefined && input.condicionIva !== '' && !esCondicionIvaArca(input.condicionIva)) {
    errors.condicionIva = 'Elegí una condición frente al IVA válida.';
  }

  return errors;
}
