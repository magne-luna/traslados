import { describe, expect, it } from 'vitest';
import {
  parseConductorRow,
  parseEstadoConductor,
  toEstadoConductorRow,
  parseAsignacionRow,
  toAsignacionRows,
  ensamblarConductor,
  toActualizarConductorPayload,
} from './conductorMapping';
import type { ActualizacionConductor } from '../../types/conductor';

// conductorMapping.ts: mapeo puro fila<->dominio para Conductores (tasks.md §6, design.md
// D6/D7/D10/D12/D13 del change `integracion-conductores-vehiculos`). Sin red, sin mocks, sin `any`.

describe('parseConductorRow', () => {
  it('mapea los campos base de una fila plana de conductores.conductores (renombres)', () => {
    const row = {
      id: 'c-1',
      nombre: 'Marta',
      apellido: 'Pérez',
      dni: '30111222',
      cuil: '27-30111222-4',
      telefono: '11-5555-1234',
      fecha_nacimiento: '1985-03-10',
      domicilio: 'Av. Siempre Viva 742',
      estado: 'operando',
      notas: 'No traslada pacientes con carga física',
    };

    expect(parseConductorRow(row)).toEqual({
      id: 'c-1',
      nombre: 'Marta',
      apellido: 'Pérez',
      documento: '30111222',
      cuil: '27-30111222-4',
      telefono: '11-5555-1234',
      fechaNacimiento: '1985-03-10',
      domicilio: 'Av. Siempre Viva 742',
      estado: 'operando',
      observaciones: 'No traslada pacientes con carga física',
    });
  });

  it('domicilio y cuil nullable en la base degradan a string vacío, nunca se descarta la fila', () => {
    const row = {
      id: 'c-2',
      nombre: 'Juan',
      apellido: 'Gómez',
      dni: '28999111',
      cuil: null,
      telefono: null,
      fecha_nacimiento: null,
      domicilio: null,
      estado: 'operando',
      notas: null,
    };

    const parsed = parseConductorRow(row);
    expect(parsed?.domicilio).toBe('');
    expect(parsed?.cuil).toBe('');
    expect(parsed?.telefono).toBeUndefined();
    expect(parsed?.fechaNacimiento).toBeUndefined();
    expect(parsed?.observaciones).toBeUndefined();
  });

  it('fila sin id -> se descarta (null), no rompe el list() entero', () => {
    const row = { dni: '30111222', nombre: 'Marta', apellido: 'Pérez' };
    expect(parseConductorRow(row)).toBeNull();
  });

  it('fila sin dni -> se descarta (null)', () => {
    const row = { id: 'c-1', nombre: 'Marta', apellido: 'Pérez' };
    expect(parseConductorRow(row)).toBeNull();
  });

  it('valor no-objeto -> se descarta (null)', () => {
    expect(parseConductorRow(null)).toBeNull();
    expect(parseConductorRow(undefined)).toBeNull();
    expect(parseConductorRow('not a row')).toBeNull();
  });
});

