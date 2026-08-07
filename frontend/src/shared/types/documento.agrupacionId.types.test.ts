import { describe, expect, it } from 'vitest';
import type { DocumentoAdjunto } from './documento';

// Test de tipos (tasks.md 2.1, design.md Checkpoint (b) VEREDICTO opción B): `agrupacionId` agrupa
// documentos dentro de una misma entidad — en Pacientes, la actividad/dirección a la que pertenece
// el documento (documentos-checklist-por-actividad). `undefined` = sin agrupación: el caso de
// Vehículos/Conductores/Facturas (que nunca lo pasan) y el de la documentación general del paciente
// (Checkpoint (c)). Mismo patrón que `documento.tipoMime.types.test.ts`: lo que falla o pasa acá es
// la compilación misma vía `npx tsc -b --noEmit` — `vitest run` no type-checkea, así que las
// aserciones en runtime son solo un complemento, no la señal RED/GREEN.

function buildDocumento(agrupacionId?: string): DocumentoAdjunto {
  return {
    id: 'documento-1',
    itemId: 'item-rhc',
    nombreArchivo: 'rhc.pdf',
    subidoEn: '2026-08-06T00:00:00.000Z',
    agrupacionId,
  };
}

describe('DocumentoAdjunto.agrupacionId — campo opcional (Checkpoint (b) VEREDICTO opción B)', () => {
  it('acepta agrupacionId cuando el documento pertenece a una actividad de Pacientes', () => {
    const documento = buildDocumento('direccion-1');

    expect(documento.agrupacionId).toBe('direccion-1');
  });

  it('un documento sin agrupación (Vehículos/Conductores/Facturas o general de Pacientes) compila sin agrupacionId (triangulación)', () => {
    const documento = buildDocumento(undefined);

    expect(documento.agrupacionId).toBeUndefined();
  });
});
