import { describe, expect, it } from 'vitest';
import { seleccionables } from './seleccionables';

describe('seleccionables (baja lógica)', () => {
  const activo = { id: 'a', activo: true };
  const inactivo = { id: 'b', activo: false };
  const sinDato = { id: 'c' };

  it('deja afuera a los inactivos; sin dato cuenta como activo', () => {
    expect(seleccionables([activo, inactivo, sinDato], '')).toEqual([activo, sinDato]);
  });

  it('conserva al inactivo que ya está elegido, para no vaciar el campo al editar algo viejo', () => {
    expect(seleccionables([activo, inactivo], 'b')).toEqual([activo, inactivo]);
  });

  it('tolera un valor actual null', () => {
    expect(seleccionables([inactivo], null)).toEqual([]);
  });
});
