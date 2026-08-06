import { describe, expect, it } from 'vitest';
import { mockDocumentoRepository } from './mockDocumentoRepository';

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
