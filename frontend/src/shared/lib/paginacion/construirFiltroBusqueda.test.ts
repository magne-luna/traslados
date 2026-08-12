import { describe, expect, it } from 'vitest';
import { construirFiltroBusqueda, matcheaFiltroBusqueda } from './construirFiltroBusqueda';

const COLUMNAS_PACIENTE = ['nombre_a', 'nombre_b', 'apellido_a', 'apellido_b', 'dni'] as const;

describe('construirFiltroBusqueda', () => {
  it('término vacío → sin filtro (null)', () => {
    expect(construirFiltroBusqueda('', ['nombre_a', 'apellido_a'])).toBeNull();
  });

  it('término de solo espacios → sin filtro (null), mismo caso que vacío', () => {
    expect(construirFiltroBusqueda('   ', ['nombre_a'])).toBeNull();
  });

  it('término de una palabra sobre N columnas → una sola expresión, disyunción de ilike', () => {
    const filtro = construirFiltroBusqueda('juan', COLUMNAS_PACIENTE);

    expect(filtro).not.toBeNull();
    expect(filtro?.tokens).toEqual(['juan']);
    expect(filtro?.expresionesOr).toEqual([
      'nombre_a.ilike."%juan%",nombre_b.ilike."%juan%",apellido_a.ilike."%juan%",apellido_b.ilike."%juan%",dni.ilike."%juan%"',
    ]);
  });

  it('término de dos palabras → conjunción de dos disyunciones (una expresión por token)', () => {
    const filtro = construirFiltroBusqueda('juan perez', COLUMNAS_PACIENTE);

    expect(filtro?.tokens).toEqual(['juan', 'perez']);
    expect(filtro?.expresionesOr).toHaveLength(2);
    expect(filtro?.expresionesOr[0]).toContain('juan');
    expect(filtro?.expresionesOr[1]).toContain('perez');
  });

  it('espacios múltiples entre palabras y trim de los extremos no generan tokens vacíos', () => {
    const filtro = construirFiltroBusqueda('  juan   perez  ', COLUMNAS_PACIENTE);

    expect(filtro?.tokens).toEqual(['juan', 'perez']);
  });

  it('normaliza a minúsculas: "JUAN" y "juan" producen el mismo token', () => {
    const filtro = construirFiltroBusqueda('JUAN', COLUMNAS_PACIENTE);

    expect(filtro?.tokens).toEqual(['juan']);
  });

  it('escapa "%" y "_" del término (comodines de ILIKE) para que no se interpreten como wildcard', () => {
    const filtro = construirFiltroBusqueda('100%_ok', ['dni']);

    expect(filtro?.expresionesOr).toEqual(['dni.ilike."%100\\%\\_ok%"']);
  });

  it('un término con coma no rompe la expresión: la coma queda dentro de las comillas dobles', () => {
    // El `.or()` de PostgREST usa la coma como separador de condiciones; envolver el valor entre
    // comillas dobles (como ya hace la implementación para cada valor) neutraliza eso.
    const filtro = construirFiltroBusqueda('perez,juan', ['apellido_a']);

    expect(filtro?.tokens).toEqual(['perez,juan']);
    expect(filtro?.expresionesOr).toEqual(['apellido_a.ilike."%perez,juan%"']);
  });
});

describe('matcheaFiltroBusqueda (predicado en memoria — mismo comportamiento que Supabase, §D9)', () => {
  it('filtro null (sin búsqueda) matchea cualquier fila', () => {
    expect(matcheaFiltroBusqueda(['Juan', 'Pérez'], null)).toBe(true);
  });

  it('por apellido', () => {
    const filtro = construirFiltroBusqueda('perez', COLUMNAS_PACIENTE);
    expect(matcheaFiltroBusqueda(['Juan', null, 'Pérez', null, '30111222'], filtro)).toBe(false);
    // "Pérez" con acento no matchea "perez" sin acento (CHECKPOINT 2 — no es una regresión).
  });

  it('por DNI parcial', () => {
    const filtro = construirFiltroBusqueda('3011', COLUMNAS_PACIENTE);
    expect(matcheaFiltroBusqueda(['Juan', null, 'Perez', null, '30111222'], filtro)).toBe(true);
  });

  it('por nombre + apellido en cualquier orden (mismo caso que el checkpoint 1 aprobado)', () => {
    const fila = ['Juan', null, 'Perez', null, '30111222'];

    expect(matcheaFiltroBusqueda(fila, construirFiltroBusqueda('juan perez', COLUMNAS_PACIENTE))).toBe(true);
    expect(matcheaFiltroBusqueda(fila, construirFiltroBusqueda('perez juan', COLUMNAS_PACIENTE))).toBe(true);
  });

  it('sin coincidencias: algún token no matchea ninguna columna → false', () => {
    const fila = ['Juan', null, 'Perez', null, '30111222'];

    expect(matcheaFiltroBusqueda(fila, construirFiltroBusqueda('juan gomez', COLUMNAS_PACIENTE))).toBe(false);
  });

  it('mismo término, mismo resultado en ambos caminos (Supabase vs. mock) — casos representativos', () => {
    const filaMatch = ['Juan', null, 'Perez', null, '30111222'];
    const filaNoMatch = ['Ana', null, 'Gomez', null, '20999888'];

    for (const termino of ['juan', 'perez juan', 'gomez', '']) {
      const filtro = construirFiltroBusqueda(termino, COLUMNAS_PACIENTE);
      // La existencia (o no) del filtro ya es el primer punto de acuerdo entre ambos caminos:
      // término vacío ⇒ sin filtro en los dos, término no vacío ⇒ filtro en los dos.
      expect(filtro === null).toBe(termino.trim() === '');
    }

    expect(matcheaFiltroBusqueda(filaMatch, construirFiltroBusqueda('juan', COLUMNAS_PACIENTE))).toBe(true);
    expect(matcheaFiltroBusqueda(filaNoMatch, construirFiltroBusqueda('juan', COLUMNAS_PACIENTE))).toBe(false);
  });
});
