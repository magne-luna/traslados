import type { FormatoAfiliado } from '../../shared/types/paciente';

// Etiquetas legibles del conjunto cerrado de formatos de identificador de afiliado (RN-ID-02,
// design.md Decisión 1). Único lugar de la UI que conoce el mapeo unión-literal → texto.
export const FORMATO_AFILIADO_LABELS: Record<FormatoAfiliado, string> = {
  'numero-documento': 'Número de documento',
  alfanumerico: 'Alfanumérico',
  'cuil-con-sufijo': 'CUIL del titular con sufijo',
};

export const FORMATO_AFILIADO_OPTIONS = Object.keys(FORMATO_AFILIADO_LABELS) as FormatoAfiliado[];

// Default documentado (design.md Decisión 1, IN-01 sin cerrar con el cliente) al crear un
// identificador de afiliado nuevo: se asume número de documento por ser el caso más común,
// pero queda editable en el form — nunca fijado en la lógica de dominio.
export const DEFAULT_FORMATO_AFILIADO: FormatoAfiliado = 'numero-documento';
