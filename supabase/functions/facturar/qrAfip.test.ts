// deno test supabase/functions/facturar/qrAfip.test.ts
import { assertEquals, assert } from 'jsr:@std/assert@1';
import { datosQrAfip, urlQrAfip, type DatosQrAfip } from './qrAfip.ts';

const DATOS: DatosQrAfip = {
  fechaEmision: '2026-08-31',
  cuitEmisor: '23-46814521-9',
  ptoVta: 1,
  tipoComprobante: 'B',
  nroComprobante: 27,
  importeTotal: 2000,
  cuitReceptor: '30-52588935-2',
  cae: '86350829117767',
};

Deno.test('datosQrAfip: JSON v1 con los campos de la RG 4892 (CUIT receptor = doc tipo 80)', () => {
  assertEquals(datosQrAfip(DATOS), {
    ver: 1,
    fecha: '2026-08-31',
    cuit: 23468145219,
    ptoVta: 1,
    tipoCmp: 6,
    nroCmp: 27,
    importe: 2000,
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: 80,
    nroDocRec: 30525889352,
    tipoCodAut: 'E',
    codAut: 86350829117767,
  });
});

Deno.test('datosQrAfip: sin CUIT de receptor válido omite tipoDocRec/nroDocRec', () => {
  const json = datosQrAfip({ ...DATOS, cuitReceptor: '' });
  assert(!('tipoDocRec' in json));
  assert(!('nroDocRec' in json));
});

Deno.test('datosQrAfip: código de comprobante por letra (A=1, C=11) e importe a 2 decimales', () => {
  assertEquals(datosQrAfip({ ...DATOS, tipoComprobante: 'A' }).tipoCmp, 1);
  assertEquals(datosQrAfip({ ...DATOS, tipoComprobante: 'C' }).tipoCmp, 11);
  assertEquals(datosQrAfip({ ...DATOS, importeTotal: 1234.567 }).importe, 1234.57);
});

Deno.test('urlQrAfip: URL de AFIP con el JSON en base64 en el parámetro p', () => {
  const url = urlQrAfip(DATOS);
  const prefijo = 'https://www.afip.gob.ar/fe/qr/?p=';
  assert(url.startsWith(prefijo));
  assertEquals(JSON.parse(atob(url.slice(prefijo.length))), datosQrAfip(DATOS));
});
