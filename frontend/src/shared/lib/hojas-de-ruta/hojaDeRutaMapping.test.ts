// hojaDeRutaMapping.ts: funciones puras de traducción fila<->dominio (tasks.md §2, design.md
// D1/D3/D4 del change integracion-hojas-de-ruta). Forma de las tablas según el veredicto del
// Checkpoint 1 opción A (repropuesta de `historial_recorridos` como paradas + dos tablas nuevas
// de agrupación):
//
//   pacientes.hoja_de_ruta  (id, fecha, franja_inicio, franja_fin, notas)
//   pacientes.recorrido     (id, hoja_de_ruta_id, vehiculo_id, conductor_id, manual, notas)
//   pacientes.historial_recorridos como parada (id, paciente_id, id_dir_inicial, id_dir_final,
//                              recorrido_id, tramo, orden, hora_estimada — fecha/id_vehiculo/
//                              estado quedan como columnas legacy que el mapeo ignora al leer)
//
// Filas hijas malformadas (campo `null` donde el tipo del dominio no lo admite) se descartan sin
// romper el agregado completo — mismo criterio que pacienteMapping con colecciones hijas. Sin red,
// sin mocks.

import { describe, expect, it } from 'vitest';
import {
  ensamblarHojaDeRuta,
  parseHojaDeRutaRow,
  parseParadaRow,
  parseRecorridoRow,
  toActualizarHojaDeRutaPayload,
  toCrearHojaDeRutaPayload,
} from './hojaDeRutaMapping';
import type { HojaDeRuta, NuevaHojaDeRuta } from '../../types/hojaDeRuta';
import { pacienteDisponibleEnRecorrido } from './pacienteDisponibleEnRecorrido';

// -------------------------------------------------------------------------------------------
// Fila de parada (historial_recorridos): incluye las columnas legacy (fecha, id_vehiculo,
// estado) para probar que se toleran al leer sin romper el parseo.
// -------------------------------------------------------------------------------------------

function filaParada(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'par-1',
    recorrido_id: 'rec-1',
    paciente_id: 'pac-1',
    id_vehiculo: 'veh-1',
    id_dir_inicial: 'dir-a',
    id_dir_final: 'dir-b',
    tramo: 'ida',
    orden: 0,
    hora_estimada: '08:30:00',
    fecha: '2026-08-04',
    estado: 'pendiente',
    ...overrides,
  };
}

function filaRecorrido(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'rec-1',
    hoja_de_ruta_id: 'hdr-1',
    vehiculo_id: 'veh-1',
    conductor_id: 'con-1',
    manual: false,
    notas: null,
    ...overrides,
  };
}

// -------------------------------------------------------------------------------------------
// 2.1 — parseHojaDeRutaRow
// -------------------------------------------------------------------------------------------

describe('parseHojaDeRutaRow', () => {
  it('mapea una fila completa de pacientes.hoja_de_ruta (TIME con segundos -> HH:mm)', () => {
    const row = {
      id: 'hdr-1',
      fecha: '2026-08-04',
      franja_inicio: '08:00:00',
      franja_fin: '20:00:00',
      notas: 'Coordinar salida de la escuela.',
    };

    expect(parseHojaDeRutaRow(row)).toEqual({
      id: 'hdr-1',
      fecha: '2026-08-04',
      franjaInicio: '08:00',
      franjaFin: '20:00',
      notas: 'Coordinar salida de la escuela.',
    });
  });

  it('conserva franjas ya en formato HH:mm (triangulación del normalizador)', () => {
    const row = { id: 'hdr-2', fecha: '2026-08-05', franja_inicio: '08:00', franja_fin: '20:00', notas: null };

    const base = parseHojaDeRutaRow(row);

    expect(base.franjaInicio).toBe('08:00');
    expect(base.franjaFin).toBe('20:00');
    expect(base.notas).toBeUndefined();
  });

  it('robustez: fila malformada (sin id, sin fecha, franjas inválidas) degrada a vacíos sin lanzar', () => {
    expect(() => parseHojaDeRutaRow(null)).not.toThrow();
    expect(() => parseHojaDeRutaRow('texto')).not.toThrow();
    expect(() => parseHojaDeRutaRow({ franja_inicio: 830, franja_fin: null })).not.toThrow();

    const base = parseHojaDeRutaRow({ franja_inicio: 830, franja_fin: null });

    expect(base.id).toBe('');
    expect(base.fecha).toBe('');
    expect(base.franjaInicio).toBe('');
    expect(base.franjaFin).toBe('');
    expect(base.notas).toBeUndefined();
  });
});

