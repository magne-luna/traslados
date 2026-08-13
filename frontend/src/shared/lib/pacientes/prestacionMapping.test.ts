import { describe, expect, it } from 'vitest';
import type { NuevaPrestacion, Prestacion } from '../../types/prestacion';
import { parsePrestacionRow, toNuevaPrestacionRow, toPrestacionRow, toPrestacionRows } from './prestacionMapping';

describe('parsePrestacionRow', () => {
  it('mapea una fila completa de pacientes.prestaciones', () => {
    const row = {
      id: 'prest-1',
      paciente_id: 'pac-1',
      nombre: 'Kinesiología',
      descripcion: 'Sesión semanal',
      activa: true,
    };

    expect(parsePrestacionRow(row)).toEqual({
      id: 'prest-1',
      pacienteId: 'pac-1',
      nombre: 'Kinesiología',
      descripcion: 'Sesión semanal',
      activa: true,
    });
  });

  it('sin descripcion, queda undefined; activa false se respeta tal cual (no se fuerza a true)', () => {
    const row = { id: 'prest-2', paciente_id: 'pac-1', nombre: 'Fonoaudiología', activa: false };

    expect(parsePrestacionRow(row)).toEqual({
      id: 'prest-2',
      pacienteId: 'pac-1',
      nombre: 'Fonoaudiología',
      descripcion: undefined,
      activa: false,
    });
  });

  it('activa ausente o con un valor no booleano degrada a true (mismo default que la columna, nunca "inactiva" por omisión)', () => {
    const row = { id: 'prest-3', paciente_id: 'pac-1', nombre: 'Terapia ocupacional' };

    expect(parsePrestacionRow(row)?.activa).toBe(true);
  });

  it('robustez: fila malformada (sin id, sin paciente_id, sin nombre, o nombre vacío) devuelve null en vez de romper', () => {
    expect(parsePrestacionRow({ paciente_id: 'pac-1', nombre: 'Kinesiología' })).toBeNull();
    expect(parsePrestacionRow({ id: 'prest-1', nombre: 'Kinesiología' })).toBeNull();
    expect(parsePrestacionRow({ id: 'prest-1', paciente_id: 'pac-1' })).toBeNull();
    expect(parsePrestacionRow({ id: 'prest-1', paciente_id: 'pac-1', nombre: '' })).toBeNull();
    expect(parsePrestacionRow(null)).toBeNull();
    expect(parsePrestacionRow('prest-1')).toBeNull();
  });
});

describe('toPrestacionRow / toPrestacionRows', () => {
  const kinesiologia: Prestacion = {
    id: 'prest-1',
    pacienteId: 'pac-1',
    nombre: 'Kinesiología',
    descripcion: 'Sesión semanal',
    activa: true,
  };

  it('mapea una Prestacion del dominio a la fila de escritura, con descripción trimeada', () => {
    const conEspacios: Prestacion = { ...kinesiologia, descripcion: '  Sesión semanal  ' };

    expect(toPrestacionRow(conEspacios)).toEqual({
      id: 'prest-1',
      paciente_id: 'pac-1',
      nombre: 'Kinesiología',
      descripcion: 'Sesión semanal',
      activa: true,
    });
  });

  it('sin descripción (undefined o cadena vacía), escribe null', () => {
    const sinDescripcion: Prestacion = { ...kinesiologia, descripcion: undefined };
    const conVacia: Prestacion = { ...kinesiologia, descripcion: '   ' };

    expect(toPrestacionRow(sinDescripcion).descripcion).toBeNull();
    expect(toPrestacionRow(conVacia).descripcion).toBeNull();
  });

  it('conserva activa: false al escribir (la baja lógica viaja tal cual, nunca se reescribe a true)', () => {
    const inactiva: Prestacion = { ...kinesiologia, activa: false };

    expect(toPrestacionRow(inactiva).activa).toBe(false);
  });

  it('toPrestacionRows mapea varias prestaciones en orden', () => {
    const fonoaudiologia: Prestacion = { id: 'prest-2', pacienteId: 'pac-1', nombre: 'Fonoaudiología', activa: true };

    const rows = toPrestacionRows([kinesiologia, fonoaudiologia]);

    expect(rows).toHaveLength(2);
    expect(rows[0]?.nombre).toBe('Kinesiología');
    expect(rows[1]?.nombre).toBe('Fonoaudiología');
  });

  it('sin prestaciones, devuelve []', () => {
    expect(toPrestacionRows([])).toEqual([]);
  });
});

describe('toNuevaPrestacionRow', () => {
  it('mapea el payload de alta sin id, con activa tal como venga (siempre true en un alta real)', () => {
    const nueva: NuevaPrestacion = { pacienteId: 'pac-1', nombre: 'Kinesiología', activa: true };

    expect(toNuevaPrestacionRow(nueva)).toEqual({
      paciente_id: 'pac-1',
      nombre: 'Kinesiología',
      descripcion: null,
      activa: true,
    });
    expect('id' in toNuevaPrestacionRow(nueva)).toBe(false);
  });
});
