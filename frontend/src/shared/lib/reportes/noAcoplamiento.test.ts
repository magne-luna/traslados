import { describe, expect, it } from 'vitest';

// tasks.md 3.10, design.md Decisión 1 y spec `reportes-contract` (Requirement "Capa de
// agregación como funciones puras"): ningún módulo de shared/lib/reportes/ importa React, un
// repositorio, un mock, ni `localStorage`, y ninguno invoca `Date.now()` ni `new Date()` sin
// argumentos — la fecha de referencia siempre entra por parámetro. Mismo patrón (test de
// import sobre el código fuente vía `?raw`, nunca `fs`/`node:path`) que
// noAcoplamientoHojaDeRuta.test.ts de facturacion-ui.

const modulos = import.meta.glob('./**/*.ts', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>;

function esArchivoDeProduccion(archivo: string): boolean {
  return !archivo.includes('.test.');
}

function importLines(contenido: string): string[] {
  return contenido
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.startsWith('import '));
}

describe('shared/lib/reportes/: capa de agregación pura, sin acoplamiento a I/O', () => {
  it('ningún módulo importa React', () => {
    const violaciones: string[] = [];
    for (const [archivo, contenido] of Object.entries(modulos)) {
      if (!esArchivoDeProduccion(archivo)) continue;
      if (importLines(contenido).some((linea) => /from ['"]react['"]/.test(linea))) violaciones.push(archivo);
    }
    expect(violaciones).toEqual([]);
  });

  it('ningún módulo importa un repositorio, un mock, ni localStorage', () => {
    const violaciones: { archivo: string; linea: string }[] = [];
    for (const [archivo, contenido] of Object.entries(modulos)) {
      if (!esArchivoDeProduccion(archivo)) continue;
      for (const linea of importLines(contenido)) {
        if (/Repository/.test(linea) || /\/mocks\//.test(linea)) {
          violaciones.push({ archivo, linea });
        }
      }
      if (/localStorage/.test(contenido)) violaciones.push({ archivo, linea: 'localStorage' });
    }
    expect(violaciones).toEqual([]);
  });

  it('ningún módulo invoca Date.now() ni new Date() sin argumentos', () => {
    const violaciones: { archivo: string; coincidencia: string }[] = [];
    for (const [archivo, contenido] of Object.entries(modulos)) {
      if (!esArchivoDeProduccion(archivo)) continue;
      if (/Date\.now\(\)/.test(contenido)) violaciones.push({ archivo, coincidencia: 'Date.now()' });
      if (/new Date\(\s*\)/.test(contenido)) violaciones.push({ archivo, coincidencia: 'new Date()' });
    }
    expect(violaciones).toEqual([]);
  });
});
