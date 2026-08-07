/// <reference types="node" />
// Tests del mapeo puro de Documentos (tasks.md §3, design.md D2/D3/D4 del change
// `integracion-documentos`). Sin red, sin Supabase real — todo `unknown` sintético.
import documentoMappingSource from './documentoMapping.ts?raw';
import { describe, expect, it } from 'vitest';
import {
  CONFIG_ENTIDAD,
  construirClaveStorage,
  ensamblarDocumentos,
  nombreArchivoSeguro,
  parseDocumentoRow,
  toInsertPayload,
} from './documentoMapping';

// -------------------------------------------------------------------------------------------
// 3.1 — CONFIG_ENTIDAD: las 4 entradas coinciden EXACTAMENTE con el schema real verificado en
// 1.2/1.3 de tasks.md (supabase db query --linked, 2026-08-06). Detecta un typo de tabla/columna
// sin salir a la red.
// -------------------------------------------------------------------------------------------

describe('CONFIG_ENTIDAD (3.1)', () => {
  it('define las 4 entidades documentales', () => {
    expect(Object.keys(CONFIG_ENTIDAD).sort()).toEqual(['conductor', 'factura', 'paciente', 'vehiculo']);
  });

  it('paciente -> pacientes.documentos, columnaItem id_tipo_documento (FK a tipos_documento)', () => {
    expect(CONFIG_ENTIDAD.paciente).toEqual({
      schema: 'pacientes',
      tabla: 'documentos',
      columnaEntidad: 'paciente_id',
      columnaItem: 'id_tipo_documento',
      bucket: 'documentos-pacientes',
      modulo: 'pacientes',
    });
  });

  it('vehiculo -> conductores.documentacion_vehiculo, columnaItem tipo_documento (TEXT libre)', () => {
    expect(CONFIG_ENTIDAD.vehiculo).toEqual({
      schema: 'conductores',
      tabla: 'documentacion_vehiculo',
      columnaEntidad: 'vehiculo_id',
      columnaItem: 'tipo_documento',
      bucket: 'documentos-vehiculos',
      modulo: 'vehiculos',
    });
  });

  it('conductor -> conductores.documentacion_conductores, columnaItem tipo_documento (TEXT libre)', () => {
    expect(CONFIG_ENTIDAD.conductor).toEqual({
      schema: 'conductores',
      tabla: 'documentacion_conductores',
      columnaEntidad: 'conductor_id',
      columnaItem: 'tipo_documento',
      bucket: 'documentos-conductores',
      modulo: 'conductores',
    });
  });

  it('factura -> facturacion.documento_factura, columnaItem id_tipo_documento (FK a tipos_documento)', () => {
    expect(CONFIG_ENTIDAD.factura).toEqual({
      schema: 'facturacion',
      tabla: 'documento_factura',
      columnaEntidad: 'factura_id',
      columnaItem: 'id_tipo_documento',
      bucket: 'documentos-facturas',
      modulo: 'facturacion',
    });
  });
});

// -------------------------------------------------------------------------------------------
// 3.3/3.4 — nombreArchivoSeguro: minúsculas, NFD sin diacríticos, [^a-z0-9.-] -> '-', colapsa
// guiones repetidos, recorta a 100 caracteres preservando la extensión.
// -------------------------------------------------------------------------------------------

describe('nombreArchivoSeguro (3.3/3.4)', () => {
  it('quita acentos y pasa a minúsculas ("Certificado médico.pdf")', () => {
    expect(nombreArchivoSeguro('Certificado médico.pdf')).toBe('certificado-medico.pdf');
  });

  it('colapsa espacios y mayúsculas repetidas a un solo guion', () => {
    expect(nombreArchivoSeguro('MI Archivo   Con Espacios.PDF')).toBe('mi-archivo-con-espacios.pdf');
  });

  it('nombre sin extensión: no rompe, sanea igual', () => {
    expect(nombreArchivoSeguro('Documento Sin Extension')).toBe('documento-sin-extension');
  });

  it('nombre larguísimo: recorta a 100 caracteres sin comerse la extensión', () => {
    const nombreLargo = `${'a'.repeat(150)}.pdf`;
    const resultado = nombreArchivoSeguro(nombreLargo);
    expect(resultado.length).toBe(100);
    expect(resultado.endsWith('.pdf')).toBe(true);
  });
});

