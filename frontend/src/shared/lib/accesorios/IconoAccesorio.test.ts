import { describe, expect, it } from 'vitest';
import {
  humanizarTipoAccesorio,
  iconoAccesorioMap,
  iconoAccesorioPara,
  labelAccesorio,
} from './IconoAccesorio';

// 2.5 — display del catálogo (design.md D4): labels exactos de los 5 del seed, humanización de
// tipos libres, y resolución de `icono` string → SVG con fallback ante clave desconocida.

describe('labelAccesorio (2.5)', () => {
  it('devuelve los labels exactos de los 5 valores del seed', () => {
    expect(labelAccesorio('silla-plegable')).toBe('Silla plegable');
    expect(labelAccesorio('silla-rigida')).toBe('Silla rígida');
    expect(labelAccesorio('silla-postural')).toBe('Silla postural');
    expect(labelAccesorio('andador')).toBe('Andador');
    expect(labelAccesorio('tripode')).toBe('Trípode');
  });

  it('humaniza un tipo libre nuevo (guiones → espacios, capitalizada)', () => {
    expect(labelAccesorio('silla-electrica')).toBe('Silla electrica');
  });

  it('humaniza sin romper por espacios repetidos ni vacíos', () => {
    expect(labelAccesorio('  silla   plegable ')).toBe('Silla plegable');
    expect(labelAccesorio('-')).toBe('-');
  });
});

describe('humanizarTipoAccesorio (2.5)', () => {
  it('convierte guiones a espacios y capitaliza', () => {
    expect(humanizarTipoAccesorio('silla-electrica')).toBe('Silla electrica');
    expect(humanizarTipoAccesorio('andador')).toBe('Andador');
  });
});

describe('iconoAccesorioPara (2.5)', () => {
  it('resuelve las 5 claves del seed a sus SVGs del DS', () => {
    expect(iconoAccesorioPara('silla-plegable')).toBe(iconoAccesorioMap['silla-plegable']);
    expect(iconoAccesorioPara('andador')).toBe(iconoAccesorioMap['andador']);
  });

  it('clave desconocida cae al fallback genérico sin romper', () => {
    expect(iconoAccesorioPara('silla-inventada')).not.toBe(iconoAccesorioMap['silla-plegable']);
    expect(iconoAccesorioPara('silla-inventada')).toBeDefined();
  });

  it('undefined/null también caen al fallback', () => {
    const fallback = iconoAccesorioPara('clave-que-no-existe');
    expect(iconoAccesorioPara(undefined)).toBe(fallback);
    expect(iconoAccesorioPara(null)).toBe(fallback);
  });
});