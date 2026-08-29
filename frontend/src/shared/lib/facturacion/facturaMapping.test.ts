import { describe, expect, it } from 'vitest';
import type { ActualizacionFactura, AsistenciaPrestacion, NuevaFactura, NuevoCobro } from '../../types/factura';
import {
  ensamblarFactura,
  estadoDesdeBase,
  estadoHaciaBase,
  parseAsistenciaRow,
  parseCobroRow,
  parseFacturaRow,
  toActualizarFacturaPayload,
  toCrearCobroPayload,
  toCrearFacturaPayload,
} from './facturaMapping';

// Mapeo puro fila<->dominio para Facturación (design.md D1/D2/D5/D7/D11 de integracion-facturacion,
// tasks.md sección 2). Sin red, sin `any`, sin `as` sobre datos externos. Nombres de tabla/columna
// tomados literalmente del schema real (verificado con `supabase db query --linked`, ver design.md
// §Context), no del docx: `fecha_init`/`fecha_tope`/`tipo`/`cantidad_km`/`mes_facturado`/
// `anio_facturado`/`dependencia_y_retorno`/`fecha_estimada_cobro`/`fecha_factura`/`domicilio_id`/
// `identificador_origen`+`identificador_valor`.

function filaFacturaCompleta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'factura-1',
    paciente_id: 'paciente-1',
    descripcion: 'Traslados marzo',
    dias: 20,
    valor_km: 150,
    monto: 45000,
    estado: 'a facturar',
    fecha_init: '2026-03-01',
    fecha_tope: '2026-03-31',
    tipo: 'A',
    cantidad_km: 320,
    fecha_estimada_cobro: '2026-06-01',
    fecha_factura: '2026-04-02',
    prestacion: 'Traslado ida y vuelta',
    mes_facturado: 3,
    anio_facturado: 2026,
    dependencia_y_retorno: 'Domicilio - Centro de día',
    domicilio_id: 'domicilio-1',
    identificador_origen: 'paciente.dni',
    identificador_valor: '30123456',
    autorizacion_id: 'autorizacion-1',
    asistencia_prestacion: [],
    ...overrides,
  };
}

function filaAsistenciaCompleta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'asistencia-1',
    fecha: '2026-03-05',
    prestacion: 'Traslado',
    dependencia: 'Domicilio',
    retorno: 'Centro de día',
    factura_sabados: false,
    ...overrides,
  };
}

// -------------------------------------------------------------------------------------------
// 2.1 — parseFacturaRow: los 11 renombres de columna
// -------------------------------------------------------------------------------------------

describe('parseFacturaRow (2.1) — renombres de columna', () => {
  it('mapea una fila completa con los 11 renombres de D1', () => {
    const factura = parseFacturaRow(filaFacturaCompleta());

    expect(factura).toMatchObject({
      id: 'factura-1',
      pacienteId: 'paciente-1',
      fechaInicial: '2026-03-01',
      fechaTope: '2026-03-31',
      tipoComprobante: 'A',
      valorKm: 150,
      cantidadKm: 320,
      mesFacturado: 3,
      anioFacturado: 2026,
      dependenciaYRetorno: 'Domicilio - Centro de día',
      fechaEstimadaCobro: '2026-06-01',
      fechaFactura: '2026-04-02',
      domicilioId: 'domicilio-1',
    });
  });

  it('segundo caso (triangulación): otra fila con valores distintos mapea igual de bien', () => {
    const factura = parseFacturaRow(
      filaFacturaCompleta({
        fecha_init: '2026-05-10',
        fecha_tope: '2026-05-25',
        tipo: 'B',
        valor_km: 200,
        cantidad_km: 80,
        mes_facturado: 5,
        anio_facturado: 2026,
        dependencia_y_retorno: 'Hospital - Domicilio',
        fecha_estimada_cobro: '2026-08-10',
        fecha_factura: '2026-06-01',
        domicilio_id: 'domicilio-2',
      }),
    );

    expect(factura).toMatchObject({
      fechaInicial: '2026-05-10',
      fechaTope: '2026-05-25',
      tipoComprobante: 'B',
      valorKm: 200,
      cantidadKm: 80,
      mesFacturado: 5,
      anioFacturado: 2026,
      dependenciaYRetorno: 'Hospital - Domicilio',
      fechaEstimadaCobro: '2026-08-10',
      fechaFactura: '2026-06-01',
      domicilioId: 'domicilio-2',
    });
  });

  it('un valor que no es objeto devuelve una factura base vacía en vez de crashear', () => {
    const factura = parseFacturaRow('no soy una fila');
    expect(factura.id).toBe('');
    expect(factura.pacienteId).toBe('');
  });
});