// -------------------------------------------------------------------------------------------
// 3.5 — construirClaveStorage: {entidadId}/{itemId}/{uuid}-{nombreSeguro}. El uuid entra por
// parámetro, nunca se genera adentro (pura y testeable sin mockear crypto).
// -------------------------------------------------------------------------------------------

describe('construirClaveStorage (3.5)', () => {
  it('arma la clave con el patrón entidadId/itemId/uuid-nombreSeguro', () => {
    const clave = construirClaveStorage('9f3c', '7b21', 'Certificado médico.pdf', '3e5a1c9d');
    expect(clave).toBe('9f3c/7b21/3e5a1c9d-certificado-medico.pdf');
  });

  it('es determinista: mismos parámetros, misma clave', () => {
    const a = construirClaveStorage('e1', 'i1', 'foto.jpg', 'uuid-1');
    const b = construirClaveStorage('e1', 'i1', 'foto.jpg', 'uuid-1');
    expect(a).toBe(b);
  });

  it('el uuid entra por parámetro: uuids distintos producen claves distintas sin volver a samear el nombre', () => {
    const a = construirClaveStorage('e1', 'i1', 'foto.jpg', 'uuid-1');
    const b = construirClaveStorage('e1', 'i1', 'foto.jpg', 'uuid-2');
    expect(a).not.toBe(b);
    expect(a).toBe('e1/i1/uuid-1-foto.jpg');
    expect(b).toBe('e1/i1/uuid-2-foto.jpg');
  });
});

// -------------------------------------------------------------------------------------------
// 3.6 — parseDocumentoRow: type guards explícitos sobre unknown, nunca any/as. itemId ausente o
// mal tipado -> null; nombre_archivo null -> degrada al último segmento de archivo_url (CP2);
// created_at ausente -> degrada sin lanzar.
// -------------------------------------------------------------------------------------------