describe('toActualizarConductorPayload (6.8): semántica parcial', () => {
  it('editar solo el teléfono NO emite la clave asignaciones (ni ninguna otra ausente)', () => {
    const cambios: ActualizacionConductor = { telefono: '11-4444-5555' };
    const payload = toActualizarConductorPayload(cambios);

    expect(payload).toEqual({ telefono: '11-4444-5555' });
    expect('asignaciones' in payload).toBe(false);
  });

  it('regresión: el payload emitido NUNCA contiene la clave permitirMultiple (D7 §Colisión)', () => {
    const cambios: ActualizacionConductor = {
      asignaciones: [{ id: 'asig-1', vehiculoId: 'v-1', semana: '2026-W30' }],
    };
    const payload = toActualizarConductorPayload(cambios);

    expect('permitirMultiple' in payload).toBe(false);
  });

  it('regresión: el payload emitido NUNCA contiene la clave restricciones (D6-B)', () => {
    const cambios: ActualizacionConductor = { observaciones: 'No traslada pacientes con carga física' };
    const payload = toActualizarConductorPayload(cambios);

    expect('restricciones' in payload).toBe(false);
  });

  it('una colección de asignaciones explícita (incluso vacía) SÍ viaja: clave presente ≠ ausente', () => {
    const payload = toActualizarConductorPayload({ asignaciones: [] });

    expect('asignaciones' in payload).toBe(true);
    expect(payload.asignaciones).toEqual([]);
  });

  it('asignaciones con contenido se traduce con toAsignacionRows', () => {
    const payload = toActualizarConductorPayload({
      asignaciones: [{ id: 'asig-1', vehiculoId: 'v-1', semana: '2026-W30' }],
    });

    expect(payload.asignaciones).toEqual([
      { id: 'asig-1', vehiculo_id: 'v-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' },
    ]);
  });

  it('observaciones vacío ("") vacía el campo: se traduce a null, no a string vacío', () => {
    expect(toActualizarConductorPayload({ observaciones: '' })).toEqual({ notas: null });
  });

  it('fechaNacimiento vacía ("") se traduce a null', () => {
    expect(toActualizarConductorPayload({ fechaNacimiento: '' })).toEqual({ fecha_nacimiento: null });
  });

  it('estado se traduce con toEstadoConductorRow', () => {
    expect(toActualizarConductorPayload({ estado: 'fuera-de-servicio' })).toEqual({ estado: 'fuera de servicio' });
  });

  it('todos los campos escalares presentes a la vez se emiten todos, con los renombres correctos', () => {
    const cambios: ActualizacionConductor = {
      apellido: 'Pérez',
      nombre: 'Marta',
      documento: '30111222',
      telefono: '11-5555-1234',
      fechaNacimiento: '1985-03-10',
      domicilio: 'Av. Siempre Viva 742',
      cuil: '27-30111222-4',
      estado: 'operando',
      observaciones: 'Sin observaciones',
    };

    expect(toActualizarConductorPayload(cambios)).toEqual({
      apellido: 'Pérez',
      nombre: 'Marta',
      dni: '30111222',
      telefono: '11-5555-1234',
      fecha_nacimiento: '1985-03-10',
      domicilio: 'Av. Siempre Viva 742',
      cuil: '27-30111222-4',
      estado: 'operando',
      notas: 'Sin observaciones',
    });
  });

  it('sin ningún cambio -> payload vacío', () => {
    expect(toActualizarConductorPayload({})).toEqual({});
  });
});

describe('restricciones no se mapea (D6-B, 6.4)', () => {
  it('una fila con una columna inesperada `restricciones` se ignora sin romper la lectura', () => {
    const row = {
      id: 'c-3',
      nombre: 'Ana',
      apellido: 'Ríos',
      dni: '27888444',
      cuil: '27-27888444-1',
      domicilio: 'Belgrano 100',
      estado: 'operando',
      notas: 'Sin observaciones',
      restricciones: ['no-carga-fisica'], // columna inexistente, no debe aparecer en el resultado
    };

    const parsed = parseConductorRow(row);
    expect(parsed).not.toBeNull();
    expect(parsed).not.toHaveProperty('restricciones');
  });
});