// -------------------------------------------------------------------------------------------
// 2.2 — estadoDesdeBase: total, 5 literales reales + desconocido
// -------------------------------------------------------------------------------------------

describe('estadoDesdeBase (2.2)', () => {
  it('los cinco literales reales de la base mapean al dominio', () => {
    expect(estadoDesdeBase('a facturar')).toBe('a-facturar');
    expect(estadoDesdeBase('pendiente')).toBe('a-facturar');
    expect(estadoDesdeBase('facturado')).toBe('facturado');
    expect(estadoDesdeBase('cobrado')).toBe('cobrado');
    expect(estadoDesdeBase('pagado parcialmente')).toBe('pagado-parcialmente');
  });

  it('"pendiente" es sinónimo explícito de "a-facturar" (triangulación del literal más importante)', () => {
    expect(estadoDesdeBase('pendiente')).toBe(estadoDesdeBase('a facturar'));
  });

  it('un literal desconocido cae a "a-facturar" (función total, nunca lanza)', () => {
    expect(estadoDesdeBase('estado-inventado')).toBe('a-facturar');
    expect(estadoDesdeBase(null)).toBe('a-facturar');
    expect(estadoDesdeBase(undefined)).toBe('a-facturar');
    expect(estadoDesdeBase(42)).toBe('a-facturar');
  });
});

// -------------------------------------------------------------------------------------------
// 2.3 — estadoHaciaBase: 4 estados -> 4 literales con espacio, nunca 'pendiente'
// -------------------------------------------------------------------------------------------

describe('estadoHaciaBase (2.3)', () => {
  it('mapea los 4 estados del dominio a los 4 literales reales con espacio', () => {
    expect(estadoHaciaBase('a-facturar')).toBe('a facturar');
    expect(estadoHaciaBase('facturado')).toBe('facturado');
    expect(estadoHaciaBase('cobrado')).toBe('cobrado');
    expect(estadoHaciaBase('pagado-parcialmente')).toBe('pagado parcialmente');
  });

  it('nunca emite "pendiente" para ninguno de los 4 estados del dominio', () => {
    const emitidos = (['a-facturar', 'facturado', 'cobrado', 'pagado-parcialmente'] as const).map(estadoHaciaBase);
    expect(emitidos).not.toContain('pendiente');
  });
});

// -------------------------------------------------------------------------------------------
// 2.4 — colapso identificador_origen + identificador_valor -> identificadorFactura
// -------------------------------------------------------------------------------------------

describe('parseFacturaRow (2.4) — colapso del identificador de factura', () => {
  it('con las dos columnas presentes, arma el objeto identificadorFactura', () => {
    const factura = parseFacturaRow(
      filaFacturaCompleta({ identificador_origen: 'paciente.numeroAfiliado', identificador_valor: 'AF-9090' }),
    );

    expect(factura.identificadorFactura).toEqual({ origen: 'paciente.numeroAfiliado', valor: 'AF-9090' });
  });

  it('con identificador_origen NULL, el campo queda ausente (no un objeto con string vacío)', () => {
    const factura = parseFacturaRow(filaFacturaCompleta({ identificador_origen: null }));
    expect(factura.identificadorFactura).toBeUndefined();
  });

  it('con identificador_valor NULL, el campo queda ausente (no un objeto con string vacío)', () => {
    const factura = parseFacturaRow(filaFacturaCompleta({ identificador_valor: null }));
    expect(factura.identificadorFactura).toBeUndefined();
  });

  it('con las dos columnas NULL, el campo queda ausente', () => {
    const factura = parseFacturaRow(filaFacturaCompleta({ identificador_origen: null, identificador_valor: null }));
    expect(factura.identificadorFactura).toBeUndefined();
  });
});

