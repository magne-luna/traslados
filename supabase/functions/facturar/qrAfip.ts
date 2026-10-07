// QR de los comprobantes electrónicos ARCA/AFIP (RG 4892/2020). Función pura, sin dependencias:
// arma la URL `https://www.afip.gob.ar/fe/qr/?p=<base64(JSON)>` que codifica el QR. El dibujo del
// QR (módulos) lo hace `facturaPdf.ts` con rectángulos de pdf-lib, igual que el código de barras.
//
// Campos del JSON (especificación "Código QR — Comprobantes electrónicos", versión 1):
// ver, fecha (AAAA-MM-DD), cuit (emisor), ptoVta, tipoCmp, nroCmp, importe, moneda, ctz,
// tipoDocRec/nroDocRec (opcionales), tipoCodAut ("E" = CAE), codAut.

const URL_BASE = 'https://www.afip.gob.ar/fe/qr/?p=';

/** Código numérico de comprobante AFIP por letra (RG 1415, tabla T). A=1, B=6, C=11. */
const CODIGO_COMPROBANTE: Record<'A' | 'B' | 'C', number> = { A: 1, B: 6, C: 11 };

/** Tipo de documento AFIP del receptor: 80 = CUIT (mismo criterio que `_shared/arca.ts`). */
const DOC_TIPO_CUIT = 80;

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

export interface DatosQrAfip {
  /** ISO date `YYYY-MM-DD`. */
  fechaEmision: string;
  cuitEmisor: string;
  ptoVta: number;
  tipoComprobante: 'A' | 'B' | 'C';
  nroComprobante: number;
  importeTotal: number;
  /** CUIT del receptor; si no tiene 11 dígitos se omite (consumidor final). */
  cuitReceptor: string;
  cae: string;
}

/** JSON del QR, en el orden de la especificación. */
export function datosQrAfip(datos: DatosQrAfip): Record<string, string | number> {
  const json: Record<string, string | number> = {
    ver: 1,
    fecha: datos.fechaEmision,
    cuit: Number(soloDigitos(datos.cuitEmisor)),
    ptoVta: datos.ptoVta,
    tipoCmp: CODIGO_COMPROBANTE[datos.tipoComprobante],
    nroCmp: datos.nroComprobante,
    importe: Math.round(datos.importeTotal * 100) / 100,
    moneda: 'PES',
    ctz: 1,
  };
  const cuitReceptor = soloDigitos(datos.cuitReceptor);
  if (cuitReceptor.length === 11) {
    json.tipoDocRec = DOC_TIPO_CUIT;
    json.nroDocRec = Number(cuitReceptor);
  }
  json.tipoCodAut = 'E';
  json.codAut = Number(soloDigitos(datos.cae));
  return json;
}

/** URL completa que va codificada en el QR. */
export function urlQrAfip(datos: DatosQrAfip): string {
  const json = JSON.stringify(datosQrAfip(datos));
  // El JSON es ASCII puro (números + claves/valores fijos), btoa alcanza sin pasar por UTF-8.
  return URL_BASE + btoa(json);
}