describe('parseAsignacionRow (6.5, design.md D7)', () => {
  it('mapea (fecha_init, fecha_fin_semana) -> AsignacionSemanal { id, vehiculoId, semana } vía semanaIso.ts', () => {
    const row = {
      id: 'asig-1',
      vehiculo_id: 'v-1',
      fecha_init: '2026-07-20',
      fecha_fin_semana: '2026-07-26',
    };

    expect(parseAsignacionRow(row)).toEqual({ id: 'asig-1', vehiculoId: 'v-1', semana: '2026-W30' });
  });

  it('fila incoherente (fecha_init que no es lunes): deriva la semana que CONTIENE fecha_init, no la descarta ni la corrige', () => {
    // 2026-07-22 es miércoles, dentro de la semana 2026-W30 (lunes 2026-07-20 a domingo
    // 2026-07-26). fecha_fin_semana llega desalineada (no es domingo de esa semana) y no se usa
    // para "corregir" ni se descarta la fila: se deriva la semana que contiene fecha_init tal cual.
    const row = {
      id: 'asig-2',
      vehiculo_id: 'v-2',
      fecha_init: '2026-07-22',
      fecha_fin_semana: '2026-07-24',
    };

    expect(parseAsignacionRow(row)).toEqual({ id: 'asig-2', vehiculoId: 'v-2', semana: '2026-W30' });
  });

  it('fila sin id, vehiculo_id o alguna fecha -> se descarta (null), no rompe el resto', () => {
    expect(parseAsignacionRow({ vehiculo_id: 'v-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' })).toBeNull();
    expect(parseAsignacionRow({ id: 'asig-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' })).toBeNull();
    expect(parseAsignacionRow({ id: 'asig-1', vehiculo_id: 'v-1', fecha_fin_semana: '2026-07-26' })).toBeNull();
    expect(parseAsignacionRow({ id: 'asig-1', vehiculo_id: 'v-1', fecha_init: '2026-07-20' })).toBeNull();
  });

  it('valor no-objeto -> se descarta (null)', () => {
    expect(parseAsignacionRow(null)).toBeNull();
    expect(parseAsignacionRow(undefined)).toBeNull();
    expect(parseAsignacionRow('not a row')).toBeNull();
  });
});

