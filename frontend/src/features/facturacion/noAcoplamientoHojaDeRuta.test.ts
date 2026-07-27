import { describe, expect, it } from 'vitest';
// `?raw` es una convención de Vite (importa el archivo como texto plano) — vite/client ya tipa
// el resultado como `string`.
import facturaTypesRaw from '../../shared/types/factura.ts?raw';

// Garantía estructural de RN-FA-01 (design.md Decisión 2, tasks.md 13.3): las prestaciones
// declaradas se facturan íntegramente; el recorrido efectivo es independiente y NO se deriva ni
// se valida a partir de él. La forma más barata y verificable de cumplir "no se deriva" es no
// tener la referencia: este test escanea el CÓDIGO FUENTE (vía `import.meta.glob` con `?raw`,
// nunca `fs`/`node:path` — se evita depender de tipos de Node en un proyecto de solo browser) de
// `shared/types/factura.ts` y de toda la feature `facturacion` en busca de un `import` real de
// `hojaDeRuta.ts` o de `HojaDeRutaRepository` — se vuelve un test de import, no una convención
// que alguien pueda romper sin darse cuenta.

const modulosFeature = import.meta.glob('./**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

function importLines(contenido: string): string[] {
  return contenido
    .split('\n')
    .map((linea) => linea.trim())
    .filter((linea) => linea.startsWith('import '));
}

describe('RN-FA-01: cero acoplamiento estructural con Hojas de Ruta', () => {
  it('factura.ts no importa nada de hojaDeRuta.ts', () => {
    const imports = importLines(facturaTypesRaw);
    const importsProhibidos = imports.filter((linea) => /hojaDeRuta/i.test(linea));
    expect(importsProhibidos).toEqual([]);
  });

  it('ningún archivo de la feature facturacion importa de hojaDeRuta.ts ni de HojaDeRutaRepository', () => {
    const violaciones: { archivo: string; linea: string }[] = [];

    for (const [archivo, contenido] of Object.entries(modulosFeature)) {
      if (archivo.includes('.test.')) continue;
      for (const linea of importLines(contenido)) {
        if (/hojaDeRuta/i.test(linea) || /HojaDeRutaRepository/.test(linea)) {
          violaciones.push({ archivo, linea });
        }
      }
    }

    expect(violaciones).toEqual([]);
  });

  it('la feature facturacion no monta HojaDeRutaRepositoryContext (RN-FA-01, design.md Decisión 2)', () => {
    const menciones = Object.entries(modulosFeature)
      .filter(([archivo]) => !archivo.includes('.test.'))
      .filter(([, contenido]) => /HojaDeRutaRepositoryContext/.test(contenido));
    expect(menciones).toEqual([]);
  });
});