// -------------------------------------------------------------------------------------------
// 2.1 — parseRecorridoRow
// -------------------------------------------------------------------------------------------

describe('parseRecorridoRow', () => {
  it('mapea una fila completa de pacientes.recorrido', () => {
    expect(parseRecorridoRow(filaRecorrido())).toEqual({
      id: 'rec-1',
      vehiculoId: 'veh-1',
      conductorId: 'con-1',
      manual: false,
      notas: undefined,
    });
  });

  it('conserva manual=true y notas cuando vienen cargados', () => {
    const row = filaRecorrido({ manual: true, notas: 'Traslado puntual a control médico.' });

    expect(parseRecorridoRow(row)).toEqual({
      id: 'rec-1',
      vehiculoId: 'veh-1',
      conductorId: 'con-1',
      manual: true,
      notas: 'Traslado puntual a control médico.',
    });
  });

  it('manual null degrada a false sin descartar la fila', () => {
    const base = parseRecorridoRow(filaRecorrido({ manual: null }));

    expect(base).not.toBeNull();
    expect(base?.manual).toBe(false);
  });

  it('robustez: fila malformada (conductor_id null, donde el dominio exige string) devuelve null', () => {
    expect(parseRecorridoRow(filaRecorrido({ conductor_id: null }))).toBeNull();
  });

  it('robustez: fila sin id o sin vehiculo_id devuelve null', () => {
    expect(parseRecorridoRow(filaRecorrido({ id: '' }))).toBeNull();
    expect(parseRecorridoRow(filaRecorrido({ vehiculo_id: undefined }))).toBeNull();
    expect(parseRecorridoRow(null)).toBeNull();
  });
});

// -------------------------------------------------------------------------------------------
// 2.1 — parseParadaRow
// -------------------------------------------------------------------------------------------

describe('parseParadaRow', () => {
  it('mapea una parada completa (tramo ida, hora_estimada TIME -> HH:mm, columnas legacy toleradas)', () => {
    const parada = parseParadaRow(filaParada());

    expect(parada).toEqual({
      id: 'par-1',
      pacienteId: 'pac-1',
      tramo: 'ida',
      direccionOrigenId: 'dir-a',
      direccionDestinoId: 'dir-b',
      orden: 0,
      horaEstimada: '08:30',
      // Checkpoint 2: las coordenadas no se persisten — siempre undefined sobre datos reales.
      coordenadaOrigen: undefined,
    });
  });

  it('mapea tramo vuelta (triangulación del guard de unión cerrada)', () => {
    const parada = parseParadaRow(filaParada({ tramo: 'vuelta', orden: 1 }));

    expect(parada?.tramo).toBe('vuelta');
    expect(parada?.orden).toBe(1);
  });

  it('hora_estimada ausente queda undefined (horaEstimada es opcional en el dominio)', () => {
    const parada = parseParadaRow(filaParada({ hora_estimada: null }));

    expect(parada?.horaEstimada).toBeUndefined();
  });

  it('robustez: tramo null o fuera de la unión cerrada descarta la parada', () => {
    expect(parseParadaRow(filaParada({ tramo: null }))).toBeNull();
    expect(parseParadaRow(filaParada({ tramo: 'otro' }))).toBeNull();
  });

  it('robustez: orden null o no-numérico descarta la parada (el dominio exige number)', () => {
    expect(parseParadaRow(filaParada({ orden: null }))).toBeNull();
    expect(parseParadaRow(filaParada({ orden: 'primero' }))).toBeNull();
  });

  it('robustez: sin id_dir_inicial o sin id_dir_final descarta la parada', () => {
    expect(parseParadaRow(filaParada({ id_dir_inicial: null }))).toBeNull();
    expect(parseParadaRow(filaParada({ id_dir_final: undefined }))).toBeNull();
    expect(parseParadaRow(null)).toBeNull();
  });
});

