// Validación de formato del identificador de afiliado (RF-106, RN-ID-02): el formato depende de
// la obra social elegida (`ObraSocial.formatoAfiliado`, ver shared/types/obraSocial.ts) — cada
// obra social exige una forma distinta para el valor libre que carga el operador
// (`IdentificadorAfiliado.valor`, shared/types/paciente.ts). Función pura, mismo criterio que
// validatePacienteForm.ts/validateObraSocialForm.ts: sin acceso a DOM ni al repository, para
// poder testearla aislada del componente.

import type { FormatoAfiliado } from '../../shared/types/obraSocial';

// Reglas confirmadas por Enzo (backend, 2026-08-06):
// - numero-documento: 7 u 8 dígitos, sin letras ni separadores.
// - alfanumerico: libre — sin entrada en este mapa, cualquier valor no vacío es válido.
// - cuil-con-sufijo: dígitos + "/" + exactamente 3 dígitos de sufijo (ej. "46734546/001"). La
//   cantidad de dígitos antes de la barra NO está fija a 8 — el ejemplo de Enzo tenía 8 dígitos,
//   pero la regla la describió genéricamente como "cuil/numero_3_digitos"; solo el sufijo tiene
//   largo fijo.
const PATRONES_FORMATO_AFILIADO: Partial<Record<FormatoAfiliado, RegExp>> = {
  'numero-documento': /^\d{7,8}$/,
  'cuil-con-sufijo': /^\d+\/\d{3}$/,
};

const MENSAJES_FORMATO_AFILIADO: Partial<Record<FormatoAfiliado, string>> = {
  'numero-documento': 'El identificador de afiliado debe tener 7 u 8 dígitos.',
  'cuil-con-sufijo': 'El identificador de afiliado debe tener el formato CUIL con sufijo de 3 dígitos (ej. 46734546/001).',
};

/**
 * Valida el valor libre del identificador de afiliado contra el formato derivado de la obra
 * social del paciente. Devuelve el mensaje de error o `undefined` si es válido.
 *
 * - `formato: null` (todavía no se eligió obra social) no tiene contra qué validar: sin error.
 * - Valor vacío no reporta error para ningún formato: `SupabasePacienteRepository.ts` ya trata
 *   `numeroAfiliado.valor === ''` como "cobertura sin cargar todavía" (`numeroAfiliadoCargado`) —
 *   un paciente puede existir sin este dato completado, así que no es un campo requerido acá.
 */
export function validarIdentificadorAfiliado(formato: FormatoAfiliado | null, valor: string): string | undefined {
  if (formato === null || valor.trim() === '') return undefined;

  const patron = PATRONES_FORMATO_AFILIADO[formato];
  if (!patron) return undefined; // alfanumerico: libre, sin restricción de patrón.

  return patron.test(valor) ? undefined : MENSAJES_FORMATO_AFILIADO[formato];
}
