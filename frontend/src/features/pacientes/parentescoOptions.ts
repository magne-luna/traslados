import type { Parentesco } from '../../shared/types/paciente';

// Etiquetas legibles de la unión cerrada de parentesco (PersonasACargoEditor), mismo patrón que
// direccionOptions.ts para TipoDireccion.
export const PARENTESCO_LABELS: Record<Parentesco, string> = {
  padre: 'Padre',
  madre: 'Madre',
  tutor_legal: 'Tutor/a legal',
  otro: 'Otro',
};

export const PARENTESCO_OPTIONS = Object.keys(PARENTESCO_LABELS) as Parentesco[];

/** Valor inicial del formulario de alta — evita indexar `PARENTESCO_OPTIONS[0]` (posiblemente
 * `undefined` bajo `noUncheckedIndexedAccess`). */
export const PARENTESCO_DEFAULT: Parentesco = 'padre';
