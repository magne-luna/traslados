import { describe, expect, it } from 'vitest';
import type { ActualizacionObraSocial, NuevaObraSocial } from '../../types/obraSocial';
import {
  ensamblarObraSocial,
  parseCampoPlantillaRow,
  parseObraSocialRow,
  parseRequisitoRow,
  toActualizarObraSocialPayload,
  toCrearObraSocialPayload,
} from './obraSocialMapping';

// Mapeo puro fila<->dominio (design.md D1/D2/D3/D4/D5 de integracion-obra-social). Sin red, sin
// `any`, sin `as`. Nombres de columna tomados LITERALMENTE del schema real verificado con
// `supabase db query --linked` (2026-07-31) — no del docx ni de una migración asumida:
// `tipo_comprobante` (no `tipo_factura`, renombrada+retipada como enum ya en la base real) y
// `plantilla_campo` (no `campos_plantilla_factura`, la tabla con ese nombre nunca se creó porque
// ya existía con este otro). Ver el hallazgo documentado en design.md/CHANGES.md.

function filaObraSocialCompleta(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'os-1',
    razon_social: 'OSECAC',
    cuit: '30-54155200-6',
    codigo: 'OS-01',
    direccion: 'Callao 100',
    telefono: '11-1111-2222',
    condicion_iva: 'Exento',
    tipo_comprobante: 'A',
    plazo_cobro_dias: 90,
    modalidad_facturacion: 'por-prestacion',
    admite_pagos_parciales: false,
    identificador_origen: 'paciente.numeroAfiliado',
    requisitos_os: [],
    plantilla_campo: [],
    ...overrides,
  };
}

// -----------------------------------------------------------------------------------------------
// 3.1 — parseObraSocialRow
// -----------------------------------------------------------------------------------------------

describe('parseObraSocialRow (3.1)', () => {
  it('mapea una fila completa, incluido el renombre razon_social->nombre', () => {
    const base = parseObraSocialRow(filaObraSocialCompleta());

    expect(base.nombre).toBe('OSECAC');
    expect(base.cuit).toBe('30-54155200-6');
    expect(base.codigo).toBe('OS-01');
    expect(base.direccion).toBe('Callao 100');
    expect(base.telefono).toBe('11-1111-2222');
    expect(base.condicionIva).toBe('Exento');
    expect(base.modalidadFacturacion).toBe('por-prestacion');
    expect(base.admitePagosParciales).toBe(false);
    expect(base.identificadorOrigen).toBe('paciente.numeroAfiliado');
    expect(base.plazoCobroDias).toBe(90);
    expect(base.tipoComprobante).toBe('A');
  });

  it('los 4 campos opcionales del docx en NULL no rompen el mapeo (quedan undefined)', () => {
    const base = parseObraSocialRow(
      filaObraSocialCompleta({ codigo: null, direccion: null, telefono: null, condicion_iva: null }),
    );

    expect(base.codigo).toBeUndefined();
    expect(base.direccion).toBeUndefined();
    expect(base.telefono).toBeUndefined();
    expect(base.condicionIva).toBeUndefined();
  });

  it('plazo_cobro_dias/tipo_comprobante en NULL quedan undefined (semántica parcial, RN-FA-04)', () => {
    const base = parseObraSocialRow(filaObraSocialCompleta({ plazo_cobro_dias: null, tipo_comprobante: null }));

    expect(base.plazoCobroDias).toBeUndefined();
    expect(base.tipoComprobante).toBeUndefined();
  });

  it('tipo_comprobante fuera de la unión cerrada cae a undefined (no rompe el mapeo)', () => {
    const base = parseObraSocialRow(filaObraSocialCompleta({ tipo_comprobante: 'algo-raro' }));

    expect(base.tipoComprobante).toBeUndefined();
  });

  it('plazo_cobro_dias no numérico cae a undefined', () => {
    const base = parseObraSocialRow(filaObraSocialCompleta({ plazo_cobro_dias: 'no-es-numero' }));

    expect(base.plazoCobroDias).toBeUndefined();
  });

  it('modalidad_facturacion/identificador_origen desconocidos caen al default documentado', () => {
    const base = parseObraSocialRow(
      filaObraSocialCompleta({ modalidad_facturacion: 'algo-raro', identificador_origen: 'algo-raro' }),
    );

    expect(base.modalidadFacturacion).toBe('por-prestacion');
    expect(base.identificadorOrigen).toBe('paciente.numeroAfiliado');
  });
});

