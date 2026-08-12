import { describe, expect, it } from 'vitest';
import type { Paciente } from '../../types/paciente';
import type { ParadaRecorrido, Recorrido } from '../../types/hojaDeRuta';
import type { Vehiculo } from '../../types/vehiculo';
import { sugerirRecorridoExistente } from './sugerirRecorridoExistente';

// Función pura (feedback de usuario, RN-HR-01/RN-VE-01/RN-VE-02): al crear un recorrido nuevo,
// sugiere recorridos de HOY compatibles (vehículo con lugar y accesorios OK, algún horario
// dentro de una ventana configurable) a los que el paciente podría sumarse en vez de armar uno
// desde cero. Nunca automático — el operador decide si usa la sugerencia (mismo espíritu que
// sugerirOrdenPorCercania.ts). Sin efectos de red ni localStorage.

function vehiculo(id: string, overrides: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id,
    patente: `AB${id}ZX`,
    modelo: 'BYD Dolphin Mini',
    capacidad: 4,
    accesoriosCompatibles: [],
    estado: 'habilitado',
    ...overrides,
  } as Vehiculo;
}

function paciente(id: string, overrides: Partial<Paciente> = {}): Paciente {
  return {
    id,
    nombre: 'Nombre',
    apellido: 'Apellido',
    direcciones: [],
    accesorioMovilidad: [],
    ...overrides,
  } as Paciente;
}

function parada(overrides: Partial<ParadaRecorrido> = {}): ParadaRecorrido {
  return {
    id: `parada-${Math.random()}`,
    pacienteId: 'otro-paciente',
    tramo: 'ida',
    direccionOrigenId: 'dir-1',
    direccionDestinoId: 'dir-2',
    orden: 0,
    ...overrides,
  };
}

function recorrido(id: string, overrides: Partial<Recorrido> = {}): Recorrido {
  return {
    id,
    vehiculoId: `veh-${id}`,
    conductorId: `cond-${id}`,
    manual: false,
    paradas: [],
    ...overrides,
  };
}

describe('sugerirRecorridoExistente', () => {
  it('sin horaEstimada elegida, no sugiere nada (sin señal temporal, no adivina)', () => {
    const v = vehiculo('veh-r1');
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });

    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '');

    expect(resultado).toEqual([]);
  });

  it('horaEstimada con formato inválido degrada a sin sugerencias, nunca lanza (borde)', () => {
    const v = vehiculo('veh-r1');
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });

    expect(() => sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', 'no-es-una-hora')).not.toThrow();
    expect(sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', 'no-es-una-hora')).toEqual([]);
  });

  it('sugiere un recorrido con una parada dentro de la ventana horaria por defecto (RN-HR-01)', () => {
    const v = vehiculo('veh-r1');
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });

    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '11:20');

    expect(resultado).toEqual([{ recorrido: r, vehiculo: v }]);
  });

  it('no sugiere un recorrido cuya parada más cercana excede la ventana horaria (borde)', () => {
    const v = vehiculo('veh-r1');
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });

    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '12:01');

    expect(resultado).toEqual([]);
  });

  it('incluye el límite exacto de la ventana (borde, triangulación)', () => {
    const v = vehiculo('veh-r1');
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });

    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '12:00');

    expect(resultado).toEqual([{ recorrido: r, vehiculo: v }]);
  });

  it('excluye recorridos cuyo vehículo no tiene capacidad disponible', () => {
    const v = vehiculo('veh-r1', { capacidad: 1 });
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });

    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '11:10');

    expect(resultado).toEqual([]);
  });

  it('excluye recorridos cuyo vehículo es incompatible con el accesorio de movilidad del paciente (RN-VE-01)', () => {
    const v = vehiculo('veh-r1', { accesoriosCompatibles: [] });
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });
    const p = paciente('p1', { accesorioMovilidad: ['silla-plegable'] });

    const resultado = sugerirRecorridoExistente([r], [v], p, 'ida', '11:10');

    expect(resultado).toEqual([]);
  });

  it('excluye recorridos cuyo vehículo está deshabilitado (RN-VE-02)', () => {
    const v = vehiculo('veh-r1', { estado: 'fuera-de-servicio' });
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });

    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '11:10');

    expect(resultado).toEqual([]);
  });

  it('excluye un recorrido donde el paciente ya tiene una parada del mismo tramo cargada', () => {
    const v = vehiculo('veh-r1');
    const r = recorrido('r1', {
      vehiculoId: v.id,
      paradas: [parada({ horaEstimada: '11:00', pacienteId: 'p1', tramo: 'ida' })],
    });

    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '11:10');

    expect(resultado).toEqual([]);
  });

  it('incluye un recorrido donde el paciente ya tiene el tramo OPUESTO cargado (RN-HR-02, triangulación)', () => {
    const v = vehiculo('veh-r1');
    const r = recorrido('r1', {
      vehiculoId: v.id,
      paradas: [parada({ horaEstimada: '11:00', pacienteId: 'p1', tramo: 'vuelta' })],
    });

    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '11:10');

    expect(resultado).toEqual([{ recorrido: r, vehiculo: v }]);
  });

  it('acepta una ventanaMinutos configurable distinta del default (no hardcodeado)', () => {
    const v = vehiculo('veh-r1');
    const r = recorrido('r1', { vehiculoId: v.id, paradas: [parada({ horaEstimada: '11:00' })] });

    // 11 min de diferencia: con ventana default (60) entraría, con ventana explícita de 10 no.
    const resultado = sugerirRecorridoExistente([r], [v], paciente('p1'), 'ida', '11:11', 10);

    expect(resultado).toEqual([]);
  });

  it('con 2+ candidatos, ordena por cercanía horaria — el más próximo primero (triangulación)', () => {
    const v1 = vehiculo('veh-r1');
    const v2 = vehiculo('veh-r2');
    const lejano = recorrido('lejano', { vehiculoId: v1.id, paradas: [parada({ horaEstimada: '11:00' })] });
    const cercano = recorrido('cercano', { vehiculoId: v2.id, paradas: [parada({ horaEstimada: '11:25' })] });

    const resultado = sugerirRecorridoExistente([lejano, cercano], [v1, v2], paciente('p1'), 'ida', '11:30');

    expect(resultado.map((c) => c.recorrido.id)).toEqual(['cercano', 'lejano']);
  });

  it('devuelve [] si no hay recorridos hoy (borde)', () => {
    expect(sugerirRecorridoExistente([], [], paciente('p1'), 'ida', '11:00')).toEqual([]);
  });
});
