import { describe, expect, it, vi } from 'vitest';
import type { DocumentoAdjunto } from '../../types/documento';
import { generateId } from '../id';
import { mockDocumentoRepository, seedDocumentoSinContenidoParaTest } from './mockDocumentoRepository';

// pacientes-documentos-multiples: el checklist documental deja de ser 1:1 por itemId y pasa a
// admitir una colección real (sin tope) que se acumula en vez de reemplazarse — feedback directo
// de la clienta (Andrea Pastor), ver proposal.md.

function archivo(nombre: string): File {
  return new File(['contenido'], nombre, { type: 'application/pdf' });
}

// El mock persiste en un Map en memoria de sesión (design.md D3), sin reset entre tests — cada
// test usa un entidadId único para no pisar el store de otro test que corra en paralelo/orden
// distinto.
let contador = 0;
function entidadIdUnico(prefix: string): string {
  contador += 1;
  return `${prefix}-${Date.now()}-${contador}`;
}

describe('mockDocumentoRepository — acumulación por itemId (tasks.md 2.1/2.2)', () => {
  it('subir un segundo documento al mismo itemId no borra el primero — ambos coexisten en listByEntity()', async () => {
    const entidadId = entidadIdUnico('paciente-acumulacion');

    await mockDocumentoRepository.upload('paciente', entidadId, 'item-presupuesto', archivo('presupuesto-2025.pdf'));
    await mockDocumentoRepository.upload('paciente', entidadId, 'item-presupuesto', archivo('presupuesto-2026.pdf'));

    const documentos = await mockDocumentoRepository.listByEntity('paciente', entidadId);

    expect(documentos).toHaveLength(2);
    expect(documentos.map((d) => d.nombreArchivo)).toEqual(
      expect.arrayContaining(['presupuesto-2025.pdf', 'presupuesto-2026.pdf']),
    );
  });

  it('cada documento subido recibe un id propio y distinto (triangulación)', async () => {
    const entidadId = entidadIdUnico('paciente-ids');

    const uno = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc-1.pdf'));
    const dos = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc-2.pdf'));

    expect(uno.id).toEqual(expect.any(String));
    expect(dos.id).toEqual(expect.any(String));
    expect(uno.id).not.toBe(dos.id);
  });

  it('no impone ningún tope de cantidad por itemId (Checkpoint (a): sin límite, VEREDICTO Enzo)', async () => {
    const entidadId = entidadIdUnico('paciente-sin-limite');

    for (let i = 0; i < 5; i += 1) {
      await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo(`rhc-${i}.pdf`));
    }

    const documentos = await mockDocumentoRepository.listByEntity('paciente', entidadId);
    expect(documentos).toHaveLength(5);
  });
});

describe('mockDocumentoRepository — remove() por documentoId (tasks.md 2.3, design.md D1)', () => {
  it('quitar un documento puntual dentro de una colección de N no afecta a los demás del mismo itemId', async () => {
    const entidadId = entidadIdUnico('paciente-remove');

    const uno = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc-viejo.pdf'));
    const dos = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc-nuevo.pdf'));

    await mockDocumentoRepository.remove('paciente', entidadId, uno.id);

    const documentos = await mockDocumentoRepository.listByEntity('paciente', entidadId);
    expect(documentos).toHaveLength(1);
    expect(documentos[0]?.id).toBe(dos.id);
  });

  it('quitar por documentoId no afecta documentos de otros itemId de la misma entidad (triangulación)', async () => {
    const entidadId = entidadIdUnico('paciente-remove-cruzado');

    const rhc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc.pdf'));
    const presupuesto = await mockDocumentoRepository.upload(
      'paciente',
      entidadId,
      'item-presupuesto',
      archivo('presupuesto.pdf'),
    );

    await mockDocumentoRepository.remove('paciente', entidadId, rhc.id);

    const documentos = await mockDocumentoRepository.listByEntity('paciente', entidadId);
    expect(documentos).toEqual([presupuesto]);
  });
});

describe('mockDocumentoRepository — vigenciaDesde opcional (tasks.md 2.4, design.md Checkpoint (b))', () => {
  it('upload() acepta y persiste vigenciaDesde cuando se lo indica', async () => {
    const entidadId = entidadIdUnico('paciente-vigencia');

    const doc = await mockDocumentoRepository.upload(
      'paciente',
      entidadId,
      'item-presupuesto',
      archivo('presupuesto-2026.pdf'),
      '2026-08-01',
    );

    expect(doc.vigenciaDesde).toBe('2026-08-01');
    const [persistido] = await mockDocumentoRepository.listByEntity('paciente', entidadId);
    expect(persistido?.vigenciaDesde).toBe('2026-08-01');
  });

  it('omitir vigenciaDesde no rompe nada — sigue siendo undefined (degradación a orden de carga)', async () => {
    const entidadId = entidadIdUnico('paciente-sin-vigencia');

    const doc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-presupuesto', archivo('presupuesto.pdf'));

    expect(doc.vigenciaDesde).toBeUndefined();
  });
});

// documentos-previsualizacion (tasks.md §2, design.md Checkpoint (a) Opción A / D1 / D2): el mock
// deja de descartar el `File` y expone su contenido bajo demanda vía resolverPrevisualizacion().
// La URL NUNCA viaja en el modelo público DocumentoAdjunto (D1) — vive en un store interno aparte.

