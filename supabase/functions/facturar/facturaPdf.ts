// Modelo del PDF del comprobante emitido (facturacion-electronica-arca, design.md D6). Función
// pura `construirFacturaPdf(datos): Promise<Uint8Array>` — no toca red ni Storage, la subida la
// hace `index.ts`. Layout de una hoja A4 tipo comprobante AFIP. `pdf-lib` (JS puro, corre en Deno).
//
// RN-FA-06: el PDF se genera UNA sola vez, al emitir. Si después se corrige la factura, el PDF
// archivado no se regenera.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'npm:pdf-lib@1.17.1';
import qrcode from 'npm:qrcode-generator@1.4.4';
import { codigoBarrasAfip } from './codigoBarrasAfip.ts';
import { urlQrAfip } from './qrAfip.ts';

export interface AsistenciaPdf {
  fecha: string;
  prestacion: string;
  dependencia: string;
  retorno: string;
}

export interface DatosFacturaPdf {
  emisor: {
    razonSocial: string;
    cuit: string;
    domicilio: string;
    iibb: string;
    inicioActividades: string;
  };
  receptor: {
    razonSocial: string;
    cuit: string;
    condicionIva: string;
    domicilio: string;
  };
  comprobante: {
    letra: 'A' | 'B' | 'C';
    ptoVta: number;
    nro: number;
    fechaEmision: string;
    periodoDesde: string;
    periodoHasta: string;
    vtoPago: string;
    mesFacturado: number;
    anioFacturado: number;
    ambiente: 'production' | 'homologacion';
  };
  detalle: {
    descripcion: string;
    dias: number;
    valorKm: number;
    cantidadKm: number;
  };
  importes: { neto: number; iva: number; total: number };
  cae: { valor: string; vencimiento: string };
  asistencias: AsistenciaPdf[];
}

const A4: [number, number] = [595.28, 841.89];
const MARGEN = 40;
const NEGRO = rgb(0.1, 0.1, 0.1);
const GRIS = rgb(0.45, 0.45, 0.45);

/** `YYYY-MM-DD` (o `aaaammdd`, como devuelve ARCA el vencimiento del CAE) -> `dd/mm/aaaa`.
 * Cualquier otro texto (ej. "—") se deja como está. */