// -------------------------------------------------------------------------------------------
// 2.3 — ensamblarHojaDeRuta: agregado de tres niveles agrupando por hoja_de_ruta_id y
// recorrido_id, con orden determinista (paradas por orden+id, recorridos por id).
// -------------------------------------------------------------------------------------------

describe('ensamblarHojaDeRuta', () => {
  const filaHoja = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
    id: 'hdr-1',
    fecha: '2026-08-04',
    franja_inicio: '08:00:00',
    franja_fin: '20:00:00',
    notas: null,
    ...overrides,
  });

  it('combina los tres niveles y agrupa por recorrido_id aunque las filas vengan desordenadas', () => {
    const hoja = ensamblarHojaDeRuta(
      filaHoja(),
      [filaRecorrido({ id: 'rec-2' }), filaRecorrido()],
      [
        filaParada({ id: 'par-b', recorrido_id: 'rec-1', orden: 1, tramo: 'vuelta' }),
        filaParada({ id: 'par-a', recorrido_id: 'rec-1', orden: 0 }),
        filaParada({ id: 'par-2', recorrido_id: 'rec-2' }),
      ],
    );

    expect(hoja.id).toBe('hdr-1');
    expect(hoja.fecha).toBe('2026-08-04');
    expect(hoja.franjaInicio).toBe('08:00');
    expect(hoja.franjaFin).toBe('20:00');
    expect(hoja.notas).toBeUndefined();
    expect(hoja.recorridos.map((r) => r.id)).toEqual(['rec-1', 'rec-2']);
    expect(hoja.recorridos[0]?.paradas.map((p) => p.id)).toEqual(['par-a', 'par-b']);
    expect(hoja.recorridos[1]?.paradas.map((p) => p.id)).toEqual(['par-2']);
  });

  it('agrupa por hoja_de_ruta_id: recorridos de otra hoja se descartan', () => {
    const hoja = ensamblarHojaDeRuta(filaHoja(), [
      filaRecorrido(),
      filaRecorrido({ id: 'rec-otra-hoja', hoja_de_ruta_id: 'hdr-999' }),
    ], []);

    expect(hoja.recorridos.map((r) => r.id)).toEqual(['rec-1']);
  });

  it('parada malformada (tramo null) se descarta sin romper el resto del recorrido ni la hoja', () => {
    const hoja = ensamblarHojaDeRuta(
      filaHoja(),
      [filaRecorrido()],
      [
        filaParada({ id: 'par-buena', orden: 0 }),
        filaParada({ id: 'par-malformada', tramo: null, orden: 1 }),
      ],
    );

    expect(hoja.recorridos).toHaveLength(1);
    expect(hoja.recorridos[0]?.paradas.map((p) => p.id)).toEqual(['par-buena']);
  });

  it('recorrido malformado (conductor_id null) se descarta sin romper la hoja ni las paradas de los demás', () => {
    const hoja = ensamblarHojaDeRuta(
      filaHoja(),
      [filaRecorrido(), filaRecorrido({ id: 'rec-malformado', conductor_id: null })],
      [filaParada()],
    );

    expect(hoja.recorridos).toHaveLength(1);
    expect(hoja.recorridos[0]?.id).toBe('rec-1');
    expect(hoja.recorridos[0]?.paradas).toHaveLength(1);
  });

  it('parada legacy (sin recorrido_id) no se agrupa bajo ningún recorrido y no rompe nada', () => {
    const hoja = ensamblarHojaDeRuta(
      filaHoja(),
      [filaRecorrido()],
      [filaParada({ recorrido_id: null }), filaParada()],
    );

    expect(hoja.recorridos[0]?.paradas.map((p) => p.id)).toEqual(['par-1']);
  });

  it('robustez: colecciones no-array o fila de hoja malformada no rompen, degradan a vacío', () => {
    const hoja = ensamblarHojaDeRuta(filaHoja(), null, null);

    expect(hoja.recorridos).toEqual([]);

    const hojaDegradada = ensamblarHojaDeRuta({ franja_inicio: null }, [filaRecorrido()], [filaParada()]);

    expect(hojaDegradada.id).toBe('');
    expect(hojaDegradada.recorridos).toEqual([]);
    expect(() => ensamblarHojaDeRuta('no-soy-fila', 'no-soy-array', null)).not.toThrow();
  });
});