describe('parseDocumentoRow (3.6)', () => {
  const configPaciente = CONFIG_ENTIDAD.paciente;
  const configVehiculo = CONFIG_ENTIDAD.vehiculo;

  it('fila válida completa (paciente, columnaItem id_tipo_documento)', () => {
    const row = {
      id: 'doc-1',
      paciente_id: 'pac-1',
      id_tipo_documento: 'tipo-1',
      archivo_url: 'pac-1/tipo-1/uuid-certificado.pdf',
      nombre_archivo: 'Certificado médico.pdf',
      created_at: '2026-08-06T10:00:00.000Z',
    };
    expect(parseDocumentoRow(row, configPaciente)).toEqual({
      id: 'doc-1',
      itemId: 'tipo-1',
      nombreArchivo: 'Certificado médico.pdf',
      subidoEn: '2026-08-06T10:00:00.000Z',
    });
  });

  it('fila válida completa (vehículo, columnaItem tipo_documento TEXT libre)', () => {
    const row = {
      id: 'doc-2',
      vehiculo_id: 'veh-1',
      tipo_documento: 'vehiculo-doc-vtv',
      archivo_url: 'veh-1/vehiculo-doc-vtv/uuid-vtv.pdf',
      nombre_archivo: 'VTV.pdf',
      created_at: '2026-08-06T11:00:00.000Z',
    };
    expect(parseDocumentoRow(row, configVehiculo)).toEqual({
      id: 'doc-2',
      itemId: 'vehiculo-doc-vtv',
      nombreArchivo: 'VTV.pdf',
      subidoEn: '2026-08-06T11:00:00.000Z',
    });
  });

  it('row que no es un objeto -> null', () => {
    expect(parseDocumentoRow(null, configPaciente)).toBeNull();
    expect(parseDocumentoRow('no-es-un-objeto', configPaciente)).toBeNull();
    expect(parseDocumentoRow(42, configPaciente)).toBeNull();
  });

  it('id ausente o mal tipado -> null', () => {
    const sinId = { paciente_id: 'pac-1', id_tipo_documento: 'tipo-1', archivo_url: 'x' };
    expect(parseDocumentoRow(sinId, configPaciente)).toBeNull();
    const idNumerico = { id: 123, paciente_id: 'pac-1', id_tipo_documento: 'tipo-1', archivo_url: 'x' };
    expect(parseDocumentoRow(idNumerico, configPaciente)).toBeNull();
  });

  it('itemId ausente -> null (falta id_tipo_documento)', () => {
    const row = { id: 'doc-1', paciente_id: 'pac-1', archivo_url: 'x', nombre_archivo: 'y.pdf' };
    expect(parseDocumentoRow(row, configPaciente)).toBeNull();
  });

  it('itemId del tipo equivocado (number en vez de string) -> null', () => {
    const row = { id: 'doc-1', paciente_id: 'pac-1', id_tipo_documento: 123, archivo_url: 'x' };
    expect(parseDocumentoRow(row, configPaciente)).toBeNull();
  });

  it('nombre_archivo null -> degrada al último segmento de archivo_url', () => {
    const row = {
      id: 'doc-1',
      paciente_id: 'pac-1',
      id_tipo_documento: 'tipo-1',
      archivo_url: 'pac-1/tipo-1/3e5a1c9d-certificado-medico.pdf',
      nombre_archivo: null,
      created_at: '2026-08-06T10:00:00.000Z',
    };
    const resultado = parseDocumentoRow(row, configPaciente);
    expect(resultado?.nombreArchivo).toBe('3e5a1c9d-certificado-medico.pdf');
  });

  it('created_at ausente -> degrada sin lanzar (subidoEn queda en string vacío)', () => {
    const row = {
      id: 'doc-1',
      conductor_id: 'cond-1',
      tipo_documento: 'conductor-doc-dni',
      archivo_url: 'cond-1/conductor-doc-dni/uuid-dni.pdf',
      nombre_archivo: 'DNI.pdf',
      // sin created_at — tabla histórica sin la columna antes de la migración del Checkpoint 2
    };
    expect(() => parseDocumentoRow(row, CONFIG_ENTIDAD.conductor)).not.toThrow();
    const resultado = parseDocumentoRow(row, CONFIG_ENTIDAD.conductor);
    expect(resultado?.subidoEn).toBe('');
  });
});

// -------------------------------------------------------------------------------------------
// 3.7 — ensamblarDocumentos: descarta null sin propagar. Colección vacía, 1 válida + 1
// malformada, rows que no es un array.
// -------------------------------------------------------------------------------------------

describe('ensamblarDocumentos (3.7)', () => {
  const config = CONFIG_ENTIDAD.paciente;

  it('colección vacía -> []', () => {
    expect(ensamblarDocumentos([], config)).toEqual([]);
  });

  it('1 fila válida + 1 malformada -> descarta la malformada sin romper la colección', () => {
    const filaValida = {
      id: 'doc-1',
      paciente_id: 'pac-1',
      id_tipo_documento: 'tipo-1',
      archivo_url: 'x/y.pdf',
      nombre_archivo: 'y.pdf',
      created_at: '2026-08-06T10:00:00.000Z',
    };
    const filaMalformada = { id: 'doc-2' }; // sin id_tipo_documento
    const resultado = ensamblarDocumentos([filaValida, filaMalformada], config);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]?.id).toBe('doc-1');
  });

  it('rows que no es un array -> []', () => {
    expect(ensamblarDocumentos(null, config)).toEqual([]);
    expect(ensamblarDocumentos(undefined, config)).toEqual([]);
    expect(ensamblarDocumentos({ no: 'es un array' }, config)).toEqual([]);
    expect(ensamblarDocumentos('tampoco', config)).toEqual([]);
  });
});

