import type { CondicionIvaArca, TipoComprobante } from '../../types/obraSocial';

// ARCA solo acepta Factura A cuando el receptor es Responsable Inscripto (RG 5616). Con la obra
// social receptora en cualquier otra condición frente al IVA (exenta, monotributo, consumidor
// final, …), WSFE rechaza el comprobante A (422 ARCA_RECHAZO). Esta función pura devuelve la
// condición problemática (o `null` si no aplica) para que el formulario avise ANTES de que la
// operadora intente emitir — el aviso es informativo, no bloquea (mismo criterio que AlertaCupo).
//
// Condición ausente → `null` a propósito: ese caso ya lo ataja la Edge Function con
// `422 EMISION_SIN_CONDICION_IVA` y su mensaje propio. Factura B/C → `null`: el receptor no es
// obligatorio y ARCA no valida su condición.

export interface AdvertenciaTipoComprobante {
  condicion: CondicionIvaArca;
}

export function advertenciaTipoComprobante(args: {
  tipoComprobante: TipoComprobante;
  condicionIvaObraSocial: CondicionIvaArca | undefined;
}): AdvertenciaTipoComprobante | null {
  if (args.tipoComprobante !== 'A') return null;
  const condicion = args.condicionIvaObraSocial;
  if (condicion === undefined || condicion === 'IVA_RESPONSABLE_INSCRIPTO') return null;
  return { condicion };
}