// -------------------------------------------------------------------------------------------
// 2.5 — Triángulo con dos hojas de distinta forma; el mapeo no rompe
// pacienteDisponibleEnRecorrido (ida+vuelta del mismo paciente en el mismo recorrido).
// -------------------------------------------------------------------------------------------

describe('ensamblarHojaDeRuta (triángulo 2.5: dos hojas de distinta forma)', () => {
  it('hoja simple (1 recorrido, 1 parada) y hoja con ida+vuelta del mismo paciente: el mapeo preserva tramos', () => {
    const hojaSimple: HojaDeRuta = ensamblarHojaDeRuta(
      { id: 'hdr-a', fecha: '2026-08-04', franja_inicio: '08:00:00', franja_fin: '20:00:00', notas: null },
      [filaRecorrido({ id: 'rec-a', hoja_de_ruta_id: 'hdr-a' })],
      [filaParada({ id: 'par-a1', recorrido_id: 'rec-a', paciente_id: 'pac-x', tramo: 'ida', orden: 0 })],
    );

    const hojaIdaVuelta: HojaDeRuta = ensamblarHojaDeRuta(
      { id: 'hdr-b', fecha: '2026-08-05', franja_inicio: '08:00:00', franja_fin: '20:00:00', notas: null },
      [filaRecorrido({ id: 'rec-b1', hoja_de_ruta_id: 'hdr-b' }), filaRecorrido({ id: 'rec-b2', hoja_de_ruta_id: 'hdr-b' })],
      [
        filaParada({ id: 'par-b-ida', recorrido_id: 'rec-b1', paciente_id: 'pac-x', tramo: 'ida', orden: 0 }),
        filaParada({ id: 'par-b-vuelta', recorrido_id: 'rec-b1', paciente_id: 'pac-x', tramo: 'vuelta', orden: 1 }),
        filaParada({ id: 'par-b2', recorrido_id: 'rec-b2', paciente_id: 'pac-y', tramo: 'ida', orden: 0 }),
      ],
    );

    expect(hojaSimple.recorridos).toHaveLength(1);
    expect(hojaSimple.recorridos[0]?.paradas).toHaveLength(1);

    expect(hojaIdaVuelta.recorridos).toHaveLength(2);
    expect(hojaIdaVuelta.recorridos[0]?.paradas).toHaveLength(2);
    expect(hojaIdaVuelta.recorridos[0]?.paradas.map((p) => p.tramo)).toEqual(['ida', 'vuelta']);
    expect(hojaIdaVuelta.recorridos[1]?.paradas).toHaveLength(1);

    // El caso que ya cubre pacienteDisponibleEnRecorrido: ida+vuelta del mismo paciente en el
    // mismo recorrido -> deja de estar disponible; con solo ida, sigue disponible.
    const paradasB1 = hojaIdaVuelta.recorridos[0]?.paradas ?? [];
    const paradasA = hojaSimple.recorridos[0]?.paradas ?? [];

    expect(pacienteDisponibleEnRecorrido(paradasB1, 'pac-x')).toBe(false);
    expect(pacienteDisponibleEnRecorrido(paradasB1, 'pac-y')).toBe(true);
    expect(pacienteDisponibleEnRecorrido(paradasA, 'pac-x')).toBe(true);
  });
});

// -------------------------------------------------------------------------------------------
// 2.4 — toCrearHojaDeRutaPayload / toActualizarHojaDeRutaPayload
// -------------------------------------------------------------------------------------------

function buildNuevaHojaDeRuta(): NuevaHojaDeRuta {
  return {
    fecha: '2026-08-04',
    franjaInicio: '08:00',
    franjaFin: '20:00',
    notas: 'Nota de la hoja',
    recorridos: [
      {
        vehiculoId: 'veh-1',
        conductorId: 'con-1',
        manual: false,
        paradas: [
          {
            pacienteId: 'pac-1',
            tramo: 'ida',
            direccionOrigenId: 'dir-a',
            direccionDestinoId: 'dir-b',
            orden: 0,
            horaEstimada: '08:30',
            coordenadaOrigen: { lat: -34.6091, lng: -58.4416 },
          },
        ],
      },
    ],
  };
}

