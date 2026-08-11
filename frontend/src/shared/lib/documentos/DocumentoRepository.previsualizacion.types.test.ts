import { describe, expect, it } from 'vitest';
import type { DocumentoRepository } from './DocumentoRepository';

// Test de contrato (tasks.md 1.2, design.md D2): `resolverPrevisualizacion()` se agrega a la
// interfaz `DocumentoRepository`. Mismo patrón que `documento.tipoMime.types.test.ts`: lo que falla
// o pasa acá es la compilación misma vía `npx tsc -b --noEmit` — `vitest run` no type-checkea, así
// que las aserciones en runtime son solo un complemento sobre un stub local (NO el mock real: el
// mock todavía no implementa este método a propósito, ver tasks.md 1.3/2.2 — eso es §2, fuera de
// alcance de este pase).
//
// Contrato (D2): `null` = "no hay nada que previsualizar" (caso normal, ej. documento cargado antes
// de este change); throw = fallo real (permiso, red, expiración).

const stubRepository: DocumentoRepository = {
  async listByEntity() {
    return [];
  },
  async upload(_entidad, _entidadId, itemId, file) {
    return { id: 'stub-id', itemId, nombreArchivo: file.name, subidoEn: new Date().toISOString() };
  },
  async remove() {
    return undefined;
  },
  async resolverPrevisualizacion(_entidad, _entidadId, documentoId) {
    if (documentoId === 'sin-contenido') return null;
    if (documentoId === 'con-error') throw new Error('403 RLS');
    return `blob:stub/${documentoId}`;
  },
  // documentos-transferencia-actividad (tasks.md 5.1): 5.º método del contrato, agregado acá para
  // que este stub siga siendo asignable a `DocumentoRepository` — no es objeto de este test file.
  async transferirAgrupacion(_entidad, _entidadId, documentoId, agrupacionDestino) {
    return { id: documentoId, itemId: 'item-stub', nombreArchivo: 'stub.pdf', subidoEn: new Date().toISOString(), agrupacionId: agrupacionDestino };
  },
};

describe('DocumentoRepository.resolverPrevisualizacion() — contrato (D2)', () => {
  it('resuelve una URL utilizable cuando el documento tiene contenido', async () => {
    const url = await stubRepository.resolverPrevisualizacion('paciente', 'p1', 'doc-con-contenido');

    expect(url).toBe('blob:stub/doc-con-contenido');
  });

  it('resuelve null cuando el documento no tiene contenido previsualizable (triangulación)', async () => {
    const url = await stubRepository.resolverPrevisualizacion('paciente', 'p1', 'sin-contenido');

    expect(url).toBeNull();
  });

  it('propaga como error un fallo real de resolución, distinto de null (triangulación)', async () => {
    await expect(stubRepository.resolverPrevisualizacion('paciente', 'p1', 'con-error')).rejects.toThrow();
  });
});
