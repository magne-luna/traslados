// deno test supabase/functions/facturar/facturaPdf.test.ts
import { assertEquals, assert, assertStringIncludes } from 'jsr:@std/assert@1';
import { construirFacturaPdf, winAnsi, type DatosFacturaPdf } from './facturaPdf.ts';

Deno.test('winAnsi: la flecha U+2192 (rompía drawText) pasa a "->"', () => {
  assertEquals(winAnsi('Casa → Escuela'), 'Casa -> Escuela');
});

Deno.test('winAnsi: comillas tipográficas y puntos suspensivos a ASCII', () => {
  assertEquals(winAnsi('“hola” … ‘chau’'), '"hola" ... \'chau\'');
});

Deno.test('winAnsi: conserva Latin-1 y los extras de CP1252 que pdf-lib sí soporta', () => {
  assertEquals(winAnsi('Kinesiología — €10 • ™ – ñ'), 'Kinesiología — €10 • ™ – ñ');
});

Deno.test('winAnsi: cualquier otro carácter no representable cae a "?"', () => {
  assertEquals(winAnsi('emoji 😀 y kanji 日'), 'emoji ? y kanji ?');
});

const DATOS: DatosFacturaPdf = {
  emisor: { razonSocial: 'Andrea Pastor', cuit: '23468145219', domicilio: 'Calle 1', iibb: '—', inicioActividades: '2020-01-01' },
  receptor: { razonSocial: 'OSDE', cuit: '30525889352', condicionIva: 'IVA Sujeto Exento', domicilio: 'Av 2' },
  comprobante: {
    letra: 'B', ptoVta: 1, nro: 27, fechaEmision: '2026-08-31',
    periodoDesde: '2026-08-01', periodoHasta: '2026-08-31', vtoPago: '2026-09-30',
    mesFacturado: 8, anioFacturado: 2026, ambiente: 'homologacion',
  },
  detalle: { descripcion: 'Traslados Escuela → domicilio', dias: 20, valorKm: 300, cantidadKm: 10 },
  importes: { neto: 1652.89, iva: 347.11, total: 2000 },
  cae: { valor: '86350829117767', vencimiento: '2026-09-10' },
  asistencias: [
    { fecha: '2026-08-03', prestacion: 'Kinesiología', dependencia: 'Casa', retorno: 'Escuela → Casa' },
  ],
};

Deno.test('construirFacturaPdf: no rompe con flechas en la descripción / asistencias y devuelve un PDF', async () => {
  const bytes = await construirFacturaPdf(DATOS);
  assert(bytes.length > 0);
  const cabecera = new TextDecoder().decode(bytes.slice(0, 5));
  assertStringIncludes(cabecera, '%PDF-');
});