describe('toCrearHojaDeRutaPayload', () => {
  it('mapea el agregado a jsonb con claves snake_case, sincronizando id_vehiculo de cada parada con vehiculo_id del recorrido (D3)', () => {
    const payload = toCrearHojaDeRutaPayload(buildNuevaHojaDeRuta());

    expect(payload).toEqual({
      fecha: '2026-08-04',
      franja_inicio: '08:00',
      franja_fin: '20:00',
      notas: 'Nota de la hoja',
      recorridos: [
        {
          vehiculo_id: 'veh-1',
          conductor_id: 'con-1',
          manual: false,
          notas: null,
          paradas: [
            {
              paciente_id: 'pac-1',
              id_vehiculo: 'veh-1',
              id_dir_inicial: 'dir-a',
              id_dir_final: 'dir-b',
              tramo: 'ida',
              orden: 0,
              hora_estimada: '08:30',
            },
          ],
        },
      ],
    });
  });

  it('Checkpoint 2: las coordenadas del fixture NUNCA viajan al payload', () => {
    const payload = toCrearHojaDeRutaPayload(buildNuevaHojaDeRuta());

    const parada = payload.recorridos[0]?.paradas[0];

    expect(parada).not.toHaveProperty('coordenadaOrigen');
    expect(parada).not.toHaveProperty('coordenada_origen');
  });

  it('horaEstimada ausente se escribe null; notas ausente se escribe null', () => {
    const payload = toCrearHojaDeRutaPayload({
      fecha: '2026-08-04',
      franjaInicio: '08:00',
      franjaFin: '20:00',
      recorridos: [
        {
          vehiculoId: 'veh-1',
          conductorId: 'con-1',
          manual: true,
          paradas: [{ pacienteId: 'pac-1', tramo: 'ida', direccionOrigenId: 'dir-a', direccionDestinoId: 'dir-b', orden: 0 }],
        },
      ],
    });

    expect(payload.notas).toBeNull();
    expect(payload.recorridos[0]?.notas).toBeNull();
    expect(payload.recorridos[0]?.paradas[0]?.hora_estimada).toBeNull();
  });
});

describe('toActualizarHojaDeRutaPayload', () => {
  it('Partial sin recorridos: la clave NO existe en el payload — significa "no tocar", jamás "vaciar"', () => {
    const payload = toActualizarHojaDeRutaPayload({ notas: 'Solo cambia la nota' });

    expect(payload).toEqual({ notas: 'Solo cambia la nota' });
    expect(payload).not.toHaveProperty('recorridos');
  });

  it('Partial con una sola franja: mapea solo esa clave', () => {
    const payload = toActualizarHojaDeRutaPayload({ franjaFin: '21:00' });

    expect(payload).toEqual({ franja_fin: '21:00' });
  });

  it('recorridos: [] SÍ viaja (vaciar la colección es una intención explícita, distinta de no tocar)', () => {
    const payload = toActualizarHojaDeRutaPayload({ recorridos: [] });

    expect(payload.recorridos).toEqual([]);
    expect(payload).toHaveProperty('recorridos');
  });

  it('recorridos presentes se mapean igual que en el alta, con id_vehiculo sincronizado', () => {
    const payload = toActualizarHojaDeRutaPayload({
      fecha: '2026-08-05',
      recorridos: [
        {
          id: 'rec-1',
          vehiculoId: 'veh-1',
          conductorId: 'con-1',
          manual: false,
          notas: undefined,
          paradas: [
            {
              id: 'par-1',
              pacienteId: 'pac-1',
              tramo: 'ida',
              direccionOrigenId: 'dir-a',
              direccionDestinoId: 'dir-b',
              orden: 0,
              horaEstimada: '08:30',
            },
          ],
        },
      ],
    });

    expect(payload.fecha).toBe('2026-08-05');
    expect(payload.recorridos).toEqual([
          {
            vehiculo_id: 'veh-1',
            conductor_id: 'con-1',
            manual: false,
            notas: null,
            paradas: [
              {
                paciente_id: 'pac-1',
                id_vehiculo: 'veh-1',
                id_dir_inicial: 'dir-a',
                id_dir_final: 'dir-b',
                tramo: 'ida',
                orden: 0,
                hora_estimada: '08:30',
              },
            ],
          },
        ],
    );
  });

  it('payload vacío se traduce a objeto vacío, sin claves inventadas', () => {
    expect(toActualizarHojaDeRutaPayload({})).toEqual({});
  });
});
