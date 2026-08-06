import { describe, expect, it } from 'vitest';
import {
  direccionesACambiar,
  ensamblarPaciente,
  parseAccesorios,
  parseClinicosRow,
  parseCudRow,
  parseDireccionRow,
  parsePacienteRow,
  parsePersonaACargoRow,
  toCrearPacientePayload,
  toDireccionRows,
  toPersonaACargoRows,
} from './pacienteMapping';
import type { Coordenada } from '../../types/hojaDeRuta';
import type { Direccion, NuevoPaciente, PersonaACargo } from '../../types/paciente';

function buildNuevoPacienteMinimo(): NuevoPaciente {
  return {
    apellido: 'Pérez',
    nombre: 'Juana',
    fechaNacimiento: '',
    dni: '40111222',
    cuilTitular: '',
    diagnostico: '',
    accesorioMovilidad: [],
    obraSocialId: null,
    numeroAfiliado: { valor: '' },
    cud: null,
    direcciones: [],
    personasACargo: [],
    amparoJudicial: false,
  };
}

function buildNuevoPacienteCompleto(): NuevoPaciente {
  return {
    apellido: 'Pérez',
    segundoApellido: 'Gómez',
    nombre: 'Juana',
    segundoNombre: 'Sol',
    fechaNacimiento: '2015-03-01',
    dni: '40111222',
    cuilTitular: '20401112223',
    diagnostico: 'TEA',
    condicion: 'Estable',
    accesorioMovilidad: ['andador', 'tripode'],
    obraSocialId: 'os-1',
    numeroAfiliado: { valor: 'AF-999' },
    cud: { numero: 'C-1', fechaEmision: '2023-01-01', fechaVencimiento: '2027-01-01' },
    direcciones: [{ id: 'd-1', tipo: 'domicilio', calle: 'San Martín 123', localidad: 'CABA', dias: 'Lun', horario: '08:00' }],
    personasACargo: [{ id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: '30111222', parentesco: 'madre', telefono: '111' }],
    amparoJudicial: true,
    amparoJudicialAclaracion: 'Juzgado N°3',
  };
}

// pacienteMapping.ts: funciones puras de traducción fila<->dominio (design.md Decisión 1).
// Cubre las 11 discrepancias de D9 entre el docx (Paciente, frontend) y
// 20260724100004_schema_pacientes.sql (columnas reales). Sin red, sin mocks.

describe('parsePacienteRow', () => {
  it('mapea los campos base de una fila plana de pacientes.paciente (discrepancia #1..#2 no aplica acá)', () => {
    const row = {
      id: 'p-1',
      nombre_a: 'Juana',
      nombre_b: 'Sol',
      apellido_a: 'Pérez',
      apellido_b: 'Gómez',
      fecha_nacimiento: '2015-03-01',
      dni: '40111222',
      cuil_titular: '20401112223',
      obra_social_id: 'os-1',
      amparo_judicial: true,
    };

    const base = parsePacienteRow(row);

    expect(base).toEqual({
      id: 'p-1',
      nombre: 'Juana',
      segundoNombre: 'Sol',
      apellido: 'Pérez',
      segundoApellido: 'Gómez',
      fechaNacimiento: '2015-03-01',
      dni: '40111222',
      cuilTitular: '20401112223',
      obraSocialId: 'os-1',
      amparoJudicial: true,
    });
  });

  it('discrepancia #10 (D9): fecha_nacimiento y cuil_titular NULL se traducen a cadena vacía sin lanzar', () => {
    const row = {
      id: 'p-2',
      nombre_a: 'Tomás',
      nombre_b: null,
      apellido_a: 'Díaz',
      apellido_b: null,
      fecha_nacimiento: null,
      dni: '40999888',
      cuil_titular: null,
      obra_social_id: null,
      amparo_judicial: false,
    };

    expect(() => parsePacienteRow(row)).not.toThrow();
    const base = parsePacienteRow(row);

    expect(base.fechaNacimiento).toBe('');
    expect(base.cuilTitular).toBe('');
    expect(base.segundoNombre).toBeUndefined();
    expect(base.obraSocialId).toBeNull();
  });
});

