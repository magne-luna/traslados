// Edge Function: facturar
//
// Emisión electrónica real de una factura contra ARCA a través del miniserver `arca-miniserver`
// (contrato en `facturas/README.md`). Change: openspec/changes/facturacion-electronica-arca/
// (design.md D2). El frontend solo manda `{ facturaId }` — todo el armado del payload fiscal, la
// llamada al miniserver, el CAE, los snapshots congelados y el PDF ocurren acá.
//
// ⚠️ Identidad fiscal 100% por secrets (D1): ARCA_MINISERVER_URL, ARCA_MINISERVER_API_KEY,
// ARCA_CUIT, ARCA_CERT_B64, ARCA_KEY_B64, ARCA_PTO_VTA, ARCA_AMBIENTE (default homologacion).
// Overrides opcionales: ARCA_IVA_CODIGO (default IVA_21), ARCA_IVA_MODO (default por_dentro),
// ARCA_EMISOR_RAZON_SOCIAL / _DOMICILIO / _IIBB / _INICIO_ACT (para el PDF). Sin la config
// obligatoria -> 503 EMISION_NO_CONFIGURADA, la factura no cambia.
//
// Flujo (D2 pasos 1-10):
//   1. requirePermiso('facturacion','write')          -> 401/403
//   2. leer config ARCA_*                             -> 503 si falta
//   3. userClient: SELECT factura + asistencias        -> 404 / 409 YA_EMITIDA / 409 estado
//   4. admin: SELECT paciente + direcciones + obra_social + plantilla_campo + cobertura
//   5. construirPayloadArca (puro)                     -> 422 si tipo C / cuit / condicion_iva
//   6. fetch al miniserver (timeout 25s)               -> 502 identidad / 422 rechazo / 502 error
//   7. userClient.rpc(actualizar_factura_completa) con CAE + snapshots  -> 500 si falla (con cbteNro)
//   8. generar PDF (pdf-lib) + subir con admin a `facturas-emitidas`
//   9. userClient.rpc(...) con comprobante_pdf_url     (si el PDF falla: 200 igual, pdfPendiente:true)
//  10. re-SELECT y devolver la factura releída
//
// `userClient` para el SELECT de factura y las RPC (RLS de `facturacion` + auth.uid() en los
// triggers de auditoría). `admin` (service_role) para los SELECT auxiliares (paciente / obra
// social / cobertura: son insumos del documento fiscal, no todos los operadores de facturación
// tienen los módulos `pacientes` / `obra_social`) y para el upload a Storage.

import { requirePermiso, isAuthorized, jsonResponse, CORS_HEADERS } from '../_shared/auth.ts';
import {
  construirPayloadArca,
  parseRespuestaMiniserver,
  type ConfigArca,
  type IvaCodigoArca,
  type IvaModo,
  type AmbienteArca,
} from '../_shared/arca.ts';
import {
  calcularFechaEstimadaCobro,
  construirDatosDescripcion,
  renderDescripcionFactura,
  resolverIdentificadorFactura,
  type IdentificadorOrigenFactura,
  type PlantillaCampo,
} from '../_shared/emisionSnapshots.ts';
import { construirFacturaPdf, type DatosFacturaPdf } from './facturaPdf.ts';

const MODULO = 'facturacion';
const TIMEOUT_MINISERVER_MS = 25_000;

const SECRETS_OBLIGATORIOS = [
  'ARCA_MINISERVER_URL',
  'ARCA_MINISERVER_API_KEY',
  'ARCA_CUIT',
  'ARCA_CERT_B64',
  'ARCA_KEY_B64',
  'ARCA_PTO_VTA',
] as const;

interface ConfigEmision {
  url: string;
  apiKey: string;
  arca: ConfigArca;
  emisor: DatosFacturaPdf['emisor'];
}

