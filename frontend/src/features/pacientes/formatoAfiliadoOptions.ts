import type { FormatoAfiliado } from '../../shared/types/obraSocial';

// Etiquetas legibles del conjunto cerrado de formatos de identificador de afiliado (RF-106,
// RN-ID-02). Único lugar de la UI que conoce el mapeo unión-literal → texto. El formato es una
// propiedad de la obra social, no del paciente — ver shared/types/obraSocial.ts.
export const FORMATO_AFILIADO_LABELS: Record<FormatoAfiliado, string> = {
  'numero-documento': 'Número de documento',
  alfanumerico: 'Alfanumérico',
  'cuil-con-sufijo': 'CUIL del titular con sufijo',
};

export const FORMATO_AFILIADO_OPTIONS = Object.keys(FORMATO_AFILIADO_LABELS) as FormatoAfiliado[];

// Default documentado (IN-01 sin cerrar con el cliente) al crear una obra social nueva: se asume
// número de documento por ser el caso más común, nunca fijado en la lógica de dominio.
export const DEFAULT_FORMATO_AFILIADO: FormatoAfiliado = 'numero-documento';
