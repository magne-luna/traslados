import { describe, expect, it } from 'vitest';
import type { EntidadDocumental } from '../../types/documento';
import type { DocumentoRepository } from './DocumentoRepository';

// Test de contrato (tasks.md 2.2, design.md Checkpoint (b) VEREDICTO opción B): `listByEntity` y
// `upload` aceptan la agrupación como último parámetro OPCIONAL — `remove` y
// `resolverPrevisualizacion` NO cambian (ya apuntan a un `documentoId` puntual, único dentro de la
// entidad sin importar la agrupación). Mismo patrón que `DocumentoRepository.previsualizacion.types.test.ts`:
// lo que falla o pasa acá es la compilación misma vía `npx tsc -b --noEmit` — `vitest run` no
// type-checkea, así que las aserciones en runtime son solo un complemento.
//
// La prueba de que `remove`/`resolverPrevisualizacion` NO cambiaron de firma no puede apoyarse solo
// en un stub literal: TypeScript permite implementar una interfaz con una función de MENOS
// parámetros de los que declara la interfaz (los parámetros de más simplemente no se usan), así que
// un stub de 3 parámetros compilaría igual aunque la interfaz hubiera agregado un 4.º parámetro
// requerido. La única señal que realmente se rompe si la firma cambia es comparar la tupla de
// `Parameters<...>` a nivel de tipo.

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type ListByEntityParams = Parameters<DocumentoRepository['listByEntity']>;
type UploadParams = Parameters<DocumentoRepository['upload']>;
type RemoveParams = Parameters<DocumentoRepository['remove']>;
type ResolverPrevisualizacionParams = Parameters<DocumentoRepository['resolverPrevisualizacion']>;

// listByEntity(entidad, entidadId, agrupacionId?) — agrupacionId opcional agregado al final.
export type _CheckListByEntity = Expect<
  Equal<ListByEntityParams, [entidad: EntidadDocumental, entidadId: string, agrupacionId?: string]>
>;

// upload(entidad, entidadId, itemId, file, vigenciaDesde?, agrupacionId?) — agrupacionId opcional
// agregado DESPUÉS de vigenciaDesde, sin reordenar parámetros existentes.
export type _CheckUpload = Expect<
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

// remove(entidad, entidadId, documentoId) — SIN cambios, verificado explícitamente (tasks.md 2.2).
export type _CheckRemoveNoCambia = Expect<
  Equal<RemoveParams, [entidad: EntidadDocumental, entidadId: string, documentoId: string]>
>;

// resolverPrevisualizacion(entidad, entidadId, documentoId) — SIN cambios, verificado explícitamente
// (tasks.md 2.2).
export type _CheckResolverPrevisualizacionNoCambia = Expect<
  Equal<ResolverPrevisualizacionParams, [entidad: EntidadDocumental, entidadId: string, documentoId: string]>
>;

const stubRepository: DocumentoRepository = {
  async listByEntity(_entidad, _entidadId, _agrupacionId) {
    return [];
  },
  async upload(_entidad, _entidadId, itemId, file, vigenciaDesde, agrupacionId) {
    return {
      id: 'stub-id',
      itemId,
      nombreArchivo: file.name,
      subidoEn: new Date().toISOString(),
      vigenciaDesde,
      agrupacionId,
    };
  },
  async remove() {
    return undefined;
  },
  async resolverPrevisualizacion() {
    return null;
  },
  // documentos-transferencia-actividad (tasks.md 5.1): 5.º método del contrato, agregado acá para
  // que este stub siga siendo asignable a `DocumentoRepository` — no es objeto de este test file.
  async transferirAgrupacion(_entidad, _entidadId, documentoId, agrupacionDestino) {
    return { id: documentoId, itemId: 'item-stub', nombreArchivo: 'stub.pdf', subidoEn: new Date().toISOString(), agrupacionId: agrupacionDestino };
  },
};

describe('DocumentoRepository — agrupacionId opcional en listByEntity/upload (tasks.md 2.2)', () => {
  it('listByEntity acepta un agrupacionId opcional', async () => {
    const documentos = await stubRepository.listByEntity('paciente', 'p1', 'direccion-1');

    expect(documentos).toEqual([]);
  });

  it('listByEntity sigue funcionando sin agrupacionId (triangulación — los otros 3 dominios no lo pasan)', async () => {
    const documentos = await stubRepository.listByEntity('vehiculo', 'v1');

    expect(documentos).toEqual([]);
  });

  it('upload acepta agrupacionId como último parámetro, después de vigenciaDesde', async () => {
    const file = new File(['contenido'], 'rhc.pdf', { type: 'application/pdf' });

    const doc = await stubRepository.upload('paciente', 'p1', 'item-rhc', file, '2026-08-01', 'direccion-1');

    expect(doc.agrupacionId).toBe('direccion-1');
    expect(doc.vigenciaDesde).toBe('2026-08-01');
  });

  it('upload sigue funcionando sin agrupacionId ni vigenciaDesde (triangulación)', async () => {
    const file = new File(['contenido'], 'rhc.pdf', { type: 'application/pdf' });

    const doc = await stubRepository.upload('vehiculo', 'v1', 'item-vtv', file);

    expect(doc.agrupacionId).toBeUndefined();
    expect(doc.vigenciaDesde).toBeUndefined();
  });
});

describe('DocumentoRepository — remove()/resolverPrevisualizacion() NO cambian de firma (tasks.md 2.2)', () => {
  it('remove sigue recibiendo exactamente (entidad, entidadId, documentoId)', async () => {
    await expect(stubRepository.remove('paciente', 'p1', 'doc-1')).resolves.toBeUndefined();
  });

  it('resolverPrevisualizacion sigue recibiendo exactamente (entidad, entidadId, documentoId)', async () => {
    await expect(stubRepository.resolverPrevisualizacion('paciente', 'p1', 'doc-1')).resolves.toBeNull();
  });
});
