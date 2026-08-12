import { describe, expect, it } from 'vitest';
import { rangoSupabase } from './rangoSupabase';

describe('rangoSupabase', () => {
  it('página 1, tamaño 20 → { desde: 0, hasta: 19 }', () => {
    expect(rangoSupabase({ pagina: 1, tamanio: 20 })).toEqual({ desde: 0, hasta: 19 });
  });

  it('página 3, tamaño 20 → { desde: 40, hasta: 59 } (triangulación con otra página)', () => {
    expect(rangoSupabase({ pagina: 3, tamanio: 20 })).toEqual({ desde: 40, hasta: 59 });
  });

  it('tamaño 1: cada página es un único índice (desde === hasta)', () => {
    expect(rangoSupabase({ pagina: 1, tamanio: 1 })).toEqual({ desde: 0, hasta: 0 });
    expect(rangoSupabase({ pagina: 5, tamanio: 1 })).toEqual({ desde: 4, hasta: 4 });
  });

  it('página fuera de rango: no lanza, devuelve el rango calculado igual (lo resuelve la base)', () => {
    expect(rangoSupabase({ pagina: 999, tamanio: 20 })).toEqual({ desde: 19960, hasta: 19979 });
  });
});