// -----------------------------------------------------------------------------------------------
// 3.2 — parseRequisitoRow (checklist)
// -----------------------------------------------------------------------------------------------

describe('parseRequisitoRow (3.2) — ChecklistItem.id = tipos_documento.id, no requisitos_os.id', () => {
  it('mapea una fila completa: el id del ChecklistItem es el de tipos_documento, no el de requisitos_os', () => {
    const item = parseRequisitoRow({
      id: 'requisito-fila-1',
      orden: 0,
      requerido: true,
      tipos_documento: { id: 'tipo-doc-1', tipo: 'RHC' },
    });

    expect(item).toEqual({ id: 'tipo-doc-1', nombre: 'RHC', requerido: true });
    expect(item?.id).not.toBe('requisito-fila-1');
  });

  it('una fila sin tipos_documento embebido se descarta (null)', () => {
    expect(parseRequisitoRow({ id: 'r-1', orden: 0, requerido: true })).toBeNull();
  });

  it('requerido en NULL cae a true (default de la columna)', () => {
    const item = parseRequisitoRow({
      id: 'r-1',
      orden: 0,
      requerido: null,
      tipos_documento: { id: 'tipo-doc-1', tipo: 'RHC' },
    });

    expect(item?.requerido).toBe(true);
  });
});

// -----------------------------------------------------------------------------------------------
// 3.3 — orden del checklist (asc por orden, desempate por id)
// -----------------------------------------------------------------------------------------------

