// Funciones puras del mapeo factura <-> payload del miniserver `arca-miniserver` (contrato en
// `facturas/README.md`). Sin red, sin estado, sin `Deno.env` — todo lo externo entra por parámetro.
// Las usa `supabase/functions/facturar/index.ts`. Se mantiene dependency-free para poder testearla
// con `deno test` sin montar nada.
//
// facturacion-electronica-arca, design.md D4:
//  - IVA 21 % "por dentro" por defecto: neto = round(monto / 1.21, 2); total del comprobante = monto.
//    Overrideable por config (`ivaCodigo`, `ivaModo`).
//  - `obra_social.cuit` = CUIT de la obra social pagadora (decisión usuaria 2026-08-28).
//  - `obra_social.condicion_iva` ya es uno de los 8 códigos de ARCA (enum tipado, D4-bis): viaja
//    sin transformar.
//  - Factura C: el miniserver no la soporta -> error `EMISION_TIPO_NO_SOPORTADO`.

export type CbteTipoArca = 'FACTURA_A' | 'FACTURA_B';
export type IvaCodigoArca = 'IVA_21' | 'IVA_10_5' | 'IVA_0' | 'IVA_27';
export type IvaModo = 'por_dentro' | 'por_fuera';
export type AmbienteArca = 'production' | 'homologacion';

export interface ConfigArca {
  cuit: number;
  certB64: string;
  keyB64: string;
  ptoVta: number;
  ambiente: AmbienteArca;
  /** default 'IVA_21' */
  ivaCodigo: IvaCodigoArca;
  /** default 'por_dentro' */
  ivaModo: IvaModo;
}

/** Subconjunto de la factura que necesita el armado del payload (shape del dominio, camelCase). */
export interface FacturaParaArca {
  tipoComprobante: 'A' | 'B' | 'C';
  monto: number;
  fechaInicial: string;
  fechaTope: string;
  fechaEstimadaCobro?: string;
}

/** Subconjunto de la obra social receptora. */
export interface ObraSocialParaArca {
  cuit: string;
  condicionIva?: string;
}

export interface ItemArca {
  neto: number;
  iva: IvaCodigoArca;
  exento?: boolean;
}

export interface PayloadArca {
  cuit: number;
  certB64: string;
  keyB64: string;
  environment: AmbienteArca;
  ptoVta: number;
  cbteTipo: CbteTipoArca;
  items: ItemArca[];
  docTipo?: 'CUIT';
  docNro?: number;
  condicionIva?: string;
  servicio?: { desde: string; hasta: string; vtoPago: string };
}

export type CodigoEmision =
  | 'EMISION_TIPO_NO_SOPORTADO'
  | 'EMISION_SIN_CONDICION_IVA'
  | 'EMISION_CUIT_RECEPTOR_INVALIDO';

export type ResultadoPayload =
  | { ok: true; payload: PayloadArca }
  | { ok: false; status: number; codigo: CodigoEmision; detalle: string };

function redondear2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function soloDigitos(texto: string): string {
  return texto.replace(/\D/g, '');
}

// WSFE exige las fechas de servicio (`FchServDesde`/`FchServHasta`/`FchVtoPago`) en formato
// `aaaammdd` — un `YYYY-MM-DD` con guiones lo rechaza con la observación 10049. Las fechas del
// dominio (`fecha_init`, `fecha_tope`, `fecha_estimada_cobro`) son columnas DATE, siempre ISO;
// esto solo saca los guiones. Verificado contra el miniserver en homologación (2026-08-31).
function aaaammdd(fechaIso: string): string {
  return fechaIso.slice(0, 10).replace(/-/g, '');
}

/** neto del único ítem según la regla de IVA configurada (design.md D4). */
export function calcularNeto(monto: number, ivaCodigo: IvaCodigoArca, modo: IvaModo): number {
  if (modo === 'por_fuera' || ivaCodigo === 'IVA_0') return redondear2(monto);
  const factor = ivaCodigo === 'IVA_10_5' ? 1.105 : ivaCodigo === 'IVA_27' ? 1.27 : 1.21;
  return redondear2(monto / factor);
}

export function construirPayloadArca(
  factura: FacturaParaArca,
  obraSocial: ObraSocialParaArca,
  config: ConfigArca,
): ResultadoPayload {
  if (factura.tipoComprobante === 'C') {
    return {
      ok: false,
      status: 422,
      codigo: 'EMISION_TIPO_NO_SOPORTADO',
      detalle: 'El miniserver arca-miniserver solo emite comprobantes A y B.',
    };
  }

  const cbteTipo: CbteTipoArca = factura.tipoComprobante === 'A' ? 'FACTURA_A' : 'FACTURA_B';
  const neto = calcularNeto(factura.monto, config.ivaCodigo, config.ivaModo);
  const items: ItemArca[] = [
    config.ivaCodigo === 'IVA_0' ? { neto, iva: 'IVA_0', exento: true } : { neto, iva: config.ivaCodigo },
  ];

  const payload: PayloadArca = {
    cuit: config.cuit,
    certB64: config.certB64,
    keyB64: config.keyB64,
    environment: config.ambiente,
    ptoVta: config.ptoVta,
    cbteTipo,
    items,
    servicio: {
      desde: aaaammdd(factura.fechaInicial),
      hasta: aaaammdd(factura.fechaTope),
      vtoPago: aaaammdd(factura.fechaEstimadaCobro ?? factura.fechaTope),
    },
  };

  // FACTURA_A: el receptor es obligatorio (docTipo + docNro + condicionIva).
  if (cbteTipo === 'FACTURA_A') {
    const cuitReceptor = soloDigitos(obraSocial.cuit ?? '');
    if (cuitReceptor.length !== 11) {
      return {
        ok: false,
        status: 422,
        codigo: 'EMISION_CUIT_RECEPTOR_INVALIDO',
        detalle: 'El CUIT de la obra social no tiene 11 dígitos.',
      };
    }
    if (!obraSocial.condicionIva) {
      return {
        ok: false,
        status: 422,
        codigo: 'EMISION_SIN_CONDICION_IVA',
        detalle: 'La obra social no tiene condición frente al IVA cargada.',
      };
    }
    payload.docTipo = 'CUIT';
    payload.docNro = Number(cuitReceptor);
    payload.condicionIva = obraSocial.condicionIva;
  } else if (obraSocial.cuit && soloDigitos(obraSocial.cuit).length === 11) {
    // FACTURA_B: receptor opcional. Se incluye si hay un CUIT válido (consumidor final si no).
    payload.docTipo = 'CUIT';
    payload.docNro = Number(soloDigitos(obraSocial.cuit));
    if (obraSocial.condicionIva) payload.condicionIva = obraSocial.condicionIva;
  }

  return { ok: true, payload };
}