describe('parseClinicosRow', () => {
  // Discrepancia #7 (D9): clinicos.diagnostico es JSONB; el dominio modela `diagnostico: string`.
  it('normaliza un diagnostico JSONB que ya es un string plano', () => {
    const row = { diagnostico: 'TEA nivel 2', condicion: 'Estable' };

    expect(parseClinicosRow(row)).toEqual({ diagnostico: 'TEA nivel 2', condicion: 'Estable' });
  });

  it('normaliza un diagnostico JSONB que es un objeto con campo de texto', () => {
    const row = { diagnostico: { texto: 'TEA nivel 2' }, condicion: null };

    const clinicos = parseClinicosRow(row);

    expect(clinicos.diagnostico).toBe('TEA nivel 2');
    expect(clinicos.condicion).toBeUndefined();
  });

  it('diagnostico NULL o fila ausente se normaliza a cadena vacía sin lanzar', () => {
    expect(() => parseClinicosRow(null)).not.toThrow();
    expect(parseClinicosRow(null)).toEqual({ diagnostico: '' });
    expect(parseClinicosRow({ diagnostico: null, condicion: null })).toEqual({ diagnostico: '' });
  });
});

describe('parseCudRow', () => {
  // Discrepancia #9 (D9): pacientes.cud es 1:N pero el dominio modela Cud | null; `vigente` se
  // ignora deliberadamente y se usa el vencimiento más reciente.
  it('sin filas, devuelve null', () => {
    expect(parseCudRow([])).toBeNull();
    expect(parseCudRow(null)).toBeNull();
  });

  it('con varias filas, elige la de vencimiento más reciente e ignora "vigente"', () => {
    const rows = [
      { numero_cud: 'A-1', emision: '2020-01-01', vencimiento: '2024-01-01', vigente: false },
      { numero_cud: 'A-2', emision: '2023-01-01', vencimiento: '2027-06-01', vigente: false },
      { numero_cud: 'A-3', emision: '2021-01-01', vencimiento: '2025-01-01', vigente: true },
    ];

    expect(parseCudRow(rows)).toEqual({
      numero: 'A-2',
      fechaEmision: '2023-01-01',
      fechaVencimiento: '2027-06-01',
    });
  });

  it('robustez: una fila malformada (sin numero_cud) se descarta sin romper la selección', () => {
    const rows = [
      { emision: '2020-01-01', vencimiento: '2099-01-01' }, // malformada, se descarta
      { numero_cud: 'B-1', emision: '2023-01-01', vencimiento: '2025-01-01' },
    ];

    expect(parseCudRow(rows)).toEqual({
      numero: 'B-1',
      fechaEmision: '2023-01-01',
      fechaVencimiento: '2025-01-01',
    });
  });
});

describe('parseDireccionRow', () => {
  // Discrepancias #4, #5 (D9): calle+numero se combinan al leer; dias/horario no tienen columna y
  // quedan vacíos. `localidad` sí tiene columna propia (discrepancia #3 cerrada) y se lee directo.
  it('combina calle + numero al leer; localidad se lee directo de la columna', () => {
    const row = { id: 'd-1', calle: 'San Martín', numero: '123', tipo_lugar: 'domicilio', localidad: 'CABA' };

    expect(parseDireccionRow(row)).toEqual({
      id: 'd-1',
      tipo: 'domicilio',
      calle: 'San Martín 123',
      localidad: 'CABA',
    });
  });

  it('sin numero, calle queda tal cual; tipo_lugar desconocido o null cae a "otro"; localidad null cae a cadena vacía', () => {
    const row = { id: 'd-2', calle: 'Belgrano 45', numero: null, tipo_lugar: null, localidad: null };

    expect(parseDireccionRow(row)).toEqual({
      id: 'd-2',
      tipo: 'otro',
      calle: 'Belgrano 45',
      localidad: '',
    });
  });

  it('robustez: fila malformada (sin calle) devuelve null en vez de romper', () => {
    expect(parseDireccionRow({ id: 'd-3', numero: '1', tipo_lugar: 'escuela' })).toBeNull();
    expect(parseDireccionRow(null)).toBeNull();
  });
});

