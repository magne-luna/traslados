import type { CondicionIvaArca } from '../../shared/types/obraSocial';
import { CONDICIONES_IVA_ARCA } from '../../shared/types/obraSocial';

// Etiquetas legibles de la unión cerrada de condiciones frente al IVA (códigos de ARCA, change
// `facturacion-electronica-arca` D4-bis). Único lugar de la UI que conoce el mapeo código -> texto.
// El código canónico (la clave) es el que viaja al payload de emisión; la etiqueta es solo para
// mostrar en el `<select>` y la ficha.
export const CONDICION_IVA_LABELS: Record<CondicionIvaArca, string> = {
  IVA_RESPONSABLE_INSCRIPTO: 'IVA Responsable Inscripto',
  IVA_SUJETO_EXENTO: 'IVA Sujeto Exento',
  CONSUMIDOR_FINAL: 'Consumidor Final',
  IVA_RESPONSABLE_MONOTRIBUTO: 'Responsable Monotributo',
  MONOTRIBUTO: 'Monotributo',
  PROVEEDOR_DEL_EXTERIOR: 'Proveedor del Exterior',
  CLIENTE_DEL_EXTERIOR: 'Cliente del Exterior',
  IVA_LIBERADO: 'IVA Liberado',
};

export const CONDICION_IVA_OPTIONS = CONDICIONES_IVA_ARCA;

export function etiquetaCondicionIva(valor: CondicionIvaArca | undefined): string {
  return valor ? CONDICION_IVA_LABELS[valor] : '';
}
