import { describe, expect, it } from 'vitest';
import { move, moveDown, moveUp } from './reorder';

describe('move', () => {
  it('mueve un ítem de una posición a otra, preservando el resto del orden', () => {
    const items = ['a', 'b', 'c', 'd'];

    expect(move(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('mueve un ítem hacia atrás en la lista (triangulación con dirección inversa)', () => {
    const items = ['a', 'b', 'c', 'd'];

    expect(move(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('no muta el array original', () => {
    const items = ['a', 'b', 'c'];

    move(items, 0, 2);

    expect(items).toEqual(['a', 'b', 'c']);
  });

  it('devuelve una copia sin cambios si el índice de origen o destino está fuera de rango', () => {
    const items = ['a', 'b', 'c'];

    expect(move(items, -1, 1)).toEqual(['a', 'b', 'c']);
    expect(move(items, 0, 5)).toEqual(['a', 'b', 'c']);
  });
});

describe('moveUp', () => {
  it('intercambia el ítem con su predecesor', () => {
    expect(moveUp(['a', 'b', 'c'], 1)).toEqual(['b', 'a', 'c']);
  });

  it('no cambia el orden si el ítem ya está primero (borde)', () => {
    expect(moveUp(['a', 'b', 'c'], 0)).toEqual(['a', 'b', 'c']);
  });
});

describe('moveDown', () => {
  it('intercambia el ítem con su sucesor', () => {
    expect(moveDown(['a', 'b', 'c'], 0)).toEqual(['b', 'a', 'c']);
  });

  it('no cambia el orden si el ítem ya está último (borde)', () => {
    expect(moveDown(['a', 'b', 'c'], 2)).toEqual(['a', 'b', 'c']);
  });
});
