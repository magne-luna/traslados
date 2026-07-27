import { describe, expect, it } from 'vitest';

// tasks.md 7.4, CLAUDE.md §Reglas Duras: barrido de features/dashboard/ y shared/lib/reportes/
// verificando que no hay `any`, ni `style={{}}` inline, ni `!important`, ni índices de array
// como key de lista, ni barrel exports. Mismo patrón (import ?raw sobre el código fuente) que
// noAcoplamiento.test.ts.

const modulosDashboard = import.meta.glob('./**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }) as Record<
  string,
  string
>;
const modulosReportes = import.meta.glob('../../shared/lib/reportes/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>;

const modulos = { ...modulosDashboard, ...modulosReportes };

function esArchivoDeProduccion(archivo: string): boolean {
  return !archivo.includes('.test.');
}

function archivosDeProduccion(): [string, string][] {
  return Object.entries(modulos).filter(([archivo]) => esArchivoDeProduccion(archivo));
}

/** Descarta líneas de comentario (// ... o dentro de /* ... *\/) para no confundir código con
 * prosa que documenta la regla (p. ej. un comentario que dice "sin `style={{}}`"). */
function sinComentarios(contenido: string): string {
  return contenido
    .split('\n')
    .filter((linea) => {
      const t = linea.trim();
      return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
    })
    .join('\n');
}

describe('features/dashboard/ y shared/lib/reportes/: reglas duras del proyecto', () => {
  it('ningún archivo usa `any`', () => {
    const violaciones: string[] = [];
    for (const [archivo, contenido] of archivosDeProduccion()) {
      if (/\bany\b/.test(sinComentarios(contenido))) violaciones.push(archivo);
    }
    expect(violaciones).toEqual([]);
  });

  it('ningún componente usa style={{}} inline', () => {
    const violaciones: string[] = [];
    for (const [archivo, contenido] of archivosDeProduccion()) {
      if (/style=\{\{/.test(sinComentarios(contenido))) violaciones.push(archivo);
    }
    expect(violaciones).toEqual([]);
  });

  it('ningún archivo usa !important', () => {
    const violaciones: string[] = [];
    for (const [archivo, contenido] of archivosDeProduccion()) {
      if (/!important/.test(sinComentarios(contenido))) violaciones.push(archivo);
    }
    expect(violaciones).toEqual([]);
  });

  it('ninguna lista usa el índice de array como key', () => {
    const violaciones: string[] = [];
    const patronIndiceKey = /key=\{\s*(i|index|idx)\s*\}/;
    for (const [archivo, contenido] of archivosDeProduccion()) {
      if (patronIndiceKey.test(contenido)) violaciones.push(archivo);
    }
    expect(violaciones).toEqual([]);
  });

  it('no hay barrel exports (ningún index.ts/index.tsx en estas carpetas)', () => {
    const violaciones = Object.keys(modulos).filter((archivo) => /\/index\.tsx?$/.test(archivo));
    expect(violaciones).toEqual([]);
  });

  it('ningún control suprime el indicador de foco nativo (outline-none / ring-0)', () => {
    // Complemento de tasks.md 7.1 (navegación por teclado con foco visible): en jsdom no se
    // puede medir el outline real, pero si ningún componente usa estas clases, el foco por
    // defecto del navegador queda visible.
    const violaciones: string[] = [];
    for (const [archivo, contenido] of archivosDeProduccion()) {
      if (/\boutline-none\b/.test(contenido) || /\bring-0\b/.test(contenido)) violaciones.push(archivo);
    }
    expect(violaciones).toEqual([]);
  });
});