describe('ensamblarObraSocial — orden del checklist (3.3, RN-FA-08)', () => {
  it('ordena por orden asc aunque la respuesta llegue desordenada', () => {
    const fila = filaObraSocialCompleta({
      requisitos_os: [
        { id: 'r-2', orden: 1, requerido: true, tipos_documento: { id: 't-2', tipo: 'Segundo' } },
        { id: 'r-1', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'Primero' } },
      ],
    });

    const os = ensamblarObraSocial(fila);

    expect(os.checklist.map((i) => i.nombre)).toEqual(['Primero', 'Segundo']);
  });

  it('dos filas con el mismo orden se desempatan por id de forma determinista', () => {
    const fila = filaObraSocialCompleta({
      requisitos_os: [
        { id: 'r-1', orden: 0, requerido: true, tipos_documento: { id: 't-b', tipo: 'B' } },
        { id: 'r-2', orden: 0, requerido: true, tipos_documento: { id: 't-a', tipo: 'A' } },
      ],
    });

    const primeraVez = ensamblarObraSocial(fila).checklist.map((i) => i.id);
    const segundaVez = ensamblarObraSocial(fila).checklist.map((i) => i.id);

    expect(primeraVez).toEqual(segundaVez);
    expect(primeraVez).toEqual(['t-a', 't-b']);
  });

  it('una colección vacía de requisitos_os da checklist: []', () => {
    const os = ensamblarObraSocial(filaObraSocialCompleta({ requisitos_os: [] }));

    expect(os.checklist).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------------
// 3.4 — parseCampoPlantillaRow + orden de la plantilla
// -----------------------------------------------------------------------------------------------

describe('parseCampoPlantillaRow (3.4)', () => {
  it('mapea una fila completa', () => {
    const campo = parseCampoPlantillaRow({ id: 'c-1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 });

    expect(campo).toEqual({ id: 'c-1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 });
  });

  it('un origen fuera de la unión cerrada se descarta (null)', () => {
    expect(parseCampoPlantillaRow({ id: 'c-1', etiqueta: 'Raro', origen: 'algo-inventado', orden: 0 })).toBeNull();
  });
});

describe('ensamblarObraSocial — plantilla ordenada (3.4)', () => {
  it('conserva los campos válidos ordenados y descarta el de origen desconocido', () => {
    const fila = filaObraSocialCompleta({
      plantilla_campo: [
        { id: 'c-2', etiqueta: 'Segundo', origen: 'traslado.total', orden: 1 },
        { id: 'c-x', etiqueta: 'Malo', origen: 'inventado', orden: 2 },
        { id: 'c-1', etiqueta: 'Primero', origen: 'paciente.nombre', orden: 0 },
      ],
    });

    const os = ensamblarObraSocial(fila);

    expect(os.plantillaFactura.campos.map((c) => c.etiqueta)).toEqual(['Primero', 'Segundo']);
  });

  it('una colección vacía de plantilla_campo da campos: []', () => {
    const os = ensamblarObraSocial(filaObraSocialCompleta({ plantilla_campo: [] }));

    expect(os.plantillaFactura.campos).toEqual([]);
  });
});

// -----------------------------------------------------------------------------------------------
// 3.5 — ensamblarObraSocial
// -----------------------------------------------------------------------------------------------

describe('ensamblarObraSocial (3.5)', () => {
  it('combina todo en una ObraSocial completa', () => {
    const fila = filaObraSocialCompleta({
      requisitos_os: [{ id: 'r-1', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'RHC' } }],
      plantilla_campo: [{ id: 'c-1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 }],
    });

    const os = ensamblarObraSocial(fila);

    expect(os).toEqual({
      id: 'os-1',
      nombre: 'OSECAC',
      cuit: '30-54155200-6',
      codigo: 'OS-01',
      direccion: 'Callao 100',
      telefono: '11-1111-2222',
      condicionIva: 'Exento',
      modalidadFacturacion: 'por-prestacion',
      admitePagosParciales: false,
      formatoAfiliado: 'numero-documento',
      plazoCobroDias: 90,
      tipoComprobante: 'A',
      checklist: [{ id: 't-1', nombre: 'RHC', requerido: true }],
      plantillaFactura: {
        identificadorOrigen: 'paciente.numeroAfiliado',
        campos: [{ id: 'c-1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 }],
      },
    });
  });

  it('una obra social sin checklist ni plantilla da arrays vacíos, sin lanzar', () => {
    const os = ensamblarObraSocial(filaObraSocialCompleta({ requisitos_os: [], plantilla_campo: [] }));

    expect(os.checklist).toEqual([]);
    expect(os.plantillaFactura.campos).toEqual([]);
  });

  it('defensivo: requisitos_os/plantilla_campo que no son un array no rompen (dan [])', () => {
    const os = ensamblarObraSocial(filaObraSocialCompleta({ requisitos_os: null, plantilla_campo: null }));

    expect(os.checklist).toEqual([]);
    expect(os.plantillaFactura.campos).toEqual([]);
  });

  it('defensivo: una fila que no es un objeto da una ObraSocial vacía sin lanzar', () => {
    const os = ensamblarObraSocial('esto-no-es-una-fila');

    expect(os).toEqual({
      id: '',
      nombre: '',
      cuit: '',
      codigo: undefined,
      direccion: undefined,
      telefono: undefined,
      condicionIva: undefined,
      modalidadFacturacion: 'por-prestacion',
      admitePagosParciales: false,
      formatoAfiliado: 'numero-documento',
      plazoCobroDias: undefined,
      tipoComprobante: undefined,
      checklist: [],
      plantillaFactura: { identificadorOrigen: 'paciente.numeroAfiliado', campos: [] },
    });
  });

  it('una fila hija malformada se descarta sin romper el resto de la colección', () => {
    const fila = filaObraSocialCompleta({
      requisitos_os: [
        { id: 'r-1', orden: 0, requerido: true, tipos_documento: { id: 't-1', tipo: 'RHC' } },
        { id: 'r-2', orden: 1, requerido: true }, // sin tipos_documento -> se descarta
      ],
    });

    const os = ensamblarObraSocial(fila);

    expect(os.checklist).toEqual([{ id: 't-1', nombre: 'RHC', requerido: true }]);
  });
});

// -----------------------------------------------------------------------------------------------
// 3.6 — toCrearObraSocialPayload
// -----------------------------------------------------------------------------------------------

function nuevaObraSocialMinima(): NuevaObraSocial {
  return {
    nombre: 'Swiss Medical',
    cuit: '30-11111111-1',
    modalidadFacturacion: 'por-prestacion',
    admitePagosParciales: false,
    formatoAfiliado: 'numero-documento',
    checklist: [],
    plantillaFactura: { campos: [], identificadorOrigen: 'paciente.numeroAfiliado' },
  };
}

describe('toCrearObraSocialPayload (3.6)', () => {
  it('obra social mínima: claves en snake_case, checklist y plantilla vacíos', () => {
    const payload = toCrearObraSocialPayload(nuevaObraSocialMinima());

    expect(payload).toEqual({
      razon_social: 'Swiss Medical',
      cuit: '30-11111111-1',
      codigo: null,
      direccion: null,
      telefono: null,
      condicion_iva: null,
      modalidad_facturacion: 'por-prestacion',
      admite_pagos_parciales: false,
      formato_afiliado: 'numero-documento',
      plazo_cobro_dias: null,
      tipo_comprobante: null,
      checklist: [],
      plantilla_factura: { identificador_origen: 'paciente.numeroAfiliado', campos: [] },
    });
  });

  it('obra social completa, con los 4 campos del docx', () => {
    const payload = toCrearObraSocialPayload({
      ...nuevaObraSocialMinima(),
      codigo: 'SM-01',
      direccion: 'Av. Corrientes 1234',
      telefono: '11-4000-5000',
      condicionIva: 'Responsable Inscripto',
    });

    expect(payload.codigo).toBe('SM-01');
    expect(payload.direccion).toBe('Av. Corrientes 1234');
    expect(payload.telefono).toBe('11-4000-5000');
    expect(payload.condicion_iva).toBe('Responsable Inscripto');
  });

  it('con checklist: el orden se deriva del índice del array; nunca se envía el id del ítem', () => {
    const payload = toCrearObraSocialPayload({
      ...nuevaObraSocialMinima(),
      checklist: [
        { id: 'no-deberia-viajar', nombre: 'RHC', requerido: true },
        { id: 'tampoco', nombre: 'CBU', requerido: false },
      ],
    });

    expect(payload.checklist).toEqual([
      { nombre: 'RHC', requerido: true, orden: 0 },
      { nombre: 'CBU', requerido: false, orden: 1 },
    ]);
    expect(JSON.stringify(payload)).not.toContain('no-deberia-viajar');
  });

  it('con checklist pero sin plantilla: la plantilla viaja con campos: []', () => {
    const payload = toCrearObraSocialPayload({
      ...nuevaObraSocialMinima(),
      checklist: [{ id: 'x', nombre: 'RHC', requerido: true }],
      plantillaFactura: { campos: [], identificadorOrigen: 'paciente.dni' },
    });

    expect(payload.plantilla_factura).toEqual({ identificador_origen: 'paciente.dni', campos: [] });
  });

  it('sin plazoCobroDias/tipoComprobante configurados: viajan como null (el default lo aplica la RPC)', () => {
    const payload = toCrearObraSocialPayload(nuevaObraSocialMinima());

    expect(payload.plazo_cobro_dias).toBeNull();
    expect(payload.tipo_comprobante).toBeNull();
  });

  it('con plazoCobroDias/tipoComprobante configurados: viajan tal cual', () => {
    const payload = toCrearObraSocialPayload({
      ...nuevaObraSocialMinima(),
      plazoCobroDias: 60,
      tipoComprobante: 'B',
    });

    expect(payload.plazo_cobro_dias).toBe(60);
    expect(payload.tipo_comprobante).toBe('B');
  });
});

// -----------------------------------------------------------------------------------------------
// 3.7 — toActualizarObraSocialPayload (semántica parcial)
// -----------------------------------------------------------------------------------------------

describe('toActualizarObraSocialPayload (3.7) — semántica parcial (D6)', () => {
  it('objeto vacío: ninguna clave viaja', () => {
    const payload = toActualizarObraSocialPayload({});

    expect(payload).toEqual({});
  });

  it('solo nombre: únicamente razon_social viaja', () => {
    const payload = toActualizarObraSocialPayload({ nombre: 'Nuevo nombre' } satisfies ActualizacionObraSocial);

    expect(payload).toEqual({ razon_social: 'Nuevo nombre' });
  });

  it('solo checklist (no vacío): la clave viaja con el array completo', () => {
    const payload = toActualizarObraSocialPayload({
      checklist: [{ id: 'x', nombre: 'RHC', requerido: true }],
    });

    expect(payload).toEqual({ checklist: [{ nombre: 'RHC', requerido: true, orden: 0 }] });
  });

  it('checklist: [] SÍ viaja (vaciar la colección es una instrucción explícita, no ausencia)', () => {
    const payload = toActualizarObraSocialPayload({ checklist: [] });

    expect(payload).toEqual({ checklist: [] });
    expect('checklist' in payload).toBe(true);
  });

  it('checklist ausente: la clave no aparece en absoluto (no se confunde con vaciar)', () => {
    const payload = toActualizarObraSocialPayload({ nombre: 'Otro' });

    expect('checklist' in payload).toBe(false);
  });

  it('todos los campos planos permitidos viajan cuando están presentes', () => {
    const payload = toActualizarObraSocialPayload({
      nombre: 'Nuevo nombre',
      cuit: '30-99999999-9',
      codigo: 'C-01',
      direccion: 'Calle Nueva 1',
      telefono: '11-0000-0000',
      condicionIva: 'Monotributo',
      modalidadFacturacion: 'general',
      admitePagosParciales: true,
    });

    expect(payload).toEqual({
      razon_social: 'Nuevo nombre',
      cuit: '30-99999999-9',
      codigo: 'C-01',
      direccion: 'Calle Nueva 1',
      telefono: '11-0000-0000',
      condicion_iva: 'Monotributo',
      modalidad_facturacion: 'general',
      admite_pagos_parciales: true,
    });
  });

  it('campos opcionales vaciados (cadena vacía) se guardan como NULL, no como cadena vacía', () => {
    const payload = toActualizarObraSocialPayload({ codigo: '', direccion: '', telefono: '', condicionIva: '' });

    expect(payload).toEqual({ codigo: null, direccion: null, telefono: null, condicion_iva: null });
  });

  it('plantillaFactura presente: viaja como plantilla_factura con identificador_origen y campos', () => {
    const payload = toActualizarObraSocialPayload({
      plantillaFactura: { campos: [{ id: 'c-1', etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 }], identificadorOrigen: 'paciente.dni' },
    });

    expect(payload).toEqual({
      plantilla_factura: { identificador_origen: 'paciente.dni', campos: [{ etiqueta: 'Paciente', origen: 'paciente.nombre', orden: 0 }] },
    });
  });

  it('plazoCobroDias/tipoComprobante ausentes: ninguna de las dos claves viaja (no tocar)', () => {
    const payload = toActualizarObraSocialPayload({ nombre: 'Otro' });

    expect('plazo_cobro_dias' in payload).toBe(false);
    expect('tipo_comprobante' in payload).toBe(false);
  });

  it('plazoCobroDias/tipoComprobante presentes: viajan tal cual', () => {
    const payload = toActualizarObraSocialPayload({ plazoCobroDias: 60, tipoComprobante: 'C' });

    expect(payload).toEqual({ plazo_cobro_dias: 60, tipo_comprobante: 'C' });
  });
});