// -------------------------------------------------------------------------------------------
// Respuesta del miniserver -> resultado tipado (design.md D2 paso 5, D9).
// -------------------------------------------------------------------------------------------

export interface EmisionAprobada {
  cae: string;
  caeVencimiento: string;
  cbteNro: number;
  importes: { neto: number; iva: number; total: number };
}

export type CodigoRespuesta = 'ARCA_IDENTIDAD' | 'ARCA_RECHAZO' | 'ARCA_ERROR';

export type ResultadoMiniserver =
  | { ok: true; datos: EmisionAprobada }
  | { ok: false; status: number; codigo: CodigoRespuesta; detalle: string; observaciones?: string; cbteNro?: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function texto(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function numero(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Normaliza `observaciones` / `detalles` del miniserver a un string legible. WSFE las manda como
 * arreglo de `{ code, msg }` (verificado en homologación: `[{ code: 10015, msg: "..." }]`); el
 * miniserver reenvía ese arreglo tal cual. También se acepta un string plano (contrato viejo del
 * README) y `{ Code, Msg }` con mayúscula por las dudas. `undefined` si no hay nada útil.
 */
function formatObservaciones(value: unknown): string | undefined {
  if (typeof value === 'string') return value !== '' ? value : undefined;
  if (!Array.isArray(value)) return undefined;
  const partes = value
    .map((item) => {
      if (typeof item === 'string') return item;
      if (!isRecord(item)) return '';
      const code = item.code ?? item.Code;
      const msg = texto(item.msg) ?? texto(item.Msg) ?? '';
      return code !== undefined && code !== null ? `[${String(code)}] ${msg}`.trim() : msg;
    })
    .filter((parte) => parte !== '');
  return partes.length > 0 ? partes.join(' · ') : undefined;
}

/**
 * `httpStatus` + cuerpo (ya parseado como JSON, o `undefined` si no era JSON) del miniserver ->
 * `ResultadoMiniserver`. El `status` de la salida es el que la Edge Function `facturar` debe
 * devolver al frontend (no el del miniserver): identidad y errores de transporte se exponen como
 * 502, el rechazo del comprobante como 422.
 */
export function parseRespuestaMiniserver(httpStatus: number, body: unknown): ResultadoMiniserver {
  const cuerpo = isRecord(body) ? body : {};

  if (httpStatus === 200 && cuerpo.aprobada === true) {
    const cae = texto(cuerpo.cae);
    const caeVencimiento = texto(cuerpo.caeVencimiento);
    const cbteNro = numero(cuerpo.cbteNro);
    const importes = isRecord(cuerpo.importes) ? cuerpo.importes : {};
    if (cae && caeVencimiento && cbteNro !== undefined) {
      return {
        ok: true,
        datos: {
          cae,
          caeVencimiento,
          cbteNro,
          importes: {
            neto: numero(importes.neto) ?? 0,
            iva: numero(importes.iva) ?? 0,
            total: numero(importes.total) ?? 0,
          },
        },
      };
    }
    return { ok: false, status: 502, codigo: 'ARCA_ERROR', detalle: 'Respuesta 200 de ARCA sin CAE utilizable.' };
  }

  const errorCrudo = texto(cuerpo.error) ?? '';

  if (httpStatus === 401 || errorCrudo === 'ARCA_AUTH_ERROR' || errorCrudo === 'Unauthorized') {
    return { ok: false, status: 502, codigo: 'ARCA_IDENTIDAD', detalle: 'ARCA rechazó la identidad fiscal.' };
  }

  if (httpStatus === 422 || errorCrudo === 'ARCA_RECHAZO' || errorCrudo === 'ARCA_REJECTION') {
    return {
      ok: false,
      status: 422,
      codigo: 'ARCA_RECHAZO',
      detalle: 'ARCA rechazó el comprobante.',
      observaciones: formatObservaciones(cuerpo.observaciones) ?? formatObservaciones(cuerpo.detalles),
      cbteNro: numero(cuerpo.cbteNro),
    };
  }

  return {
    ok: false,
    status: 502,
    codigo: 'ARCA_ERROR',
    detalle: `El miniserver respondió ${httpStatus}.`,
  };
}
