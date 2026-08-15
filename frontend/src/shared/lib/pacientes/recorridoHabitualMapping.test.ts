import { describe, expect, it } from 'vitest';
import { parseRecorridoHabitualRow, toCrearRecorridoHabitualPayload } from './recorridoHabitualMapping';
import type { NuevoRecorridoHabitual } from '../../types/recorridoHabitual';

// Mapeo puro fila<->dominio de "Destinos habituales" (RF-110, `pacientes.recorridos`). Sin red,
// sin `any`, sin `as` sobre datos externos — mismo criterio que facturaMapping.ts.

function filaRecorrido(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'r-1',
    paciente_id: 'p-1',
    id_dir_inicial: 'd-1',
    id_dir_final: 'd-2',
    dia_semana: 'lunes',
    hora: '08:30:00',
    ...overrides,
  };
}

function nuevoRecorridoMinimo(): NuevoRecorridoHabitual {
  return {
    pacienteId: 'p-1',
    direccionInicialId: 'd-1',
    direccionFinalId: 'd-2',
    diaSemana: 'lunes',
    hora: '08:30',
  };
}

describe('parseRecorridoHabitualRow', () => {
  it('mapea una fila completa a RecorridoHabitual, renombrando id_dir_inicial/id_dir_final/paciente_id', () => {
    const fila = filaRecorrido();

    expect(parseRecorridoHabitualRow(fila)).toEqual({
      id: 'r-1',
      pacienteId: 'p-1',
      direccionInicialId: 'd-1',
      direccionFinalId: 'd-2',
      diaSemana: 'lunes',
      hora: '08:30',
    });
  });

  it('recorta segundos de una columna `hora` tipo `time` (HH:MM:SS -> HH:MM)', () => {
    const fila = filaRecorrido({ hora: '14:05:00' });

    expect(parseRecorridoHabitualRow(fila).hora).toBe('14:05');
  });

  it('conserva una `hora` que ya viene sin segundos (HH:MM)', () => {
    const fila = filaRecorrido({ hora: '14:05' });

    expect(parseRecorridoHabitualRow(fila).hora).toBe('14:05');
  });

  it.each(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'])(
    'acepta "%s" como día de semana válido',
    (dia) => {
      const fila = filaRecorrido({ dia_semana: dia });
      expect(parseRecorridoHabitualRow(fila).diaSemana).toBe(dia);
    },
  );

  it('un dia_semana fuera de la unión cerrada (dato corrupto/legacy) cae a "lunes" en vez de lanzar', () => {
    const fila = filaRecorrido({ dia_semana: 'feriado' });

    expect(parseRecorridoHabitualRow(fila).diaSemana).toBe('lunes');
  });

  it('una fila que no es un objeto no lanza: cae a strings vacíos y "lunes"', () => {
    expect(parseRecorridoHabitualRow(null)).toEqual({
      id: '',
      pacienteId: '',
      direccionInicialId: '',
      direccionFinalId: '',
      diaSemana: 'lunes',
      hora: '',
    });
  });
});

describe('toCrearRecorridoHabitualPayload', () => {
  it('arma el payload snake_case para insert, sin id', () => {
    expect(toCrearRecorridoHabitualPayload(nuevoRecorridoMinimo())).toEqual({
      paciente_id: 'p-1',
      id_dir_inicial: 'd-1',
      id_dir_final: 'd-2',
      dia_semana: 'lunes',
      hora: '08:30',
    });
  });
});
