// Código de barras de los comprobantes AFIP/ARCA (RG 1702 / 4291). Función pura, sin dependencias:
// arma el string de dígitos y le agrega el dígito verificador (módulo 10 con ponderación 3-1).
// El dibujo del Interleaved 2 of 5 lo hace `facturaPdf.ts` con rectángulos de pdf-lib.
//
// Estructura del string (sin separadores): CUIT emisor (11) + tipo de comprobante (3) +
// punto de venta (5) + CAE (14) + vencimiento del CAE AAAAMMDD (8) = 41 dígitos, + 1 verificador.

/** Código numérico de comprobante AFIP por letra (RG 1415, tabla T). A=1, B=6, C=11. */
const CODIGO_COMPROBANTE: Record<'A' | 'B' | 'C', number> = { A: 1, B: 6, C: 11 };

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

function pad(valor: string | number, largo: number): string {
  return String(valor).replace(/\D/g, '').padStart(largo, '0').slice(-largo);
}

/** Dígito verificador módulo 10 con ponderación alterna 3,1,3,1... desde la derecha (RG 1702). */
export function digitoVerificadorModulo10(digitos: string): number {
  const limpio = soloDigitos(digitos);
  let sumaImpares = 0;
  let sumaPares = 0;
  // Recorriendo desde la derecha: posición 1 (impar) pondera x3, posición 2 (par) x1, ...
  for (let i = limpio.length - 1, pos = 1; i >= 0; i--, pos++) {
    const n = Number(limpio[i]);
    if (pos % 2 === 1) sumaImpares += n;
    else sumaPares += n;
  }
  const total = sumaImpares * 3 + sumaPares;
  return (10 - (total % 10)) % 10;
}

export interface DatosCodigoBarras {
  cuitEmisor: string;
  tipoComprobante: 'A' | 'B' | 'C';
  ptoVta: number;
  cae: string;
  /** ISO date `YYYY-MM-DD`. */
  caeVencimiento: string;
}

/** String completo del código de barras, con el dígito verificador al final (42 dígitos). */
export function codigoBarrasAfip(datos: DatosCodigoBarras): string {
  const base =
    pad(datos.cuitEmisor, 11) +
    pad(CODIGO_COMPROBANTE[datos.tipoComprobante], 3) +
    pad(datos.ptoVta, 5) +
    pad(datos.cae, 14) +
    pad(datos.caeVencimiento.replace(/-/g, ''), 8);
  return base + String(digitoVerificadorModulo10(base));
}