function leerConfig(): ConfigEmision | null {
  for (const clave of SECRETS_OBLIGATORIOS) {
    if (!Deno.env.get(clave)) return null;
  }
  const ambiente = (Deno.env.get('ARCA_AMBIENTE') ?? 'homologacion') as AmbienteArca;
  return {
    url: Deno.env.get('ARCA_MINISERVER_URL')!.replace(/\/+$/, ''),
    apiKey: Deno.env.get('ARCA_MINISERVER_API_KEY')!,
    arca: {
      cuit: Number(String(Deno.env.get('ARCA_CUIT')).replace(/\D/g, '')),
      certB64: Deno.env.get('ARCA_CERT_B64')!,
      keyB64: Deno.env.get('ARCA_KEY_B64')!,
      ptoVta: Number(Deno.env.get('ARCA_PTO_VTA')),
      ambiente: ambiente === 'production' ? 'production' : 'homologacion',
      ivaCodigo: (Deno.env.get('ARCA_IVA_CODIGO') ?? 'IVA_21') as IvaCodigoArca,
      ivaModo: (Deno.env.get('ARCA_IVA_MODO') ?? 'por_dentro') as IvaModo,
    },
    emisor: {
      razonSocial: Deno.env.get('ARCA_EMISOR_RAZON_SOCIAL') ?? '',
      cuit: String(Deno.env.get('ARCA_CUIT') ?? ''),
      domicilio: Deno.env.get('ARCA_EMISOR_DOMICILIO') ?? '',
      iibb: Deno.env.get('ARCA_EMISOR_IIBB') ?? '',
      inicioActividades: Deno.env.get('ARCA_EMISOR_INICIO_ACT') ?? '',
    },
  };
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
function numero(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

async function jsonSeguro(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return undefined;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'método no soportado' });

  const ctx = await requirePermiso(req, MODULO, 'write');
  if (!isAuthorized(ctx)) return ctx;
  const { userClient, admin } = ctx;

  const config = leerConfig();
  if (!config) {
    return jsonResponse(503, {
      error: 'La emisión electrónica no está configurada.',
      codigo: 'EMISION_NO_CONFIGURADA',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { error: 'body inválido, se espera JSON' });
  }
  const facturaId = isRecord(body) ? texto(body.facturaId) : '';
  if (!facturaId) return jsonResponse(400, { error: 'falta facturaId' });

  // --- 3. Factura + asistencias (userClient: RLS de facturacion) -----------------------------
  const { data: facturaRow, error: errFactura } = await userClient
    .schema('facturacion')
    .from('facturas')
    .select('*, asistencia_prestacion ( id, fecha, prestacion, dependencia, retorno, factura_sabados )')
    .eq('id', facturaId)
    .maybeSingle();

  if (errFactura) return jsonResponse(400, { error: errFactura.message });
  if (!facturaRow || !isRecord(facturaRow)) return jsonResponse(404, { error: 'la factura no existe' });

  if (texto(facturaRow.cae)) {
    return jsonResponse(409, { error: 'la factura ya fue emitida', codigo: 'YA_EMITIDA', cae: texto(facturaRow.cae) });
  }
  if (texto(facturaRow.estado) !== 'a facturar') {
    return jsonResponse(409, { error: 'la factura no está en estado "a facturar"' });
  }

  // --- 4. Insumos del documento fiscal (admin: no dependen de módulos del operador) ----------
  const pacienteId = texto(facturaRow.paciente_id);
  const { data: pacienteRow } = await admin
    .schema('pacientes')
    .from('paciente')
    .select('id, nombre_a, apellido_a, dni, amparo_judicial, obra_social_id')
    .eq('id', pacienteId)
    .maybeSingle();
  if (!pacienteRow || !isRecord(pacienteRow)) return jsonResponse(404, { error: 'el paciente de la factura no existe' });

  const obraSocialId = texto(pacienteRow.obra_social_id);
  const { data: obraSocialRow } = await admin
    .schema('obra_social')
    .from('obra_social')
    .select('id, razon_social, cuit, direccion, condicion_iva, plazo_cobro_dias, identificador_origen')
    .eq('id', obraSocialId)
    .maybeSingle();
  if (!obraSocialRow || !isRecord(obraSocialRow)) {
    return jsonResponse(422, { error: 'el paciente no tiene obra social asociada', codigo: 'EMISION_SIN_OBRA_SOCIAL' });
  }

  const { data: direccionesRows } = await admin
    .schema('pacientes')
    .from('direcciones')
    .select('id, calle, localidad')
    .eq('paciente_id', pacienteId);

  const { data: plantillaRows } = await admin
    .schema('obra_social')
    .from('plantilla_campo')
    .select('id, etiqueta, origen, orden')
    .eq('obra_social_id', obraSocialId);

  const { data: coberturaRow } = await admin
    .schema('obra_social')
    .from('coberturas_paciente')
    .select('num_afiliado')
    .eq('paciente_id', pacienteId)
    .eq('obra_social_id', obraSocialId)
    .order('fecha_desde', { ascending: false })
    .limit(1)
    .maybeSingle();

  // --- 5. Payload ARCA (puro) -------------------------------------------------------------
  const tipoComprobante = (texto(facturaRow.tipo) || 'A') as 'A' | 'B' | 'C';
  const resPayload = construirPayloadArca(
    {
      tipoComprobante,
      monto: numero(facturaRow.monto),
      fechaInicial: texto(facturaRow.fecha_init),
      fechaTope: texto(facturaRow.fecha_tope),
      fechaEstimadaCobro: texto(facturaRow.fecha_estimada_cobro) || undefined,
    },
    { cuit: texto(obraSocialRow.cuit), condicionIva: texto(obraSocialRow.condicion_iva) || undefined },
    config.arca,
  );
  if (!resPayload.ok) {
    return jsonResponse(resPayload.status, { error: resPayload.detalle, codigo: resPayload.codigo });
  }

  // --- 6. Llamada al miniserver ---------------------------------------------------------
  let respuestaMini: Response;
  try {
    respuestaMini = await fetch(`${config.url}/facturar`, {
      method: 'POST',
      headers: { 'X-Api-Key': config.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(resPayload.payload),
      signal: AbortSignal.timeout(TIMEOUT_MINISERVER_MS),
    });
  } catch (_e) {
    return jsonResponse(502, {
      error: 'El servicio de facturación de ARCA no respondió.',
      codigo: 'ARCA_ERROR',
    });
  }

  const resArca = parseRespuestaMiniserver(respuestaMini.status, await jsonSeguro(respuestaMini));
  if (!resArca.ok) {
    // Traza de diagnóstico (nunca loguea cert/key ni el payload fiscal): sin esto, un rechazo de
    // ARCA no deja ningún rastro en los logs de la función y hay que ir a mirar el miniserver.
    // Cubre los tres códigos: ARCA_IDENTIDAD (502), ARCA_RECHAZO (422), ARCA_ERROR (502).
    console.error('facturar: ARCA no aprobó el comprobante', {
      facturaId,
      tipoComprobante,
      miniserverStatus: respuestaMini.status,
      codigo: resArca.codigo,
      detalle: resArca.detalle,
      observaciones: resArca.observaciones,
      cbteNro: resArca.cbteNro,
    });
    return jsonResponse(resArca.status, {
      error: resArca.detalle,
      codigo: resArca.codigo,
      observaciones: resArca.observaciones,
      cbteNro: resArca.cbteNro,
    });
  }
  const emision = resArca.datos;

  // --- 7. Snapshots + persistencia del CAE (userClient) --------------------------------
  const fechaFactura = new Date().toISOString().slice(0, 10);
  const fechaEstimadaCobro = calcularFechaEstimadaCobro({
    fechaFactura,
    amparoJudicial: pacienteRow.amparo_judicial === true,
    plazoObraSocial:
      obraSocialRow.plazo_cobro_dias === null || obraSocialRow.plazo_cobro_dias === undefined
        ? undefined
        : numero(obraSocialRow.plazo_cobro_dias),
  });

  const identificadorOrigen = (texto(obraSocialRow.identificador_origen) ||
    'paciente.numeroAfiliado') as IdentificadorOrigenFactura;
  const numAfiliado = coberturaRow && isRecord(coberturaRow) ? texto(coberturaRow.num_afiliado) : '';
  const identificador = resolverIdentificadorFactura(
    { dni: texto(pacienteRow.dni), numeroAfiliadoValor: numAfiliado },
    identificadorOrigen,
  );

  const campos: PlantillaCampo[] = Array.isArray(plantillaRows)
    ? plantillaRows
        .filter(isRecord)
        .map((r) => ({
          id: texto(r.id),
          etiqueta: texto(r.etiqueta),
          origen: texto(r.origen) as PlantillaCampo['origen'],
          orden: numero(r.orden),
        }))
    : [];
  const direcciones = Array.isArray(direccionesRows)
    ? direccionesRows.filter(isRecord).map((r) => ({ id: texto(r.id), calle: texto(r.calle), localidad: texto(r.localidad) }))
    : [];

  const descripcion = renderDescripcionFactura(
    campos,
    construirDatosDescripcion(
      {
        prestacion: texto(facturaRow.prestacion),
        mesFacturado: numero(facturaRow.mes_facturado),
        anioFacturado: numero(facturaRow.anio_facturado),
        dias: numero(facturaRow.dias),
        dependenciaYRetorno: texto(facturaRow.dependencia_y_retorno),
        valorKm: numero(facturaRow.valor_km),
        cantidadKm: numero(facturaRow.cantidad_km),
        monto: numero(facturaRow.monto),
        domicilioId: texto(facturaRow.domicilio_id),
      },
      {
        nombre: texto(pacienteRow.nombre_a),
        apellido: texto(pacienteRow.apellido_a),
        dni: texto(pacienteRow.dni),
        numeroAfiliadoValor: numAfiliado,
        direcciones,
      },
    ),
  );

  const { error: errPersistir } = await userClient
    .schema('facturacion')
    .rpc('actualizar_factura_completa', {
      p_id: facturaId,
      p_cambios: {
        estado: 'facturado',
        fecha_factura: fechaFactura,
        fecha_estimada_cobro: fechaEstimadaCobro,
        identificador_origen: identificador.origen,
        identificador_valor: identificador.valor,
        descripcion,
        cae: emision.cae,
        cae_vencimiento: emision.caeVencimiento,
        cbte_nro: emision.cbteNro,
        pto_vta: config.arca.ptoVta,
        arca_ambiente: config.arca.ambiente,
        arca_respuesta: { importes: emision.importes, cae: emision.cae, caeVencimiento: emision.caeVencimiento, cbteNro: emision.cbteNro },
      },
    });

  if (errPersistir) {
    console.error('facturar: CAE obtenido pero falló la persistencia', { facturaId, cbteNro: emision.cbteNro, error: errPersistir.message });
    return jsonResponse(500, {
      error: 'La factura se emitió en ARCA pero no se pudo guardar.',
      cbteNro: emision.cbteNro,
      cae: emision.cae,
    });
  }

  // --- 8-9. PDF -> Storage (si falla, la factura ya está emitida: 200 con pdfPendiente) -----
  let pdfPendiente = false;
  const cbteTipo = tipoComprobante === 'A' ? 'FACTURA_A' : tipoComprobante === 'B' ? 'FACTURA_B' : 'FACTURA_C';
  const clavePdf = `${facturaId}/${cbteTipo}-${config.arca.ptoVta}-${emision.cbteNro}.pdf`;
  try {
    const domicilioFactura = direcciones.find((d) => d.id === texto(facturaRow.domicilio_id));
    const pdf = await construirFacturaPdf({
      emisor: config.emisor,
      receptor: {
        razonSocial: texto(obraSocialRow.razon_social),
        cuit: texto(obraSocialRow.cuit),
        condicionIva: texto(obraSocialRow.condicion_iva),
        domicilio: texto(obraSocialRow.direccion),
      },
      comprobante: {
        letra: tipoComprobante,
        ptoVta: config.arca.ptoVta,
        nro: emision.cbteNro,
        fechaEmision: fechaFactura,
        periodoDesde: texto(facturaRow.fecha_init),
        periodoHasta: texto(facturaRow.fecha_tope),
        vtoPago: fechaEstimadaCobro,
        mesFacturado: numero(facturaRow.mes_facturado),
        anioFacturado: numero(facturaRow.anio_facturado),
        ambiente: config.arca.ambiente,
      },
      detalle: {
        descripcion,
        dias: numero(facturaRow.dias),
        valorKm: numero(facturaRow.valor_km),
        cantidadKm: numero(facturaRow.cantidad_km),
      },
      importes: emision.importes,
      cae: { valor: emision.cae, vencimiento: emision.caeVencimiento },
      asistencias: Array.isArray(facturaRow.asistencia_prestacion)
        ? facturaRow.asistencia_prestacion.filter(isRecord).map((a) => ({
            fecha: texto(a.fecha),
            prestacion: texto(a.prestacion),
            dependencia: texto(a.dependencia),
            retorno: texto(a.retorno),
          }))
        : [],
    });

    const { error: errUpload } = await admin.storage
      .from('facturas-emitidas')
      .upload(clavePdf, pdf, { contentType: 'application/pdf', upsert: true });
    if (errUpload) throw errUpload;

    const { error: errUrl } = await userClient
      .schema('facturacion')
      .rpc('actualizar_factura_completa', { p_id: facturaId, p_cambios: { comprobante_pdf_url: clavePdf } });
    if (errUrl) throw errUrl;
  } catch (e) {
    pdfPendiente = true;
    console.error('facturar: CAE persistido pero falló el PDF/Storage', { facturaId, error: e instanceof Error ? e.message : String(e) });
  }

  // --- 10. Re-SELECT y respuesta ------------------------------------------------------
  const { data: facturaFinal } = await userClient
    .schema('facturacion')
    .from('facturas')
    .select('*, asistencia_prestacion ( id, fecha, prestacion, dependencia, retorno, factura_sabados )')
    .eq('id', facturaId)
    .maybeSingle();

  return jsonResponse(200, pdfPendiente ? { ...(facturaFinal as Record<string, unknown>), pdfPendiente: true } : facturaFinal);
});