export function fechaAr(fecha: string): string {
  const m = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(fecha.trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : fecha;
}

function money(n: number): string {
  return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface Cursor {
  page: PDFPage;
  y: number;
}

// Las fuentes estándar de pdf-lib usan encoding WinAnsi (CP1252): un carácter fuera de ese set
// hace fallar `drawText` y aborta todo el PDF (visto en vivo: `WinAnsi cannot encode "→"`). Los
// datos dinámicos (descripción, dependencia/retorno, prestación) son texto libre del operador y
// pueden traer flechas, comillas tipográficas, etc. Se mapean los casos comunes a ASCII y
// cualquier otro carácter no representable cae a '?'. Se conservan los extras de CP1252 que
// pdf-lib sí soporta: € – — • ™ y todo Latin-1 (á, ñ, ü, …).
export function winAnsi(s: string): string {
  return s
    .replace(/[→⟶➔➙]/g, '->')
    .replace(/[←⟵]/g, '<-')
    .replace(/[↔⟷]/g, '<->')
    .replace(/[“”«»„]/g, '"')
    .replace(/[‘’‚]/g, "'")
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/[^\t\n\r\x20-\x7e¡-ÿ€–—•™]/gu, '?');
}

function texto(
  cur: Cursor,
  s: string,
  opts: { x?: number; size?: number; font: PDFFont; color?: ReturnType<typeof rgb> },
): void {
  cur.page.drawText(winAnsi(s), {
    x: opts.x ?? MARGEN,
    y: cur.y,
    size: opts.size ?? 9,
    font: opts.font,
    color: opts.color ?? NEGRO,
  });
}

function linea(cur: Cursor): void {
  cur.page.drawLine({
    start: { x: MARGEN, y: cur.y },
    end: { x: A4[0] - MARGEN, y: cur.y },
    thickness: 0.5,
    color: GRIS,
  });
}

/** Dibuja el QR (módulos negros como rectángulos de pdf-lib, sin imágenes) en un cuadrado de
 * `lado` puntos con la esquina superior izquierda en (x, yArriba). Nivel de corrección M. */
function dibujarQr(page: PDFPage, contenido: string, pos: { x: number; yArriba: number; lado: number }): void {
  const qr = qrcode(0, 'M');
  qr.addData(contenido);
  qr.make();
  const modulos = qr.getModuleCount();
  const tam = pos.lado / modulos;
  for (let fila = 0; fila < modulos; fila++) {
    for (let col = 0; col < modulos; col++) {
      if (!qr.isDark(fila, col)) continue;
      page.drawRectangle({
        x: pos.x + col * tam,
        y: pos.yArriba - (fila + 1) * tam,
        width: tam,
        height: tam,
        color: NEGRO,
      });
    }
  }
}

export async function construirFacturaPdf(datos: DatosFacturaPdf): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(A4);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const cur: Cursor = { page, y: A4[1] - MARGEN };
  const anchoUtil = A4[0] - MARGEN * 2;

  // --- Encabezado: emisor + recuadro de la letra --------------------------------------------
  texto(cur, datos.emisor.razonSocial, { size: 14, font: bold });
  page.drawRectangle({
    x: A4[0] / 2 - 20,
    y: cur.y - 6,
    width: 40,
    height: 40,
    borderColor: NEGRO,
    borderWidth: 1,
  });
  page.drawText(datos.comprobante.letra, { x: A4[0] / 2 - 7, y: cur.y - 2, size: 22, font: bold });
  page.drawText(`COD. ${datos.comprobante.letra === 'A' ? '01' : datos.comprobante.letra === 'B' ? '06' : '11'}`, {
    x: A4[0] / 2 - 16,
    y: cur.y - 16,
    size: 6,
    font,
  });
  texto(cur, 'FACTURA', { x: A4[0] - MARGEN - 60, size: 12, font: bold });
  cur.y -= 16;
  texto(cur, datos.emisor.domicilio, { size: 8, font, color: GRIS });
  texto(cur, `Punto de venta: ${String(datos.comprobante.ptoVta).padStart(5, '0')}`, {
    x: A4[0] - MARGEN - 180,
    size: 9,
    font,
  });
  cur.y -= 12;
  texto(cur, `CUIT: ${datos.emisor.cuit}   IIBB: ${datos.emisor.iibb}`, { size: 8, font, color: GRIS });
  texto(cur, `Comp. Nro: ${String(datos.comprobante.nro).padStart(8, '0')}`, {
    x: A4[0] - MARGEN - 180,
    size: 9,
    font,
  });
  cur.y -= 12;
  texto(cur, `Inicio de actividades: ${fechaAr(datos.emisor.inicioActividades)}`, { size: 8, font, color: GRIS });
  texto(cur, `Fecha de emisión: ${fechaAr(datos.comprobante.fechaEmision)}`, {
    x: A4[0] - MARGEN - 180,
    size: 9,
    font,
  });

  cur.y -= 14;
  linea(cur);
  cur.y -= 16;

  // --- Banner de homologación --------------------------------------------------------------
  if (datos.comprobante.ambiente === 'homologacion') {
    page.drawRectangle({
      x: MARGEN,
      y: cur.y - 4,
      width: anchoUtil,
      height: 18,
      color: rgb(1, 0.95, 0.8),
    });
    texto(cur, 'HOMOLOGACIÓN — SIN VALOR FISCAL', { x: MARGEN + 6, size: 10, font: bold });
    cur.y -= 26;
  }

  // --- Receptor ---------------------------------------------------------------------------
  texto(cur, `Cliente: ${datos.receptor.razonSocial}`, { size: 10, font: bold });
  cur.y -= 12;
  texto(cur, `CUIT: ${datos.receptor.cuit}   Cond. IVA: ${datos.receptor.condicionIva}`, { size: 9, font });
  cur.y -= 12;
  texto(cur, `Domicilio: ${datos.receptor.domicilio || '-'}   Cond. venta: Cuenta corriente`, {
    size: 9,
    font,
  });
  cur.y -= 12;
  texto(
    cur,
    `Período facturado: ${String(datos.comprobante.mesFacturado).padStart(2, '0')}/${datos.comprobante.anioFacturado}` +
      `   Servicio: ${fechaAr(datos.comprobante.periodoDesde)} a ${fechaAr(datos.comprobante.periodoHasta)}`,
    { size: 9, font },
  );
  cur.y -= 12;
  texto(cur, `Vencimiento de pago: ${fechaAr(datos.comprobante.vtoPago)}`, { size: 9, font });

  cur.y -= 14;
  linea(cur);
  cur.y -= 16;

  // --- Detalle --------------------------------------------------------------------------
  texto(cur, 'Detalle', { size: 10, font: bold });
  cur.y -= 14;
  for (const parrafo of datos.detalle.descripcion.split('\n')) {
    texto(cur, parrafo.slice(0, 120), { size: 9, font });
    cur.y -= 12;
  }
  texto(
    cur,
    `Días facturados: ${datos.detalle.dias}  ·  Valor km: ${money(datos.detalle.valorKm)}  ·  Km: ${datos.detalle.cantidadKm}`,
    { size: 8, font, color: GRIS },
  );

  cur.y -= 16;
  linea(cur);
  cur.y -= 16;

  // --- Totales ------------------------------------------------------------------------
  const xTot = A4[0] - MARGEN - 200;
  texto(cur, `Neto:  ${money(datos.importes.neto)}`, { x: xTot, size: 9, font });
  cur.y -= 12;
  texto(cur, `IVA:   ${money(datos.importes.iva)}`, { x: xTot, size: 9, font });
  cur.y -= 12;
  texto(cur, `Total: ${money(datos.importes.total)}`, { x: xTot, size: 11, font: bold });

  cur.y -= 20;
  linea(cur);
  cur.y -= 16;

  // --- CAE + código de barras + QR (RG 4892) ----------------------------------------
  // El QR va a la derecha del bloque CAE/código de barras, alineado arriba con la línea del CAE.
  const yInicioCae = cur.y;
  const ladoQr = 84;
  dibujarQr(page, urlQrAfip({
    fechaEmision: datos.comprobante.fechaEmision,
    cuitEmisor: datos.emisor.cuit,
    ptoVta: datos.comprobante.ptoVta,
    tipoComprobante: datos.comprobante.letra,
    nroComprobante: datos.comprobante.nro,
    importeTotal: datos.importes.total,
    cuitReceptor: datos.receptor.cuit,
    cae: datos.cae.valor,
  }), { x: A4[0] - MARGEN - ladoQr, yArriba: yInicioCae + 10, lado: ladoQr });

  texto(cur, `CAE N°: ${datos.cae.valor}`, { size: 10, font: bold });
  texto(cur, `Fecha vto. CAE: ${fechaAr(datos.cae.vencimiento)}`, { x: MARGEN + 220, size: 9, font });
  cur.y -= 16;

  const barras = codigoBarrasAfip({
    cuitEmisor: datos.emisor.cuit,
    tipoComprobante: datos.comprobante.letra,
    ptoVta: datos.comprobante.ptoVta,
    cae: datos.cae.valor,
    caeVencimiento: datos.cae.vencimiento,
  });
  // Interleaved 2 of 5 simplificado: una barra fina/gruesa por dígito (representación visual, el
  // dato canónico es el string `barras` impreso debajo).
  let bx = MARGEN;
  for (const ch of barras) {
    const ancho = (Number(ch) % 2 === 0 ? 1.2 : 2.6);
    page.drawRectangle({ x: bx, y: cur.y - 30, width: ancho, height: 30, color: NEGRO });
    bx += ancho + 1.4;
  }
  cur.y -= 40;
  texto(cur, barras, { size: 7, font, color: GRIS });
  cur.y -= 12;
  texto(cur, 'Comprobante autorizado por ARCA. Verificá su validez escaneando el código QR.', {
    size: 7,
    font,
    color: GRIS,
  });

  // El bloque termina debajo de lo que sea más bajo: el texto o el QR.
  cur.y = Math.min(cur.y, yInicioCae + 10 - ladoQr) - 12;
  linea(cur);
  cur.y -= 16;

  // --- Anexo: asistencias del período ---------------------------------------------
  texto(cur, `Anexo — Asistencias del período (${datos.asistencias.length})`, { size: 10, font: bold });
  cur.y -= 14;
  texto(cur, 'Fecha        Prestación                 Dependencia -> Retorno', {
    size: 8,
    font: bold,
    color: GRIS,
  });
  cur.y -= 12;
  for (const a of datos.asistencias) {
    if (cur.y < MARGEN + 20) {
      cur.page = doc.addPage(A4);
      cur.y = A4[1] - MARGEN;
    }
    texto(
      cur,
      `${fechaAr(a.fecha)}   ${a.prestacion.slice(0, 24).padEnd(24)}   ${a.dependencia} -> ${a.retorno}`,
      { size: 8, font },
    );
    cur.y -= 11;
  }

  return doc.save();
}