describe('toAsignacionRows (6.6, design.md D7)', () => {
  it('la vuelta de parseAsignacionRow: fecha_init = lunes, fecha_fin_semana = domingo de esa semana', () => {
    const asignaciones = [{ id: 'asig-1', vehiculoId: 'v-1', semana: '2026-W30' }];

    expect(toAsignacionRows(asignaciones)).toEqual([
      { id: 'asig-1', vehiculo_id: 'v-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' },
    ]);
  });

  it('múltiples asignaciones se mapean cada una de forma independiente', () => {
    const asignaciones = [
      { id: 'asig-1', vehiculoId: 'v-1', semana: '2026-W30' },
      { id: 'asig-2', vehiculoId: 'v-2', semana: '2026-W53' },
    ];

    expect(toAsignacionRows(asignaciones)).toEqual([
      { id: 'asig-1', vehiculo_id: 'v-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' },
      { id: 'asig-2', vehiculo_id: 'v-2', fecha_init: '2026-12-28', fecha_fin_semana: '2027-01-03' },
    ]);
  });

  it('lista vacía -> []', () => {
    expect(toAsignacionRows([])).toEqual([]);
  });

  it('round-trip: toAsignacionRows(parseAsignacionRow(row)) reconstruye la misma semana', () => {
    const row = { id: 'asig-9', vehiculo_id: 'v-9', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' };
    const asignacion = parseAsignacionRow(row);
    expect(asignacion).not.toBeNull();
    if (asignacion === null) return;
    expect(toAsignacionRows([asignacion])).toEqual([row]);
  });
});

describe('ensamblarConductor (6.7, design.md D11)', () => {
  it('arma el Conductor completo con sus asignaciones ordenadas por fecha_init asc', () => {
    const row = {
      id: 'c-1',
      nombre: 'Marta',
      apellido: 'Pérez',
      dni: '30111222',
      cuil: '27-30111222-4',
      telefono: '11-5555-1234',
      fecha_nacimiento: '1985-03-10',
      domicilio: 'Av. Siempre Viva 742',
      estado: 'operando',
      notas: 'Sin observaciones',
      conductores_vehiculos: [
        { id: 'asig-2', vehiculo_id: 'v-2', fecha_init: '2026-07-27', fecha_fin_semana: '2026-08-02' },
        { id: 'asig-1', vehiculo_id: 'v-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' },
      ],
    };

    const conductor = ensamblarConductor(row);
    expect(conductor?.asignaciones).toEqual([
      { id: 'asig-1', vehiculoId: 'v-1', semana: '2026-W30' },
      { id: 'asig-2', vehiculoId: 'v-2', semana: '2026-W31' },
    ]);
  });

  it('empate de fecha_init: desempata por id, orden estable entre corridas', () => {
    const row = {
      id: 'c-1',
      nombre: 'Marta',
      apellido: 'Pérez',
      dni: '30111222',
      cuil: '27-30111222-4',
      domicilio: 'Av. Siempre Viva 742',
      estado: 'operando',
      conductores_vehiculos: [
        { id: 'asig-b', vehiculo_id: 'v-2', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' },
        { id: 'asig-a', vehiculo_id: 'v-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' },
      ],
    };

    expect(ensamblarConductor(row)?.asignaciones.map((a) => a.id)).toEqual(['asig-a', 'asig-b']);
  });

  it('sin embed conductores_vehiculos -> asignaciones: [], nunca undefined', () => {
    const row = {
      id: 'c-1',
      nombre: 'Marta',
      apellido: 'Pérez',
      dni: '30111222',
      cuil: '27-30111222-4',
      domicilio: 'Av. Siempre Viva 742',
      estado: 'operando',
    };

    expect(ensamblarConductor(row)?.asignaciones).toEqual([]);
  });

  it('conductores_vehiculos no-array -> asignaciones: []', () => {
    const row = {
      id: 'c-1',
      nombre: 'Marta',
      apellido: 'Pérez',
      dni: '30111222',
      cuil: '27-30111222-4',
      domicilio: 'Av. Siempre Viva 742',
      estado: 'operando',
      conductores_vehiculos: null,
    };

    expect(ensamblarConductor(row)?.asignaciones).toEqual([]);
  });

  it('una fila de asignación incoherente (sin id) se descarta sin romper el conductor', () => {
    const row = {
      id: 'c-1',
      nombre: 'Marta',
      apellido: 'Pérez',
      dni: '30111222',
      cuil: '27-30111222-4',
      domicilio: 'Av. Siempre Viva 742',
      estado: 'operando',
      conductores_vehiculos: [
        { vehiculo_id: 'v-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' }, // sin id
        { id: 'asig-1', vehiculo_id: 'v-1', fecha_init: '2026-07-20', fecha_fin_semana: '2026-07-26' },
      ],
    };

    expect(ensamblarConductor(row)?.asignaciones).toEqual([{ id: 'asig-1', vehiculoId: 'v-1', semana: '2026-W30' }]);
  });

  it('fila de conductor inválida -> null, no rompe el list() entero', () => {
    expect(ensamblarConductor({ nombre: 'Sin id ni dni' })).toBeNull();
    expect(ensamblarConductor(null)).toBeNull();
  });
});

describe('parseEstadoConductor (D13)', () => {
  it("'fuera de servicio' (con espacio, valor de la base) -> 'fuera-de-servicio' (guion, dominio)", () => {
    expect(parseEstadoConductor('fuera de servicio')).toBe('fuera-de-servicio');
  });

  it("'operando' -> 'operando' (idéntico en los dos lados)", () => {
    expect(parseEstadoConductor('operando')).toBe('operando');
  });

  it('valor desconocido de la base -> degrada a `operando`, nunca lanza', () => {
    expect(parseEstadoConductor('valor-inventado')).toBe('operando');
    expect(parseEstadoConductor(null)).toBe('operando');
    expect(parseEstadoConductor(undefined)).toBe('operando');
    expect(parseEstadoConductor(42)).toBe('operando');
  });
});

describe('toEstadoConductorRow (D13)', () => {
  it("'fuera-de-servicio' (dominio) -> 'fuera de servicio' (base, con espacio)", () => {
    expect(toEstadoConductorRow('fuera-de-servicio')).toBe('fuera de servicio');
  });

  it("'operando' -> 'operando'", () => {
    expect(toEstadoConductorRow('operando')).toBe('operando');
  });
});
