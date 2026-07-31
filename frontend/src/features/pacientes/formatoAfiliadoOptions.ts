import type { FormatoAfiliado } from '../../shared/types/obraSocial';

// Etiquetas legibles del conjunto cerrado de formatos de identificador de afiliado (RN-ID-02).
// Único lugar de la UI que conoce el mapeo unión-literal → texto. El formato es una propiedad de
// la obra social (ObraSocial.formatoAfiliado), no del paciente — ver shared/types/obraSocial.ts.
export const FORMATO_AFILIADO_LABELS: Record<FormatoAfiliado, string> = {
  documento: 'Número de documento',
  alfanumerico: 'Alfanumérico',
  cuil_sufijo: 'CUIL del titular con sufijo',
};

export const FORMATO_AFILIADO_OPTIONS = Object.keys(FORMATO_AFILIADO_LABELS) as FormatoAfiliado[];

// Default documentado (IN-01 sin cerrar con el cliente) al crear una obra social nueva: se
// asume número de documento por ser el caso más común, nunca fijado en la lógica de dominio.
export const DEFAULT_FORMATO_AFILIADO: FormatoAfiliado = 'documento';
