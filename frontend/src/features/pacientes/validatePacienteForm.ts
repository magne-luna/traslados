// Validación de campos requeridos del formulario de Paciente (tasks.md 6.5). Función pura: sin
// acceso a DOM ni al repository, para poder testearla aislada del componente.

import type { FormatoAfiliado } from '../../shared/types/obraSocial';
import type { IdentificadorAfiliado } from '../../shared/types/paciente';
import { validarIdentificadorAfiliado } from './validarIdentificadorAfiliado';

export interface PacienteFormInput {
  apellido: string;
  nombre: string;
  dni: string;
  /** Formato derivado de la obra social elegida (RF-106, RN-ID-02) — nunca vive en el paciente,
   * ver shared/types/obraSocial.ts. Opcional/`null` cuando no aplica (sin obra social todavía, o
   * callers que no ejercitan cobertura): no hay contra qué validar. */
  formato?: FormatoAfiliado | null;
  numeroAfiliado?: IdentificadorAfiliado;
}

export interface PacienteFormErrors {
  apellido?: string;
  nombre?: string;
  dni?: string;
  numeroAfiliado?: string;
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

  const numeroAfiliadoError = validarIdentificadorAfiliado(input.formato ?? null, input.numeroAfiliado?.valor ?? '');
  if (numeroAfiliadoError) {
    errors.numeroAfiliado = numeroAfiliadoError;
  }

  return errors;
}
