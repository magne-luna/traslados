import { describe, expect, it } from 'vitest';
import type { EntidadDocumental } from '../../types/documento';
import type { DocumentoRepository } from './DocumentoRepository';

// Test de contrato (tasks.md 5.1/5.2, design.md D4, `documento-contract` spec): el 5.º método
// `transferirAgrupacion` — reasigna la agrupación de un documento ya cargado sin volver a subirlo
// ni tocar Storage. Mismo patrón que `DocumentoRepository.agrupacion.types.test.ts` /
// `DocumentoRepository.previsualizacion.types.test.ts`: lo que realmente falla o pasa acá es la
// compilación vía `npx tsc -b --noEmit` — `vitest run` no type-checkea, las aserciones en runtime
// son solo un complemento.

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type TransferirAgrupacionParams = Parameters<DocumentoRepository['transferirAgrupacion']>;
type TransferirAgrupacionReturn = ReturnType<DocumentoRepository['transferirAgrupacion']>;

// transferirAgrupacion(entidad, entidadId, documentoId, agrupacionDestino: string | undefined) —
// design.md D4: `agrupacionDestino` NO es opcional (`?`) — es un parámetro REQUERIDO cuyo tipo
// incluye `undefined` explícito. Distinción deliberada: un parámetro opcional deja "olvidarse de
// pasarlo" indistinguible de "pedir el traslado a General"; acá el caller SIEMPRE debe decidir.
export type _CheckTransferirAgrupacion = Expect<
  Equal<
    TransferirAgrupacionParams,
    [entidad: EntidadDocumental, entidadId: string, documentoId: string, agrupacionDestino: string | undefined]
  >
>;

// Devuelve el DocumentoAdjunto actualizado (no `void`, a diferencia de `remove`) — la UI necesita
// reflejar el documento en su bloque nuevo sin un listByEntity extra.
export type _CheckTransferirAgrupacionDevuelveDocumento = Expect<
  TransferirAgrupacionReturn extends Promise<{ id: string; agrupacionId?: string }> ? true : false
>;

// Las cuatro firmas existentes NO cambian (tasks.md 5.2): ni orden de parámetros, ni opcionalidad,
// ni semántica — verificado explícitamente, no solo "sigue compilando".
type ListByEntityParams = Parameters<DocumentoRepository['listByEntity']>;
type UploadParams = Parameters<DocumentoRepository['upload']>;
type RemoveParams = Parameters<DocumentoRepository['remove']>;
type ResolverPrevisualizacionParams = Parameters<DocumentoRepository['resolverPrevisualizacion']>;

export type _CheckListByEntityNoCambia = Expect<
  Equal<ListByEntityParams, [entidad: EntidadDocumental, entidadId: string, agrupacionId?: string]>
>;
export type _CheckUploadNoCambia = Expect<
  Equal<
    UploadParams,
    [
      entidad: EntidadDocumental,
      entidadId: string,
      itemId: string,
      file: File,
      vigenciaDesde?: string,
      agrupacionId?: string,
    ]
  >
>;
export type _CheckRemoveNoCambia = Expect<
  Equal<RemoveParams, [entidad: EntidadDocumental, entidadId: string, documentoId: string]>
>;
export type _CheckResolverPrevisualizacionNoCambia = Expect<
  Equal<ResolverPrevisualizacionParams, [entidad: EntidadDocumental, entidadId: string, documentoId: string]>
>;

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
  async resolverPrevisualizacion() {
    return null;
  },
  async transferirAgrupacion(_entidad, _entidadId, documentoId, agrupacionDestino) {
    return {
      id: documentoId,
      itemId: 'item-stub',
      nombreArchivo: 'stub.pdf',
      subidoEn: new Date().toISOString(),
      agrupacionId: agrupacionDestino,
    };
  },
};

describe('DocumentoRepository — transferirAgrupacion (tasks.md 5.1)', () => {
  it('acepta agrupacionDestino como string (destino = otra actividad)', async () => {
    const doc = await stubRepository.transferirAgrupacion('paciente', 'p1', 'doc-1', 'dir-2');

    expect(doc.id).toBe('doc-1');
    expect(doc.agrupacionId).toBe('dir-2');
  });

  it('acepta agrupacionDestino undefined EXPLÍCITO (destino = General) — triangulación', async () => {
    const doc = await stubRepository.transferirAgrupacion('paciente', 'p1', 'doc-1', undefined);

    expect(doc.agrupacionId).toBeUndefined();
  });
});
