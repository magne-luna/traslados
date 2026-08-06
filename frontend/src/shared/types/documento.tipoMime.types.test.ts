import { describe, expect, it } from 'vitest';
import type { DocumentoAdjunto } from './documento';

// Test de tipos (tasks.md 1.1, design.md D1, Checkpoint (a) VEREDICTO Opción A): `tipoMime` decide
// si un documento es previsualizable y con qué elemento (imagen / PDF / no previsualizable). Es
// opcional a propósito — los documentos cargados antes de este change no lo tienen. Mismo patrón que
// `vehiculo.notas.types.test.ts` y `conductor.restricciones.types.test.ts`: lo que falla o pasa acá
// es la compilación misma vía `npx tsc -b --noEmit` — `vitest run` no type-checkea, así que las
// aserciones en runtime son solo un complemento, no la señal RED/GREEN.

function buildDocumento(tipoMime?: string): DocumentoAdjunto {
  return {
    id: 'documento-1',
    itemId: 'item-rhc',
    nombreArchivo: 'rhc.pdf',
    subidoEn: '2026-08-06T00:00:00.000Z',
    tipoMime,
  };
}

describe('DocumentoAdjunto.tipoMime — campo opcional (D1, Checkpoint (a))', () => {
  it('acepta tipoMime cuando el documento fue cargado con este change', () => {
    const documento = buildDocumento('image/jpeg');

    expect(documento.tipoMime).toBe('image/jpeg');
  });

  it('un documento cargado antes de este change compila sin tipoMime (triangulación)', () => {
    const documento = buildDocumento(undefined);

    expect(documento.tipoMime).toBeUndefined();
  });
});