describe('toDireccionRows', () => {
  // Discrepancia #5 (D9): al escribir, `numero` va SIEMPRE null — no se parsea la altura desde
  // `calle`.
  it('escribe numero: null siempre, sin parsear la altura de calle; localidad viaja tal cual', () => {
    const direcciones: Direccion[] = [
      { id: 'd-1', tipo: 'domicilio', calle: 'San Martín 123', localidad: 'CABA' },
    ];

    expect(toDireccionRows(direcciones)).toEqual([
      { id: 'd-1', calle: 'San Martín 123', numero: null, tipo_lugar: 'domicilio', localidad: 'CABA', descripcion: null },
    ]);
  });

  it('varias direcciones se mapean en orden, cada una con numero: null', () => {
    const direcciones: Direccion[] = [
      { id: 'd-1', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' },
      { id: 'd-2', tipo: 'escuela', calle: 'Calle 2', localidad: 'Vicente López' },
    ];

    const rows = toDireccionRows(direcciones);

    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual({
      id: 'd-2',
      calle: 'Calle 2',
      numero: null,
      tipo_lugar: 'escuela',
      localidad: 'Vicente López',
      descripcion: null,
    });
  });

  it('manda la descripción cuando la dirección la tiene, trimeada', () => {
    const direcciones: Direccion[] = [
      { id: 'd-1', tipo: 'terapia', calle: 'Calle 1', localidad: 'CABA', descripcion: '  Kinesióloga  ' },
    ];

    expect(toDireccionRows(direcciones)[0]?.descripcion).toBe('Kinesióloga');
  });

  // Change hojas-de-ruta-geocoding (RF-701): segundo argumento opcional `coordenadas`.
  describe('con coordenadas (RF-701)', () => {
    const direcciones: Direccion[] = [
      { id: 'd-1', tipo: 'domicilio', calle: 'San Martín 123', localidad: 'CABA' },
      { id: 'd-2', tipo: 'escuela', calle: 'Calle 2', localidad: 'Vicente López' },
    ];

    it('id presente en el mapa con Coordenada -> lat/lng viajan con el valor geocodificado', () => {
      const coordenadas = new Map<string, Coordenada | null>([['d-1', { lat: -34.6, lng: -58.4 }]]);

      const [fila] = toDireccionRows([direcciones[0] as Direccion], coordenadas);

      expect(fila).toEqual({
        id: 'd-1',
        calle: 'San Martín 123',
        numero: null,
        tipo_lugar: 'domicilio',
        localidad: 'CABA',
        descripcion: null,
        lat: -34.6,
        lng: -58.4,
      });
    });

    it('id presente en el mapa con null (geocoding falló) -> lat/lng viajan como null explícito', () => {
      const coordenadas = new Map<string, Coordenada | null>([['d-1', null]]);

      const [fila] = toDireccionRows([direcciones[0] as Direccion], coordenadas);

      expect(fila?.lat).toBeNull();
      expect(fila?.lng).toBeNull();
    });

    it('id AUSENTE del mapa (no se re-geocodificó) -> lat/lng no aparecen en la fila (preserva lo existente en el upsert)', () => {
      const coordenadas = new Map<string, Coordenada | null>([['d-1', { lat: -34.6, lng: -58.4 }]]);

      const [, filaSinGeocodificar] = toDireccionRows(direcciones, coordenadas);

      expect(filaSinGeocodificar).not.toHaveProperty('lat');
      expect(filaSinGeocodificar).not.toHaveProperty('lng');
    });

    it('sin segundo argumento (default), ninguna fila incluye lat/lng (compatibilidad)', () => {
      const rows = toDireccionRows(direcciones);

      for (const fila of rows) {
        expect(fila).not.toHaveProperty('lat');
        expect(fila).not.toHaveProperty('lng');
      }
    });
  });
});

describe('direccionesACambiar (RF-701)', () => {
  it('una dirección nueva (id no está entre las existentes) siempre se marca a cambiar', () => {
    const existentes: Direccion[] = [];
    const entrantes: Direccion[] = [{ id: 'd-nueva', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' }];

    expect(direccionesACambiar(existentes, entrantes)).toEqual(entrantes);
  });

  it('una dirección existente con calle igual no se marca a cambiar', () => {
    const existentes: Direccion[] = [{ id: 'd-1', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' }];
    const entrantes: Direccion[] = [{ id: 'd-1', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' }];

    expect(direccionesACambiar(existentes, entrantes)).toEqual([]);
  });

  it('una dirección existente con calle cambiada sí se marca a cambiar', () => {
    const existentes: Direccion[] = [{ id: 'd-1', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' }];
    const entrantes: Direccion[] = [{ id: 'd-1', tipo: 'domicilio', calle: 'Calle 1 bis', localidad: 'CABA' }];

    expect(direccionesACambiar(existentes, entrantes)).toEqual(entrantes);
  });

  it('una dirección existente con localidad cambiada sí se marca a cambiar (calle igual)', () => {
    const existentes: Direccion[] = [{ id: 'd-1', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' }];
    const entrantes: Direccion[] = [{ id: 'd-1', tipo: 'domicilio', calle: 'Calle 1', localidad: 'Vicente López' }];

    expect(direccionesACambiar(existentes, entrantes)).toEqual(entrantes);
  });

  it('un cambio de tipo sin cambiar calle/localidad NO marca a cambiar (RF-701 solo mira calle/localidad)', () => {
    const existentes: Direccion[] = [{ id: 'd-1', tipo: 'domicilio', calle: 'Calle 1', localidad: 'CABA' }];
    const entrantes: Direccion[] = [{ id: 'd-1', tipo: 'terapia', calle: 'Calle 1', localidad: 'CABA' }];

    expect(direccionesACambiar(existentes, entrantes)).toEqual([]);
  });

  it('mezcla: solo devuelve las que cambiaron o son nuevas, preservando el resto', () => {
    const existentes: Direccion[] = [
      { id: 'd-1', tipo: 'domicilio', calle: 'Sin cambios', localidad: 'CABA' },
      { id: 'd-2', tipo: 'escuela', calle: 'Vieja', localidad: 'CABA' },
    ];
    const entrantes: Direccion[] = [
      { id: 'd-1', tipo: 'domicilio', calle: 'Sin cambios', localidad: 'CABA' },
      { id: 'd-2', tipo: 'escuela', calle: 'Nueva', localidad: 'CABA' },
      { id: 'd-3', tipo: 'terapia', calle: 'Recién agregada', localidad: 'CABA' },
    ];

    const resultado = direccionesACambiar(existentes, entrantes);

    expect(resultado.map((d) => d.id)).toEqual(['d-2', 'd-3']);
  });

  it('sin direcciones entrantes devuelve []', () => {
    expect(direccionesACambiar([{ id: 'd-1', tipo: 'domicilio', calle: 'X', localidad: 'CABA' }], [])).toEqual([]);
  });
});

describe('parsePersonaACargoRow', () => {
  // Discrepancia #10 (D9): personas_a_cargo.dni es NULLable, el dominio lo requiere string.
  it('mapea una fila completa', () => {
    const row = {
      id: 'pc-1',
      nombre: 'Marta',
      apellido: 'López',
      dni: '30111222',
      parentesco: 'madre',
      telefono: '1122334455',
      telefono_alternativo: '1155667788',
    };

    expect(parsePersonaACargoRow(row)).toEqual({
      id: 'pc-1',
      nombre: 'Marta',
      apellido: 'López',
      dni: '30111222',
      parentesco: 'madre',
      telefono: '1122334455',
      telefonoAlternativo: '1155667788',
    });
  });

  it('dni NULL se traduce a cadena vacía sin lanzar; telefonos opcionales quedan undefined', () => {
    const row = { id: 'pc-2', nombre: 'Ana', apellido: 'Ruiz', dni: null, telefono: null, telefono_alternativo: null };

    const persona = parsePersonaACargoRow(row);

    expect(persona?.dni).toBe('');
    expect(persona?.telefono).toBeUndefined();
    expect(persona?.telefonoAlternativo).toBeUndefined();
  });

  it('parentesco ausente o desconocido cae a "otro" sin lanzar (triangulación)', () => {
    expect(parsePersonaACargoRow({ id: 'pc-3', nombre: 'Ana', apellido: 'Ruiz' })?.parentesco).toBe('otro');
    expect(
      parsePersonaACargoRow({ id: 'pc-4', nombre: 'Ana', apellido: 'Ruiz', parentesco: 'abuela' })?.parentesco,
    ).toBe('otro');
    expect(
      parsePersonaACargoRow({ id: 'pc-5', nombre: 'Ana', apellido: 'Ruiz', parentesco: 'tutor_legal' })?.parentesco,
    ).toBe('tutor_legal');
  });

  it('robustez: fila malformada (sin nombre) devuelve null', () => {
    expect(parsePersonaACargoRow({ id: 'pc-3', apellido: 'X', dni: '1' })).toBeNull();
    expect(parsePersonaACargoRow(null)).toBeNull();
  });
});

describe('toPersonaACargoRows', () => {
  it('escribe dni vacío como null (inverso de la nullabilidad invertida)', () => {
    const personas: PersonaACargo[] = [
      { id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: '', parentesco: 'madre' },
    ];

    expect(toPersonaACargoRows(personas)).toEqual([
      { id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: null, parentesco: 'madre', telefono: null, telefono_alternativo: null },
    ]);
  });

  it('conserva dni y telefonos cuando vienen cargados', () => {
    const personas: PersonaACargo[] = [
      { id: 'pc-2', nombre: 'Ana', apellido: 'Ruiz', dni: '111', parentesco: 'tutor_legal', telefono: '222', telefonoAlternativo: '333' },
    ];

    expect(toPersonaACargoRows(personas)).toEqual([
      { id: 'pc-2', nombre: 'Ana', apellido: 'Ruiz', dni: '111', parentesco: 'tutor_legal', telefono: '222', telefono_alternativo: '333' },
    ]);
  });
});

describe('parseAccesorios', () => {
  // Discrepancia #11 (D9): pacientes.accesorios.tipo es TEXT libre; el dominio modela una unión
  // cerrada AccesorioMovilidad. Los tipo desconocidos se descartan en silencio.
  it('mapea los accesorios_pacientes embebidos a la unión cerrada', () => {
    const rows = [
      { accesorios: { tipo: 'silla-plegable' } },
      { accesorios: { tipo: 'andador' } },
    ];

    expect(parseAccesorios(rows)).toEqual(['silla-plegable', 'andador']);
  });

  it('descarta en silencio los tipo desconocidos, conservando el resto', () => {
    const rows = [
      { accesorios: { tipo: 'silla-plegable' } },
      { accesorios: { tipo: 'muleta-experimental' } },
      { accesorios: { tipo: 'tripode' } },
    ];

    expect(parseAccesorios(rows)).toEqual(['silla-plegable', 'tripode']);
  });

  it('robustez: entrada no-array o filas malformadas no rompen, devuelven []', () => {
    expect(parseAccesorios(null)).toEqual([]);
    expect(parseAccesorios([{ accesorios: null }, {}])).toEqual([]);
  });
});

function buildRowCompleto() {
  return {
    id: 'p-1',
    nombre_a: 'Juana',
    nombre_b: null,
    apellido_a: 'Pérez',
    apellido_b: null,
    fecha_nacimiento: '2015-03-01',
    dni: '40111222',
    cuil_titular: '20401112223',
    obra_social_id: 'os-1',
    amparo_judicial: false,
    clinicos: { diagnostico: 'TEA', condicion: 'Estable' },
    cud: [{ numero_cud: 'C-1', emision: '2023-01-01', vencimiento: '2027-01-01', vigente: true }],
    personas_a_cargo: [
      { id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: '30111222', parentesco: 'tutor_legal', telefono: null, telefono_alternativo: null },
    ],
    direcciones: [{ id: 'd-1', calle: 'San Martín', numero: '123', tipo_lugar: 'domicilio', localidad: 'CABA' }],
    accesorios_pacientes: [{ accesorios: { tipo: 'andador' } }],
  };
}

describe('ensamblarPaciente', () => {
  it('combina todo en un Paciente completo, con cobertura presente', () => {
    const paciente = ensamblarPaciente(buildRowCompleto(), { num_afiliado: 'AF-123' });

    expect(paciente).toEqual({
      id: 'p-1',
      nombre: 'Juana',
      segundoNombre: undefined,
      apellido: 'Pérez',
      segundoApellido: undefined,
      fechaNacimiento: '2015-03-01',
      dni: '40111222',
      cuilTitular: '20401112223',
      diagnostico: 'TEA',
      condicion: 'Estable',
      accesorioMovilidad: ['andador'],
      obraSocialId: 'os-1',
      numeroAfiliado: { valor: 'AF-123' },
      cud: { numero: 'C-1', fechaEmision: '2023-01-01', fechaVencimiento: '2027-01-01' },
      direcciones: [{ id: 'd-1', tipo: 'domicilio', calle: 'San Martín 123', localidad: 'CABA' }],
      personasACargo: [
        { id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: '30111222', parentesco: 'tutor_legal', telefono: undefined, telefonoAlternativo: undefined },
      ],
      amparoJudicial: false,
      amparoJudicialAclaracion: undefined,
    });
  });

  it('discrepancia #2 (D9): coberturaRow null degrada a valor vacío, sin lanzar', () => {
    const paciente = ensamblarPaciente(buildRowCompleto(), null);

    expect(paciente.numeroAfiliado).toEqual({ valor: '' });
  });

  it('robustez (2.10): una direccion malformada se descarta sin romper el paciente ni el resto de la lista', () => {
    const row = buildRowCompleto();
    row.direcciones = [
      { id: 'd-bad', calle: null, numero: null, tipo_lugar: null } as unknown as (typeof row.direcciones)[0],
      ...row.direcciones,
    ];

    expect(() => ensamblarPaciente(row, null)).not.toThrow();
    const paciente = ensamblarPaciente(row, null);
    expect(paciente.direcciones).toHaveLength(1);
    expect(paciente.direcciones.map((d) => d.id)).toEqual(['d-1']);
  });

  it('robustez (2.10): una persona a cargo malformada se descarta sin romper el paciente', () => {
    const row = buildRowCompleto();
    row.personas_a_cargo = [
      { id: 'pc-bad', apellido: 'Sin nombre', dni: '1' } as unknown as (typeof row.personas_a_cargo)[0],
      ...row.personas_a_cargo,
    ];

    expect(() => ensamblarPaciente(row, null)).not.toThrow();
    expect(ensamblarPaciente(row, null).personasACargo).toHaveLength(1);
  });

  it('robustez (2.10): un accesorio con tipo desconocido se descarta sin romper el paciente', () => {
    const row = buildRowCompleto();
    row.accesorios_pacientes = [
      { accesorios: { tipo: 'algo-inventado' } },
      ...row.accesorios_pacientes,
    ];

    expect(() => ensamblarPaciente(row, null)).not.toThrow();
    expect(ensamblarPaciente(row, null).accesorioMovilidad).toEqual(['andador']);
  });

  it('robustez (2.10): fila de CUD malformada se descarta y no rompe la selección', () => {
    const row = buildRowCompleto();
    row.cud = [
      { emision: '2020-01-01', vencimiento: '2099-01-01' } as unknown as (typeof row.cud)[0],
      ...row.cud,
    ];

    expect(() => ensamblarPaciente(row, null)).not.toThrow();
    expect(ensamblarPaciente(row, null).cud).toEqual({
      numero: 'C-1',
      fechaEmision: '2023-01-01',
      fechaVencimiento: '2027-01-01',
    });
  });
});

describe('toCrearPacientePayload', () => {
  // Tarea 2.11: debe espejar exactamente lo que consume
  // 20260730180000_crear_paciente_completo.sql — mismas claves snake_case que sus `->>`. El
  // formato del identificador de afiliado NO viaja acá (RF-106, D12 vigente): es una propiedad de
  // la obra social (`ObraSocial.formatoAfiliado`), no del payload de alta de paciente.
  it('paciente mínimo: sin CUD, sin colecciones', () => {
    const payload = toCrearPacientePayload(buildNuevoPacienteMinimo());

    expect(payload).toEqual({
      nombre_a: 'Juana',
      nombre_b: null,
      apellido_a: 'Pérez',
      apellido_b: null,
      fecha_nacimiento: '',
      dni: '40111222',
      cuil_titular: '',
      obra_social_id: null,
      amparo_judicial: false,
      clinicos: { diagnostico: '', condicion: null },
      cud: null,
      direcciones: [],
      personas_a_cargo: [],
      accesorios: [],
      num_afiliado: '',
    });
  });

  it('paciente completo: todas las tablas hijas presentes con sus claves snake_case', () => {
    const payload = toCrearPacientePayload(buildNuevoPacienteCompleto());

    expect(payload).toEqual({
      nombre_a: 'Juana',
      nombre_b: 'Sol',
      apellido_a: 'Pérez',
      apellido_b: 'Gómez',
      fecha_nacimiento: '2015-03-01',
      dni: '40111222',
      cuil_titular: '20401112223',
      obra_social_id: 'os-1',
      amparo_judicial: true,
      clinicos: { diagnostico: 'TEA', condicion: 'Estable' },
      cud: { numero_cud: 'C-1', emision: '2023-01-01', vencimiento: '2027-01-01' },
      direcciones: [
        { id: 'd-1', calle: 'San Martín 123', numero: null, tipo_lugar: 'domicilio', localidad: 'CABA', descripcion: null },
      ],
      personas_a_cargo: [
        { id: 'pc-1', nombre: 'Marta', apellido: 'López', dni: '30111222', parentesco: 'madre', telefono: '111', telefono_alternativo: null },
      ],
      accesorios: ['andador', 'tripode'],
      num_afiliado: 'AF-999',
    });
  });

  it('paciente sin obraSocialId con numeroAfiliado.valor cargado: num_afiliado viaja igual', () => {
    const nuevo = buildNuevoPacienteMinimo();
    nuevo.numeroAfiliado = { valor: 'AF-777' };
    nuevo.obraSocialId = null;

    const payload = toCrearPacientePayload(nuevo);

    expect(payload.num_afiliado).toBe('AF-777');
    expect(payload.obra_social_id).toBeNull();
  });

  // Discrepancias #4, #6 (D9): datos que el usuario ve en pantalla pero la base no guarda.
  it('discrepancia #6: NO envía domicilio', () => {
    const payload = toCrearPacientePayload(buildNuevoPacienteCompleto());

    expect(payload).not.toHaveProperty('domicilio');
  });

  it('discrepancia #4: NO envía dias/horario de las direcciones; localidad sí viaja (discrepancia #3 cerrada)', () => {
    const payload = toCrearPacientePayload(buildNuevoPacienteCompleto());

    for (const direccion of payload.direcciones) {
      expect(direccion).toHaveProperty('localidad');
      expect(direccion).not.toHaveProperty('dias');
      expect(direccion).not.toHaveProperty('horario');
    }
  });

  // Change hojas-de-ruta-geocoding (RF-701): tercer... segundo argumento opcional `coordenadas`,
  // reenviado tal cual a `toDireccionRows`.
  it('con coordenadas: cada dirección del payload lleva lat/lng geocodificados', () => {
    const coordenadas = new Map<string, Coordenada | null>([['d-1', { lat: -34.6, lng: -58.4 }]]);

    const payload = toCrearPacientePayload(buildNuevoPacienteCompleto(), coordenadas);

    expect(payload.direcciones).toEqual([
      {
        id: 'd-1',
        calle: 'San Martín 123',
        numero: null,
        tipo_lugar: 'domicilio',
        localidad: 'CABA',
        descripcion: null,
        lat: -34.6,
        lng: -58.4,
      },
    ]);
  });

  it('sin coordenadas (default), las direcciones del payload no llevan lat/lng (compatibilidad)', () => {
    const payload = toCrearPacientePayload(buildNuevoPacienteCompleto());

    for (const direccion of payload.direcciones) {
      expect(direccion).not.toHaveProperty('lat');
      expect(direccion).not.toHaveProperty('lng');
    }
  });
});