// -------------------------------------------------------------------------------------------
// 3.8 — toInsertPayload: nombres de columna dinámicos según la config. Las dos formas del
// Checkpoint 1: paciente ({ paciente_id, id_tipo_documento, … }) y conductor
// ({ conductor_id, tipo_documento, … }), más vehiculo/factura para redondear las 4 entidades.
// -------------------------------------------------------------------------------------------

describe('toInsertPayload (3.8)', () => {
  it('forma paciente: paciente_id + id_tipo_documento (FK a tipos_documento)', () => {
    const payload = toInsertPayload('pac-1', 'tipo-1', 'pac-1/tipo-1/uuid-a.pdf', 'a.pdf', CONFIG_ENTIDAD.paciente);
    expect(payload).toEqual({
      paciente_id: 'pac-1',
      id_tipo_documento: 'tipo-1',
      archivo_url: 'pac-1/tipo-1/uuid-a.pdf',
      nombre_archivo: 'a.pdf',
    });
  });

  it('forma conductor: conductor_id + tipo_documento (TEXT libre)', () => {
    const payload = toInsertPayload(
      'cond-1',
      'conductor-doc-dni',
      'cond-1/conductor-doc-dni/uuid-dni.pdf',
      'DNI.pdf',
      CONFIG_ENTIDAD.conductor,
    );
    expect(payload).toEqual({
      conductor_id: 'cond-1',
      tipo_documento: 'conductor-doc-dni',
      archivo_url: 'cond-1/conductor-doc-dni/uuid-dni.pdf',
      nombre_archivo: 'DNI.pdf',
    });
  });

  it('forma vehículo: vehiculo_id + tipo_documento (TEXT libre)', () => {
    const payload = toInsertPayload(
      'veh-1',
      'vehiculo-doc-vtv',
      'veh-1/vehiculo-doc-vtv/uuid-vtv.pdf',
      'VTV.pdf',
      CONFIG_ENTIDAD.vehiculo,
    );
    expect(payload).toEqual({
      vehiculo_id: 'veh-1',
      tipo_documento: 'vehiculo-doc-vtv',
      archivo_url: 'veh-1/vehiculo-doc-vtv/uuid-vtv.pdf',
      nombre_archivo: 'VTV.pdf',
    });
  });

  it('forma factura: factura_id + id_tipo_documento (FK a tipos_documento)', () => {
    const payload = toInsertPayload(
      'fac-1',
      'tipo-comprobante',
      'fac-1/tipo-comprobante/uuid-c.pdf',
      'comprobante.pdf',
      CONFIG_ENTIDAD.factura,
    );
    expect(payload).toEqual({
      factura_id: 'fac-1',
      id_tipo_documento: 'tipo-comprobante',
      archivo_url: 'fac-1/tipo-comprobante/uuid-c.pdf',
      nombre_archivo: 'comprobante.pdf',
    });
  });
});

// -------------------------------------------------------------------------------------------
// 3.9 — código fuente de documentoMapping.ts: nunca `any`, nunca `as` (cast sobre datos de
// Supabase), nunca la palabra SUPABASE_SERVICE_ROLE_KEY. Mismo mecanismo que la serie usa para
// verificar que ninguna función se declaró SECURITY DEFINER.
// -------------------------------------------------------------------------------------------

describe('código fuente de documentoMapping.ts (3.9)', () => {
  it('no contiene la palabra "any" como token', () => {
    expect(documentoMappingSource).not.toMatch(/\bany\b/);
  });

  it('no contiene la palabra "as" como token (ningún cast sobre datos de Supabase)', () => {
    expect(documentoMappingSource).not.toMatch(/\bas\b/);
  });

  it('no menciona SUPABASE_SERVICE_ROLE_KEY', () => {
    expect(documentoMappingSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