// -------------------------------------------------------------------------------------------
// 2.5 — parseAsistenciaRow + ordenamiento client-side
// -------------------------------------------------------------------------------------------

describe('parseAsistenciaRow (2.5)', () => {
  it('mapea una fila completa, incluido factura_sabados -> facturaSabados', () => {
    const asistencia = parseAsistenciaRow(filaAsistenciaCompleta({ factura_sabados: true }));

    expect(asistencia).toEqual({
      id: 'asistencia-1',
      fecha: '2026-03-05',
      prestacion: 'Traslado',
      dependencia: 'Domicilio',
      retorno: 'Centro de día',
      facturaSabados: true,
    });
  });

  it('segundo caso (triangulación): factura_sabados false se preserva', () => {
    const asistencia = parseAsistenciaRow(filaAsistenciaCompleta({ id: 'asistencia-2', factura_sabados: false }));
    expect(asistencia?.facturaSabados).toBe(false);
  });

  it('fila sin fecha se descarta (malformada): devuelve null', () => {
    const fila = filaAsistenciaCompleta();
    delete fila.fecha;
    expect(parseAsistenciaRow(fila)).toBeNull();
  });

  it('fila sin id se descarta (malformada): devuelve null', () => {
    const fila = filaAsistenciaCompleta();
    delete fila.id;
    expect(parseAsistenciaRow(fila)).toBeNull();
  });

  it('un valor que no es objeto devuelve null', () => {
    expect(parseAsistenciaRow('no soy una fila')).toBeNull();
    expect(parseAsistenciaRow(null)).toBeNull();
  });
});

