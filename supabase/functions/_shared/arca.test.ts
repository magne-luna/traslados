// deno test supabase/functions/_shared/arca.test.ts
import { assertEquals, assert } from 'jsr:@std/assert@1';
import {
  calcularNeto,
  construirPayloadArca,
  parseRespuestaMiniserver,
  type ConfigArca,
} from './arca.ts';

const CONFIG: ConfigArca = {
  cuit: 20111111112,
  certB64: 'CERT',
  keyB64: 'KEY',
  ptoVta: 3,
  ambiente: 'homologacion',
  ivaCodigo: 'IVA_21',
  ivaModo: 'por_dentro',
};

const OS_A = { cuit: '30-11111111-2', condicionIva: 'IVA_RESPONSABLE_INSCRIPTO' };

function factura(over: Partial<Parameters<typeof construirPayloadArca>[0]> = {}) {
  return {
    tipoComprobante: 'A' as const,
    monto: 121000,
    fechaInicial: '2026-03-01',
    fechaTope: '2026-03-31',
    fechaEstimadaCobro: '2026-06-01',
    ...over,
  };
}

Deno.test('calcularNeto: IVA 21 % por dentro -> neto = monto / 1.21', () => {
  assertEquals(calcularNeto(121000, 'IVA_21', 'por_dentro'), 100000);
});

Deno.test('calcularNeto: por fuera -> neto = monto', () => {
  assertEquals(calcularNeto(100000, 'IVA_21', 'por_fuera'), 100000);
});

Deno.test('calcularNeto: redondea a 2 decimales', () => {
  assertEquals(calcularNeto(1000, 'IVA_21', 'por_dentro'), 826.45);
});

Deno.test('Factura A: payload completo con receptor obligatorio y IVA 21 por dentro', () => {
  const r = construirPayloadArca(factura(), OS_A, CONFIG);
  assert(r.ok);
  assertEquals(r.payload.cbteTipo, 'FACTURA_A');
  assertEquals(r.payload.items, [{ neto: 100000, iva: 'IVA_21' }]);
  assertEquals(r.payload.docTipo, 'CUIT');
  assertEquals(r.payload.docNro, 30111111112);
  assertEquals(r.payload.condicionIva, 'IVA_RESPONSABLE_INSCRIPTO');
  // WSFE exige `aaaammdd` (sin guiones) — un ISO con guiones lo rechaza con la observación 10049.
  assertEquals(r.payload.servicio, { desde: '20260301', hasta: '20260331', vtoPago: '20260601' });
  assertEquals(r.payload.environment, 'homologacion');
});

Deno.test('Factura C -> EMISION_TIPO_NO_SOPORTADO (422)', () => {
  const r = construirPayloadArca(factura({ tipoComprobante: 'C' }), OS_A, CONFIG);
  assert(!r.ok);
  assertEquals(r.codigo, 'EMISION_TIPO_NO_SOPORTADO');
  assertEquals(r.status, 422);
});

Deno.test('Factura A sin condición IVA -> EMISION_SIN_CONDICION_IVA', () => {
  const r = construirPayloadArca(factura(), { cuit: '30111111112' }, CONFIG);
  assert(!r.ok);
  assertEquals(r.codigo, 'EMISION_SIN_CONDICION_IVA');
});

Deno.test('Factura A con CUIT receptor que no tiene 11 dígitos -> EMISION_CUIT_RECEPTOR_INVALIDO', () => {
  const r = construirPayloadArca(factura(), { cuit: '123', condicionIva: 'CONSUMIDOR_FINAL' }, CONFIG);
  assert(!r.ok);
  assertEquals(r.codigo, 'EMISION_CUIT_RECEPTOR_INVALIDO');
});

Deno.test('Factura B: receptor opcional, se incluye si el CUIT es válido', () => {
  const r = construirPayloadArca(factura({ tipoComprobante: 'B' }), OS_A, CONFIG);
  assert(r.ok);
  assertEquals(r.payload.cbteTipo, 'FACTURA_B');
  assertEquals(r.payload.docNro, 30111111112);
});

Deno.test('Factura B sin CUIT válido: sin receptor, no falla', () => {
  const r = construirPayloadArca(factura({ tipoComprobante: 'B' }), { cuit: '' }, CONFIG);
  assert(r.ok);
  assertEquals(r.payload.docNro, undefined);
});

