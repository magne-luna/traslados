import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import type { DocumentoAdjunto, EntidadDocumental } from '../../shared/types/documento';
import type { DocumentoRepository } from '../../shared/lib/documentos/DocumentoRepository';
import { armarZipDocumentacionActividad, dispararDescargaZip } from './exportacionZip';

// documentos-transferencia-actividad (tasks.md §12): "Exportar" arma un `.zip` con el CONTENIDO
// REAL de los documentos de una actividad — se prueba que el zip resultante contiene los bytes de
// cada documento, resueltos vía `resolverPrevisualizacion` + `fetch`.

function buildRepositoryMock(
  urlPorDocumentoId: Record<string, string | null>,
): Pick<DocumentoRepository, 'resolverPrevisualizacion'> {
  return {
    resolverPrevisualizacion: vi.fn((_entidad: EntidadDocumental, _entidadId: string, documentoId: string) =>
      Promise.resolve(documentoId in urlPorDocumentoId ? urlPorDocumentoId[documentoId]! : null),
    ),
  };
}

function fetchMockConContenido(contenidoPorUrl: Record<string, string>): typeof fetch {
  return vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const contenido = contenidoPorUrl[url];
    if (contenido === undefined) {
      return Promise.resolve({ ok: false, status: 404 } as Response);
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      blob: () => Promise.resolve(new Blob([contenido], { type: 'application/pdf' })),
    } as Response);
  }) as unknown as typeof fetch;
}

const doc = (over: Partial<DocumentoAdjunto>): DocumentoAdjunto => ({
  id: 'doc-1',
  itemId: 'item-1',
  nombreArchivo: 'archivo.pdf',
  subidoEn: '2026-08-01T00:00:00.000Z',
  ...over,
});