describe('ensamblarFactura (2.5) — orden client-side de asistencias, fecha asc con desempate por id', () => {
  it('colección vacía: asistencias queda en []', () => {
    const factura = ensamblarFactura(filaFacturaCompleta({ asistencia_prestacion: [] }));
    expect(factura.asistencias).toEqual([]);
  });

  it('ordena por fecha ascendente', () => {
    const factura = ensamblarFactura(
      filaFacturaCompleta({
        asistencia_prestacion: [
          filaAsistenciaCompleta({ id: 'a-2', fecha: '2026-03-20' }),
          filaAsistenciaCompleta({ id: 'a-1', fecha: '2026-03-05' }),
        ],
      }),
    );

    expect(factura.asistencias.map((a) => a.id)).toEqual(['a-1', 'a-2']);
  });

  it('desempata por id cuando dos asistencias tienen la misma fecha (orden estable entre lecturas)', () => {
    const fila = filaFacturaCompleta({
      asistencia_prestacion: [
        filaAsistenciaCompleta({ id: 'b', fecha: '2026-03-05' }),
        filaAsistenciaCompleta({ id: 'a', fecha: '2026-03-05' }),
      ],
    });

    const primeraVez = ensamblarFactura(fila).asistencias.map((a) => a.id);
    const segundaVez = ensamblarFactura(fila).asistencias.map((a) => a.id);

    expect(primeraVez).toEqual(['a', 'b']);
    expect(segundaVez).toEqual(['a', 'b']);
  });

  it('una fila hija malformada se descarta sin romper el resto de la factura', () => {
    const filaMalformada = filaAsistenciaCompleta();
    delete filaMalformada.fecha;

    const factura = ensamblarFactura(
      filaFacturaCompleta({
        asistencia_prestacion: [filaAsistenciaCompleta({ id: 'a-1', fecha: '2026-03-05' }), filaMalformada],
      }),
    );

    expect(factura.asistencias).toHaveLength(1);
    expect(factura.asistencias[0]?.id).toBe('a-1');
  });

  it('asistencia_prestacion ausente o no-array no rompe el ensamblado: queda []', () => {
    expect(ensamblarFactura(filaFacturaCompleta({ asistencia_prestacion: undefined })).asistencias).toEqual([]);
    expect(ensamblarFactura(filaFacturaCompleta({ asistencia_prestacion: null })).asistencias).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------
// 2.6 — Nullability (D11): defaults coherentes, cero `undefined` filtrándose
// -------------------------------------------------------------------------------------------

describe('parseFacturaRow (2.6) — nullability D11', () => {
  it('todas las columnas nullables en NULL producen una factura coherente con el tipo, sin undefined', () => {
    const factura = parseFacturaRow(
      filaFacturaCompleta({
        monto: null,
        dias: null,
        valor_km: null,
        cantidad_km: null,
        prestacion: null,
        dependencia_y_retorno: null,
        mes_facturado: null,
        anio_facturado: null,
        domicilio_id: null,
        fecha_init: null,
        fecha_tope: null,
        tipo: null,
        estado: null,
      }),
    );

    expect(factura).toMatchObject({
      monto: 0,
      dias: 0,
      valorKm: 0,
      cantidadKm: 0,
      prestacion: '',
      dependenciaYRetorno: '',
      mesFacturado: 0,
      anioFacturado: 0,
      domicilioId: '',
      fechaInicial: '',
      fechaTope: '',
      tipoComprobante: 'A',
      estado: 'a-facturar',
    });

    expect(Object.values(factura)).not.toContain(undefined);
  });

  it('segundo caso (triangulación): columnas ausentes del todo (no solo NULL) producen el mismo default', () => {
    const fila = filaFacturaCompleta();
    delete fila.monto;
    delete fila.dias;
    delete fila.tipo;
    delete fila.estado;

    const factura = parseFacturaRow(fila);

    expect(factura).toMatchObject({ monto: 0, dias: 0, tipoComprobante: 'A', estado: 'a-facturar' });
  });

  it('descripción y prestación ausentes no filtran undefined a la UI', () => {
    const factura = parseFacturaRow(filaFacturaCompleta({ descripcion: null }));
    expect(factura.descripcion).toBe('');
  });
});

describe('parseAsistenciaRow (2.6) — nullability D11: dependencia/retorno', () => {
  it('dependencia y retorno NULL producen string vacío, no undefined', () => {
    const asistencia = parseAsistenciaRow(filaAsistenciaCompleta({ dependencia: null, retorno: null }));
    expect(asistencia).toMatchObject({ dependencia: '', retorno: '' });
  });

  it('segundo caso (triangulación): solo retorno NULL, dependencia se conserva', () => {
    const asistencia = parseAsistenciaRow(filaAsistenciaCompleta({ retorno: null }));
    expect(asistencia).toMatchObject({ dependencia: 'Domicilio', retorno: '' });
  });
});

// -------------------------------------------------------------------------------------------
// 2.7 — parseCobroRow
// -------------------------------------------------------------------------------------------

function filaCobroCompleta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'cobro-1',
    facturas_id: 'factura-1',
    fecha: '2026-06-10',
    monto_pagado: 15000,
    ...overrides,
  };
}

describe('parseCobroRow (2.7)', () => {
  it('mapea facturas_id (plural) -> facturaId y monto_pagado -> montoPagado', () => {
    const cobro = parseCobroRow(filaCobroCompleta());

    expect(cobro).toEqual({
      id: 'cobro-1',
      facturaId: 'factura-1',
      fecha: '2026-06-10',
      montoPagado: 15000,
    });
  });

  it('segundo caso (triangulación): otro valor de facturas_id mapea igual de bien', () => {
    const cobro = parseCobroRow(filaCobroCompleta({ facturas_id: 'factura-9', monto_pagado: 500 }));
    expect(cobro.facturaId).toBe('factura-9');
    expect(cobro.montoPagado).toBe(500);
  });

  it('un valor que no es objeto no crashea: devuelve un cobro con defaults', () => {
    const cobro = parseCobroRow('no soy una fila');
    expect(cobro).toEqual({ id: '', facturaId: '', fecha: '', montoPagado: 0 });
  });
});

// -------------------------------------------------------------------------------------------
// 2.2 (facturacion-seleccion-autorizacion) — parseFacturaRow: autorizacion_id -> autorizacionId
// -------------------------------------------------------------------------------------------

describe('parseFacturaRow (2.2, facturacion-seleccion-autorizacion) — autorizacion_id', () => {
  it('columna con uuid presente mapea a autorizacionId', () => {
    const factura = parseFacturaRow(filaFacturaCompleta({ autorizacion_id: 'autorizacion-1' }));
    expect(factura.autorizacionId).toBe('autorizacion-1');
  });

  it('columna NULL (triangulación) produce el campo undefined, nunca null ni string vacío', () => {
    const factura = parseFacturaRow(filaFacturaCompleta({ autorizacion_id: null }));
    expect(factura.autorizacionId).toBeUndefined();
  });
});

// -------------------------------------------------------------------------------------------
// facturacion-electronica-arca 4.2 — comprobante fiscal: 6 renombres snake->camel, ausentes si NULL
// -------------------------------------------------------------------------------------------

describe('parseFacturaRow (facturacion-electronica-arca) — campos del comprobante fiscal', () => {
  const filaEmitida = {
    cae: '75123456789012',
    cae_vencimiento: '2026-04-12',
    cbte_nro: 45,
    pto_vta: 3,
    arca_ambiente: 'production',
    comprobante_pdf_url: 'factura-1/FACTURA_A-3-45.pdf',
    arca_respuesta: { aprobada: true, cae: '75123456789012' },
  };

  it('mapea las 6 columnas del comprobante emitido a camelCase', () => {
    const factura = parseFacturaRow(filaFacturaCompleta(filaEmitida));

    expect(factura).toMatchObject({
      cae: '75123456789012',
      caeVencimiento: '2026-04-12',
      cbteNro: 45,
      ptoVta: 3,
      arcaAmbiente: 'production',
      comprobantePdfUrl: 'factura-1/FACTURA_A-3-45.pdf',
    });
  });

  it('segundo caso (triangulación): homologación con otros valores mapea igual de bien', () => {
    const factura = parseFacturaRow(
      filaFacturaCompleta({ ...filaEmitida, arca_ambiente: 'homologacion', cbte_nro: 7, pto_vta: 1 }),
    );
    expect(factura).toMatchObject({ arcaAmbiente: 'homologacion', cbteNro: 7, ptoVta: 1 });
  });

  it('una factura en a-facturar (todas las columnas fiscales NULL) deja los 6 campos ausentes', () => {
    const factura = parseFacturaRow(
      filaFacturaCompleta({
        cae: null,
        cae_vencimiento: null,
        cbte_nro: null,
        pto_vta: null,
        arca_ambiente: null,
        comprobante_pdf_url: null,
      }),
    );

    expect(factura.cae).toBeUndefined();
    expect(factura.caeVencimiento).toBeUndefined();
    expect(factura.cbteNro).toBeUndefined();
    expect(factura.ptoVta).toBeUndefined();
    expect(factura.arcaAmbiente).toBeUndefined();
    expect(factura.comprobantePdfUrl).toBeUndefined();
  });

  it('las columnas fiscales ausentes del todo (no solo NULL) tampoco filtran undefined a un valor', () => {
    const fila = filaFacturaCompleta();
    const factura = parseFacturaRow(fila);
    expect('cae' in factura).toBe(false);
    expect('cbteNro' in factura).toBe(false);
  });

  it('arca_ambiente con un valor fuera de la unión cerrada queda ausente, no se filtra', () => {
    const factura = parseFacturaRow(filaFacturaCompleta({ ...filaEmitida, arca_ambiente: 'staging' }));
    expect(factura.arcaAmbiente).toBeUndefined();
  });

  it('arca_respuesta NO se expone al dominio del frontend (es auditoría de servidor)', () => {
    const factura = parseFacturaRow(filaFacturaCompleta(filaEmitida));
    expect('arcaRespuesta' in factura).toBe(false);
    expect(Object.values(factura)).not.toContainEqual(filaEmitida.arca_respuesta);
  });
});

describe('toActualizarFacturaPayload (facturacion-electronica-arca) — campos del comprobante fiscal', () => {
  it('cada campo fiscal presente viaja con su renombre snake_case', () => {
    const payload = toActualizarFacturaPayload({
      cae: '75123456789012',
      caeVencimiento: '2026-04-12',
      cbteNro: 45,
      ptoVta: 3,
      arcaAmbiente: 'production',
      comprobantePdfUrl: 'factura-1/FACTURA_A-3-45.pdf',
    });

    expect(payload).toEqual({
      cae: '75123456789012',
      cae_vencimiento: '2026-04-12',
      cbte_nro: 45,
      pto_vta: 3,
      arca_ambiente: 'production',
      comprobante_pdf_url: 'factura-1/FACTURA_A-3-45.pdf',
    });
  });

  it('editar solo el estado no arrastra ninguna clave fiscal (semántica parcial)', () => {
    const payload = toActualizarFacturaPayload({ estado: 'cobrado' });
    expect('cae' in payload).toBe(false);
    expect('cbte_nro' in payload).toBe(false);
    expect('comprobante_pdf_url' in payload).toBe(false);
  });
});

// -------------------------------------------------------------------------------------------
// 2.8 — toCrearFacturaPayload
// -------------------------------------------------------------------------------------------

function asistenciaMinima(overrides: Partial<AsistenciaPrestacion> = {}): AsistenciaPrestacion {
  return {
    id: 'asistencia-1',
    fecha: '2026-03-05',
    prestacion: 'Traslado',
    dependencia: 'Domicilio',
    retorno: 'Centro de día',
    facturaSabados: false,
    ...overrides,
  };
}

function nuevaFacturaMinima(overrides: Partial<NuevaFactura> = {}): NuevaFactura {
  return {
    pacienteId: 'paciente-1',
    descripcion: 'Traslados marzo',
    dias: 20,
    valorKm: 150,
    monto: 45000,
    estado: 'a-facturar',
    fechaInicial: '2026-03-01',
    fechaTope: '2026-03-31',
    tipoComprobante: 'A',
    cantidadKm: 320,
    prestacion: 'Traslado ida y vuelta',
    mesFacturado: 3,
    anioFacturado: 2026,
    dependenciaYRetorno: 'Domicilio - Centro de día',
    domicilioId: 'domicilio-1',
    asistencias: [asistenciaMinima()],
    ...overrides,
  };
}

describe('toCrearFacturaPayload (2.8)', () => {
  it('arma el jsonb con las asistencias anidadas y el estado convertido con estadoHaciaBase', () => {
    const payload = toCrearFacturaPayload(nuevaFacturaMinima());

    expect(payload).toMatchObject({
      paciente_id: 'paciente-1',
      descripcion: 'Traslados marzo',
      dias: 20,
      valor_km: 150,
      monto: 45000,
      estado: 'a facturar',
      fecha_init: '2026-03-01',
      fecha_tope: '2026-03-31',
      tipo: 'A',
      cantidad_km: 320,
      prestacion: 'Traslado ida y vuelta',
      mes_facturado: 3,
      anio_facturado: 2026,
      dependencia_y_retorno: 'Domicilio - Centro de día',
      domicilio_id: 'domicilio-1',
    });

    expect(payload.asistencias).toEqual([
      {
        fecha: '2026-03-05',
        prestacion: 'Traslado',
        dependencia: 'Domicilio',
        retorno: 'Centro de día',
        factura_sabados: false,
      },
    ]);
  });

  it('con identificadorFactura presente, viajan identificador_origen e identificador_valor', () => {
    const payload = toCrearFacturaPayload(
      nuevaFacturaMinima({ identificadorFactura: { origen: 'paciente.dni', valor: '30123456' } }),
    );

    expect(payload.identificador_origen).toBe('paciente.dni');
    expect(payload.identificador_valor).toBe('30123456');
  });

  it('sin identificadorFactura (factura no emitida), las dos columnas van en null', () => {
    const payload = toCrearFacturaPayload(nuevaFacturaMinima());
    expect(payload.identificador_origen).toBeNull();
    expect(payload.identificador_valor).toBeNull();
  });

  it('estado facturado se convierte a "facturado", no a un literal inventado', () => {
    const payload = toCrearFacturaPayload(nuevaFacturaMinima({ estado: 'facturado' }));
    expect(payload.estado).toBe('facturado');
  });

  // 2.3 (facturacion-seleccion-autorizacion) — autorizacionId presente/ausente en el alta.
  it('con autorización elegida, el payload incluye autorizacion_id con ese valor', () => {
    const payload = toCrearFacturaPayload(nuevaFacturaMinima({ autorizacionId: 'autorizacion-1' }));
    expect(payload.autorizacion_id).toBe('autorizacion-1');
  });

  it('sin autorización elegida (triangulación), autorizacion_id viaja en null', () => {
    const payload = toCrearFacturaPayload(nuevaFacturaMinima());
    expect(payload.autorizacion_id).toBeNull();
  });

  // 2.7 (facturacion-seleccion-autorizacion, design.md D1) — relación N:1: `autorizacion_id` NO es
  // `UNIQUE` en la base (una autorización = un cupo mensual recurrente, factura por mes). El mapeo
  // no impone ninguna restricción propia: dos facturas con la MISMA autorización en meses distintos
  // producen dos payloads válidos e independientes, sin que ninguno de los dos rechace ni mute al
  // otro.
  it('dos facturas con la misma autorizacionId en meses distintos se aceptan sin restricción de unicidad (N:1, D1)', () => {
    const facturaMarzo = toCrearFacturaPayload(nuevaFacturaMinima({ autorizacionId: 'autorizacion-1', mesFacturado: 3 }));
    const facturaAbril = toCrearFacturaPayload(nuevaFacturaMinima({ autorizacionId: 'autorizacion-1', mesFacturado: 4 }));

    expect(facturaMarzo.autorizacion_id).toBe('autorizacion-1');
    expect(facturaAbril.autorizacion_id).toBe('autorizacion-1');
    expect(facturaMarzo.mes_facturado).toBe(3);
    expect(facturaAbril.mes_facturado).toBe(4);
  });
});

// -------------------------------------------------------------------------------------------
// 2.9 — toActualizarFacturaPayload: semántica PARCIAL (la trampa que borra datos)
// -------------------------------------------------------------------------------------------

describe('toActualizarFacturaPayload (2.9) — semántica parcial, la trampa de las asistencias', () => {
  it('clave ausente en el Partial -> clave ausente en el jsonb resultante', () => {
    const cambios: ActualizacionFactura = { monto: 50000 };
    const payload = toActualizarFacturaPayload(cambios);

    expect(payload).toEqual({ monto: 50000 });
    expect('estado' in payload).toBe(false);
    expect('asistencias' in payload).toBe(false);
    expect('dias' in payload).toBe(false);
  });

  it('clave presente con undefined explícito -> queda ausente', () => {
    const cambios: ActualizacionFactura = { monto: undefined, dias: 5 };
    const payload = toActualizarFacturaPayload(cambios);

    expect('monto' in payload).toBe(false);
    expect(payload).toEqual({ dias: 5 });
  });

  it('EL CASO CRÍTICO: editar SOLO el estado (la operación más frecuente del circuito) NO manda la clave "asistencias" — no borraría el detalle de la factura', () => {
    const cambios: ActualizacionFactura = { estado: 'facturado' };
    const payload = toActualizarFacturaPayload(cambios);

    expect(payload).toEqual({ estado: 'facturado' });
    expect('asistencias' in payload).toBe(false);
  });

  it('clave presente con array vacío de asistencias -> PRESENTE en el jsonb (borrar todas, intencional)', () => {
    const cambios: ActualizacionFactura = { asistencias: [] };
    const payload = toActualizarFacturaPayload(cambios);

    expect('asistencias' in payload).toBe(true);
    expect(payload.asistencias).toEqual([]);
  });

  it('clave presente con asistencias no vacías mapea cada una al formato snake_case sin el id', () => {
    const cambios: ActualizacionFactura = { asistencias: [asistenciaMinima({ id: 'ignorado-en-replace' })] };
    const payload = toActualizarFacturaPayload(cambios);

    expect(payload.asistencias).toEqual([
      {
        fecha: '2026-03-05',
        prestacion: 'Traslado',
        dependencia: 'Domicilio',
        retorno: 'Centro de día',
        factura_sabados: false,
      },
    ]);
  });

  it('objeto vacío -> jsonb vacío: no pisa ningún campo que el usuario no tocó', () => {
    expect(toActualizarFacturaPayload({})).toEqual({});
  });

  it('identificadorFactura presente se traduce a las dos columnas snake_case', () => {
    const cambios: ActualizacionFactura = { identificadorFactura: { origen: 'paciente.numeroAfiliado', valor: 'AF-1' } };
    const payload = toActualizarFacturaPayload(cambios);

    expect(payload).toEqual({ identificador_origen: 'paciente.numeroAfiliado', identificador_valor: 'AF-1' });
  });

  // 2.4 (facturacion-seleccion-autorizacion) — EL CASO CRÍTICO: editar solo el estado no debe
  // tocar el vínculo con la autorización ya persistida (D2: la RPC usa `p_cambios ? 'clave'`,
  // clave ausente = no tocar).
  it('EL CASO CRÍTICO: editar SOLO el estado no manda la clave "autorizacion_id" — no borra el vínculo existente', () => {
    const cambios: ActualizacionFactura = { estado: 'facturado' };
    const payload = toActualizarFacturaPayload(cambios);

    expect(payload).toEqual({ estado: 'facturado' });
    expect('autorizacion_id' in payload).toBe(false);
  });

  it('clave autorizacionId presente (incluso re-eligiendo la misma) manda autorizacion_id', () => {
    const cambios: ActualizacionFactura = { autorizacionId: 'autorizacion-1' };
    const payload = toActualizarFacturaPayload(cambios);

    expect(payload).toEqual({ autorizacion_id: 'autorizacion-1' });
  });
});

// -------------------------------------------------------------------------------------------
// 2.10 — toCrearCobroPayload
// -------------------------------------------------------------------------------------------

function nuevoCobroMinimo(overrides: Partial<NuevoCobro> = {}): NuevoCobro {
  return {
    facturaId: 'factura-1',
    fecha: '2026-06-10',
    montoPagado: 15000,
    ...overrides,
  };
}

describe('toCrearCobroPayload (2.10)', () => {
  it('mapea facturaId -> facturas_id (plural) y montoPagado -> monto_pagado', () => {
    const payload = toCrearCobroPayload(nuevoCobroMinimo());

    expect(payload).toEqual({
      facturas_id: 'factura-1',
      fecha: '2026-06-10',
      monto_pagado: 15000,
    });
  });

  it('segundo caso (triangulación): otros valores mapean igual de bien', () => {
    const payload = toCrearCobroPayload(nuevoCobroMinimo({ facturaId: 'factura-2', montoPagado: 999 }));
    expect(payload.facturas_id).toBe('factura-2');
    expect(payload.monto_pagado).toBe(999);
  });
});