Deno.test('sin fechaEstimadaCobro, vtoPago cae a fechaTope (en aaaammdd)', () => {
  const r = construirPayloadArca(factura({ fechaEstimadaCobro: undefined }), OS_A, CONFIG);
  assert(r.ok);
  assertEquals(r.payload.servicio?.vtoPago, '20260331');
});

Deno.test('fechas de servicio salen en aaaammdd, no ISO (WSFE 10049)', () => {
  const r = construirPayloadArca(
    factura({ fechaInicial: '2026-08-01', fechaTope: '2026-08-31', fechaEstimadaCobro: '2026-09-30' }),
    OS_A,
    CONFIG,
  );
  assert(r.ok);
  assertEquals(r.payload.servicio, { desde: '20260801', hasta: '20260831', vtoPago: '20260930' });
});

// --- parseRespuestaMiniserver ---

Deno.test('200 aprobada:true -> ok con CAE / vencimiento / cbteNro / importes', () => {
  const r = parseRespuestaMiniserver(200, {
    aprobada: true,
    cae: '75123456789012',
    caeVencimiento: '2026-04-12',
    cbteNro: 45,
    importes: { neto: 100000, iva: 21000, total: 121000 },
  });
  assert(r.ok);
  assertEquals(r.datos.cae, '75123456789012');
  assertEquals(r.datos.cbteNro, 45);
  assertEquals(r.datos.importes.total, 121000);
});

Deno.test('200 aprobada:true pero sin CAE -> ARCA_ERROR', () => {
  const r = parseRespuestaMiniserver(200, { aprobada: true });
  assert(!r.ok);
  assertEquals(r.codigo, 'ARCA_ERROR');
});

Deno.test('401 -> ARCA_IDENTIDAD con status 502', () => {
  const r = parseRespuestaMiniserver(401, { error: 'Unauthorized' });
  assert(!r.ok);
  assertEquals(r.codigo, 'ARCA_IDENTIDAD');
  assertEquals(r.status, 502);
});

Deno.test('422 ARCA_RECHAZO -> propaga observaciones (string) y cbteNro, status 422', () => {
  const r = parseRespuestaMiniserver(422, { aprobada: false, error: 'ARCA_RECHAZO', cbteNro: 46, observaciones: 'CAE denegado' });
  assert(!r.ok);
  assertEquals(r.codigo, 'ARCA_RECHAZO');
  assertEquals(r.status, 422);
  assertEquals(r.observaciones, 'CAE denegado');
  assertEquals(r.cbteNro, 46);
});

Deno.test('422 ARCA_RECHAZO -> observaciones como arreglo {code,msg} se aplana a texto legible', () => {
  const r = parseRespuestaMiniserver(422, {
    aprobada: false,
    error: 'ARCA_RECHAZO',
    cbteNro: 25,
    observaciones: [
      { code: 10015, msg: 'DocNro 30525889352 no se encuentra registrado en los padrones de AFIP.' },
      { code: 10049, msg: 'FchServDesde formato invalido.' },
    ],
  });
  assert(!r.ok);
  assertEquals(
    r.observaciones,
    '[10015] DocNro 30525889352 no se encuentra registrado en los padrones de AFIP. · [10049] FchServDesde formato invalido.',
  );
});

Deno.test('422 ARCA_RECHAZO -> sin observaciones utilizables queda undefined', () => {
  const r = parseRespuestaMiniserver(422, { aprobada: false, error: 'ARCA_RECHAZO', cbteNro: 1, observaciones: [] });
  assert(!r.ok);
  assertEquals(r.observaciones, undefined);
});

Deno.test('400 / status desconocido -> ARCA_ERROR 502', () => {
  const r = parseRespuestaMiniserver(400, { error: 'faltan campos' });
  assert(!r.ok);
  assertEquals(r.codigo, 'ARCA_ERROR');
  assertEquals(r.status, 502);
});

Deno.test('body no-JSON (undefined) en 500 -> ARCA_ERROR', () => {
  const r = parseRespuestaMiniserver(500, undefined);
  assert(!r.ok);
  assertEquals(r.codigo, 'ARCA_ERROR');
});