describe('mockDocumentoRepository — upload() conserva el contenido (tasks.md 2.1, Checkpoint (a) Opción A)', () => {
  it('upload() puebla tipoMime desde file.type', async () => {
    const entidadId = entidadIdUnico('paciente-tipomime');

    const doc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc.pdf'));

    expect(doc.tipoMime).toBe('application/pdf');
  });

  it('upload() no agrega ninguna URL a la forma pública de DocumentoAdjunto (D1: la URL no viaja en el modelo)', async () => {
    const entidadId = entidadIdUnico('paciente-sin-url-en-modelo');

    const doc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc.pdf'));

    expect(Object.keys(doc).sort()).toEqual(
      ['id', 'itemId', 'nombreArchivo', 'subidoEn', 'tipoMime', 'vigenciaDesde'].sort(),
    );
  });

  it('upload() efectivamente conserva el File recibido — NO crea el ObjectURL todavía (eso pasa recién en resolverPrevisualizacion(), bajo demanda)', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL');
    const entidadId = entidadIdUnico('paciente-content-guardado');
    const file = archivo('rhc.pdf');

    await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', file);

    expect(createSpy).not.toHaveBeenCalled();
    createSpy.mockRestore();
  });
});

describe('mockDocumentoRepository — resolverPrevisualizacion() (tasks.md 2.2, design.md D2)', () => {
  it('resuelve el ObjectURL del documento subido cuando tiene contenido', async () => {
    const entidadId = entidadIdUnico('paciente-preview-con-contenido');
    const doc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc.pdf'));

    const url = await mockDocumentoRepository.resolverPrevisualizacion('paciente', entidadId, doc.id);

    expect(url).toEqual(expect.any(String));
  });

  it('resuelve null para un documento que ya existía antes de este change, sin contenido asociado (degradación esperada)', async () => {
    const entidadId = entidadIdUnico('paciente-preview-sin-contenido');
    const documentoViejo: DocumentoAdjunto = {
      id: generateId('documento'),
      itemId: 'item-rhc',
      nombreArchivo: 'rhc-viejo.pdf',
      subidoEn: new Date().toISOString(),
    };
    seedDocumentoSinContenidoParaTest('paciente', entidadId, documentoViejo);

    const url = await mockDocumentoRepository.resolverPrevisualizacion('paciente', entidadId, documentoViejo.id);

    expect(url).toBeNull();
  });

  it('resuelve null cuando el id no existe (triangulación)', async () => {
    const entidadId = entidadIdUnico('paciente-preview-inexistente');

    const url = await mockDocumentoRepository.resolverPrevisualizacion('paciente', entidadId, 'id-que-no-existe');

    expect(url).toBeNull();
  });

  // documentos-previsualizacion (fix "cerrar y volver a abrir tira ERR_FILE_NOT_FOUND",
  // 2026-08-06): DocumentChecklist revoca la URL al cerrar la ventana (D2, "efímera") — si el mock
  // devolviera siempre la MISMA url cacheada desde upload(), la segunda apertura reusaría una
  // blob: ya revocada y rota. Cada llamada a resolverPrevisualizacion() tiene que crear una URL
  // nueva (createObjectURL nuevo cada vez), exactamente como se comportaría una URL firmada real
  // con expiración corta — nunca la misma referencia dos veces.
  it('llamado dos veces para el mismo documento, devuelve dos ObjectURL DISTINTOS (createObjectURL nuevo en cada llamada)', async () => {
    const createSpy = vi.spyOn(URL, 'createObjectURL');
    const entidadId = entidadIdUnico('paciente-preview-dos-veces');
    const doc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc.pdf'));

    const primera = await mockDocumentoRepository.resolverPrevisualizacion('paciente', entidadId, doc.id);
    const segunda = await mockDocumentoRepository.resolverPrevisualizacion('paciente', entidadId, doc.id);

    expect(createSpy).toHaveBeenCalledTimes(2);
    expect(primera).not.toBe(segunda);
    createSpy.mockRestore();
  });

  it('revocar la URL de la primera apertura no rompe una segunda apertura posterior (regresión del bug real)', async () => {
    const entidadId = entidadIdUnico('paciente-preview-revoke-y-reabrir');
    const doc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc.pdf'));

    const primera = await mockDocumentoRepository.resolverPrevisualizacion('paciente', entidadId, doc.id);
    // Simula lo que hace DocumentChecklist.cerrarPreview(): revoca la URL que se mostró.
    URL.revokeObjectURL(primera as string);

    const segunda = await mockDocumentoRepository.resolverPrevisualizacion('paciente', entidadId, doc.id);

    expect(segunda).toEqual(expect.any(String));
    expect(segunda).not.toBe(primera);
  });
});

describe('mockDocumentoRepository — remove() (tasks.md 2.3)', () => {
  it('remove() ya no revoca nada por su cuenta — el mock no cachea una url permanente que revocar (esa responsabilidad es 100% del consumidor, ver useDocumentChecklist.ts)', async () => {
    const entidadId = entidadIdUnico('paciente-revoke');
    const doc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc.pdf'));
    const revokeSpy = vi.spyOn(URL, 'revokeObjectURL');

    await mockDocumentoRepository.remove('paciente', entidadId, doc.id);

    expect(revokeSpy).not.toHaveBeenCalled();
    revokeSpy.mockRestore();
  });

  it('tras remove(), resolverPrevisualizacion() ya no resuelve contenido para ese id (triangulación)', async () => {
    const entidadId = entidadIdUnico('paciente-revoke-resuelve-null');
    const doc = await mockDocumentoRepository.upload('paciente', entidadId, 'item-rhc', archivo('rhc.pdf'));

    await mockDocumentoRepository.remove('paciente', entidadId, doc.id);

    const url = await mockDocumentoRepository.resolverPrevisualizacion('paciente', entidadId, doc.id);
    expect(url).toBeNull();
  });
});