describe('armarZipDocumentacionActividad (tasks.md §12)', () => {
  it('caso feliz: 3 documentos, todos resuelven — el zip contiene las 3 entradas con su contenido', async () => {
    const documentos = [
      doc({ id: 'doc-1', nombreArchivo: 'dni.pdf' }),
      doc({ id: 'doc-2', nombreArchivo: 'cud.pdf' }),
      doc({ id: 'doc-3', nombreArchivo: 'consentimiento.pdf' }),
    ];
    const repository = buildRepositoryMock({
      'doc-1': 'blob://dni',
      'doc-2': 'blob://cud',
      'doc-3': 'blob://consentimiento',
    });
    const fetchImpl = fetchMockConContenido({
      'blob://dni': 'contenido-dni',
      'blob://cud': 'contenido-cud',
      'blob://consentimiento': 'contenido-consentimiento',
    });

    const resultado = await armarZipDocumentacionActividad({
      repository,
      entidad: 'paciente',
      entidadId: 'paciente-1',
      pacienteNombre: 'Pérez, Juan',
      actividadLabel: 'Terapia — Kinesióloga',
      documentos,
      fetchImpl,
      ahora: new Date('2026-08-11T12:00:00.000Z'),
    });

    expect(resultado.pendientes).toHaveLength(0);
    expect(resultado.nombreArchivo).toBe('documentacion-perez-juan-terapia-kinesiologa-2026-08-11.zip');

    const cargado = await JSZip.loadAsync(resultado.blob);
    expect(Object.keys(cargado.files).sort()).toEqual(['consentimiento.pdf', 'cud.pdf', 'dni.pdf']);
    await expect(cargado.file('dni.pdf')?.async('string')).resolves.toBe('contenido-dni');
    await expect(cargado.file('cud.pdf')?.async('string')).resolves.toBe('contenido-cud');
  });

  it('colisión de nombres: dos documentos del mismo itemId con el mismo nombreArchivo no se pisan', async () => {
    const documentos = [
      doc({ id: 'doc-1', itemId: 'item-dni', nombreArchivo: 'dni.pdf' }),
      doc({ id: 'doc-2', itemId: 'item-dni', nombreArchivo: 'dni.pdf' }),
    ];
    const repository = buildRepositoryMock({ 'doc-1': 'blob://v1', 'doc-2': 'blob://v2' });
    const fetchImpl = fetchMockConContenido({ 'blob://v1': 'version-1', 'blob://v2': 'version-2' });

    const resultado = await armarZipDocumentacionActividad({
      repository,
      entidad: 'paciente',
      entidadId: 'paciente-1',
      pacienteNombre: 'Pérez, Juan',
      actividadLabel: 'Terapia — Kinesióloga',
      documentos,
      fetchImpl,
    });

    const cargado = await JSZip.loadAsync(resultado.blob);
    const nombres = Object.keys(cargado.files).sort();
    expect(nombres).toEqual(['dni (2).pdf', 'dni.pdf']);
    // Ningún archivo perdió su contenido propio pisando al otro.
    await expect(cargado.file('dni.pdf')?.async('string')).resolves.toBe('version-1');
    await expect(cargado.file('dni (2).pdf')?.async('string')).resolves.toBe('version-2');
  });

  it('documento no previsualizable (resolverPrevisualizacion devuelve null): se omite del zip y queda en _pendientes.txt', async () => {
    const documentos = [
      doc({ id: 'doc-1', nombreArchivo: 'dni.pdf' }),
      doc({ id: 'doc-2', nombreArchivo: 'viejo-sin-contenido.pdf' }),
    ];
    const repository = buildRepositoryMock({ 'doc-1': 'blob://dni', 'doc-2': null });
    const fetchImpl = fetchMockConContenido({ 'blob://dni': 'contenido-dni' });

    const resultado = await armarZipDocumentacionActividad({
      repository,
      entidad: 'paciente',
      entidadId: 'paciente-1',
      pacienteNombre: 'Pérez, Juan',
      actividadLabel: 'Terapia — Kinesióloga',
      documentos,
      fetchImpl,
    });

    // El zip se genera igual, con el resto de los documentos — no todo-o-nada.
    expect(resultado.pendientes).toEqual(['viejo-sin-contenido.pdf: no está disponible para incluir en el zip.']);
    const cargado = await JSZip.loadAsync(resultado.blob);
    expect(Object.keys(cargado.files).sort()).toEqual(['_pendientes.txt', 'dni.pdf']);
    await expect(cargado.file('_pendientes.txt')?.async('string')).resolves.toContain('viejo-sin-contenido.pdf');
  });

  it('fetch que rechaza: mismo tratamiento que un documento no previsualizable — se omite y queda en _pendientes.txt', async () => {
    const documentos = [
      doc({ id: 'doc-1', nombreArchivo: 'dni.pdf' }),
      doc({ id: 'doc-2', nombreArchivo: 'roto.pdf' }),
    ];
    const repository = buildRepositoryMock({ 'doc-1': 'blob://dni', 'doc-2': 'blob://roto' });
    const fetchImpl = vi.fn((input: RequestInfo | URL) => {
      if (String(input) === 'blob://roto') return Promise.reject(new Error('network error'));
      return Promise.resolve({
        ok: true,
        status: 200,
        blob: () => Promise.resolve(new Blob(['contenido-dni'], { type: 'application/pdf' })),
      } as Response);
    }) as unknown as typeof fetch;

    const resultado = await armarZipDocumentacionActividad({
      repository,
      entidad: 'paciente',
      entidadId: 'paciente-1',
      pacienteNombre: 'Pérez, Juan',
      actividadLabel: 'Terapia — Kinesióloga',
      documentos,
      fetchImpl,
    });

    expect(resultado.pendientes).toEqual(['roto.pdf: no se pudo descargar el archivo.']);
    const cargado = await JSZip.loadAsync(resultado.blob);
    expect(Object.keys(cargado.files).sort()).toEqual(['_pendientes.txt', 'dni.pdf']);
  });

  it('respuesta HTTP no OK (ej. 403/404 de una URL firmada vencida) recibe el mismo tratamiento parcial', async () => {
    const documentos = [doc({ id: 'doc-1', nombreArchivo: 'vencido.pdf' })];
    const repository = buildRepositoryMock({ 'doc-1': 'blob://vencido' });
    const fetchImpl = vi.fn(() => Promise.resolve({ ok: false, status: 403 } as Response)) as unknown as typeof fetch;

    const resultado = await armarZipDocumentacionActividad({
      repository,
      entidad: 'paciente',
      entidadId: 'paciente-1',
      pacienteNombre: 'Pérez, Juan',
      actividadLabel: 'Terapia — Kinesióloga',
      documentos,
      fetchImpl,
    });

    expect(resultado.pendientes).toEqual(['vencido.pdf: no se pudo descargar el archivo.']);
  });

  it('sin ningún documento pendiente, el zip NO incluye _pendientes.txt', async () => {
    const documentos = [doc({ id: 'doc-1', nombreArchivo: 'dni.pdf' })];
    const repository = buildRepositoryMock({ 'doc-1': 'blob://dni' });
    const fetchImpl = fetchMockConContenido({ 'blob://dni': 'contenido-dni' });

    const resultado = await armarZipDocumentacionActividad({
      repository,
      entidad: 'paciente',
      entidadId: 'paciente-1',
      pacienteNombre: 'Pérez, Juan',
      actividadLabel: 'Terapia — Kinesióloga',
      documentos,
      fetchImpl,
    });

    const cargado = await JSZip.loadAsync(resultado.blob);
    expect(Object.keys(cargado.files)).not.toContain('_pendientes.txt');
  });

  it('el nombre del zip sanitiza acentos y espacios del paciente/actividad', async () => {
    const resultado = await armarZipDocumentacionActividad({
      repository: buildRepositoryMock({}),
      entidad: 'paciente',
      entidadId: 'paciente-1',
      pacienteNombre: 'Núñez, María José',
      actividadLabel: 'Terapia — Fonoaudióloga (CABA)',
      documentos: [],
      fetchImpl: fetchMockConContenido({}),
      ahora: new Date('2026-08-11T12:00:00.000Z'),
    });

    expect(resultado.nombreArchivo).toBe('documentacion-nunez-maria-jose-terapia-fonoaudiologa-caba-2026-08-11.zip');
  });
});

describe('dispararDescargaZip (tasks.md §12)', () => {
  it('crea un enlace de descarga con el nombre de archivo dado y dispara el click', () => {
    const blob = new Blob(['contenido'], { type: 'application/zip' });
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob://fake-url');
    const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    dispararDescargaZip(blob, 'documentacion-test.zip');

    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob://fake-url');

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    clickSpy.mockRestore();
  });
});
