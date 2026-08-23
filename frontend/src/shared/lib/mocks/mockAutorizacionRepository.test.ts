import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NuevaAutorizacion } from '../../types/presupuesto';
import { mockAutorizacionRepository } from './mockAutorizacionRepository';

const STORAGE_KEY = 'autorizaciones';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevaAutorizacion(overrides: Partial<NuevaAutorizacion> = {}): NuevaAutorizacion {
  return {
    presupuestoId: 'presupuesto-martina-1',
    estado: 'pendiente',
    ...overrides,
  };
}

describe('mockAutorizacionRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra el fixture con autorizaciones cubriendo los 4 estados relevantes cuando no hay datos previos', async () => {
    const autorizaciones = await flushLatency(mockAutorizacionRepository.list());

    // 7 filas (autorizacion-mensual tasks.md 4.4): las 4 legacy de siempre + 3 meses del mismo
    // presupuesto (`presupuesto-camila-1`) — algunos estados se repiten entre filas, así que se
    // verifica el conjunto de estados presentes, no una igualdad 1 a 1 con el array.
    expect(autorizaciones).toHaveLength(7);
    const estados = new Set(autorizaciones.map((a) => a.estado));
    expect([...estados].sort()).toEqual(['autorizada', 'judicializada', 'pendiente', 'rechazada']);
  });

  it('list() resuelve una promesa con latencia simulada (loading states reales)', async () => {
    let resolved = false;
    mockAutorizacionRepository.list().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('create() persiste una nueva autorización recuperable por list()', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    const creada = await flushLatency(
      mockAutorizacionRepository.create(buildNuevaAutorizacion({ presupuestoId: 'presupuesto-facundo-2' })),
    );

    expect(creada.id).toBeTruthy();

    const autorizaciones = await flushLatency(mockAutorizacionRepository.list());
    expect(autorizaciones.map((a) => a.id)).toContain(creada.id);
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockAutorizacionRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  // -----------------------------------------------------------------------------------------
  // listByPresupuestoId (autorizacion-mensual tasks.md 4.1/4.4/4.5, design.md D5): reemplaza a
  // getByPresupuestoId — devuelve un array, nunca `null`.
  // -----------------------------------------------------------------------------------------

  it('listByPresupuestoId resuelve un array de un solo elemento para un presupuesto legacy (paridad con el modelo anterior)', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    const encontradas = await flushLatency(mockAutorizacionRepository.listByPresupuestoId('presupuesto-facundo-1'));

    expect(encontradas).toHaveLength(1);
    expect(encontradas[0]?.presupuestoId).toBe('presupuesto-facundo-1');
    expect(encontradas[0]?.estado).toBe('autorizada');
  });

  it('listByPresupuestoId resuelve un array vacío cuando el presupuesto no tiene ninguna autorización asociada', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    const encontradas = await flushLatency(mockAutorizacionRepository.listByPresupuestoId('presupuesto-sin-autorizacion'));

    expect(encontradas).toEqual([]);
  });

  it('listByPresupuestoId resuelve TODAS las filas de un presupuesto con varios meses, ordenadas por periodoMes ascendente (D5)', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    const encontradas = await flushLatency(mockAutorizacionRepository.listByPresupuestoId('presupuesto-camila-1'));

    expect(encontradas.map((a) => a.periodoMes)).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    expect(encontradas.map((a) => a.id)).toEqual([
      'autorizacion-camila-mes-1',
      'autorizacion-camila-mes-2',
      'autorizacion-camila-mes-3',
    ]);
  });

  // Triangulación: mismo presupuesto multi-mes, pero filtrando a un único mes puntual.
  it('listByPresupuestoId con periodoMes filtra a un único mes puntual', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    const encontradas = await flushLatency(
      mockAutorizacionRepository.listByPresupuestoId('presupuesto-camila-1', '2026-02-01'),
    );

    expect(encontradas).toHaveLength(1);
    expect(encontradas[0]?.id).toBe('autorizacion-camila-mes-2');
  });

  it('update() persiste los cambios y devuelve la entidad actualizada', async () => {
    const [primera] = await flushLatency(mockAutorizacionRepository.list());
    if (!primera) throw new Error('Debería existir al menos una autorización tras el seed inicial');

    const actualizada = await flushLatency(
      mockAutorizacionRepository.update(primera.id, { estado: 'rechazada' }),
    );

    expect(actualizada.estado).toBe('rechazada');

    const releida = await flushLatency(mockAutorizacionRepository.getById(primera.id));
    expect(releida?.estado).toBe('rechazada');
  });

  it('update() lanza un error explícito si el id no existe (borde)', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    await expect(mockAutorizacionRepository.update('no-existe', { estado: 'rechazada' })).rejects.toThrow();
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, autorizaciones: [{ id: 'x' }] }));

    const autorizaciones = await flushLatency(mockAutorizacionRepository.list());

    expect(autorizaciones).toHaveLength(7);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');

    const autorizaciones = await flushLatency(mockAutorizacionRepository.list());

    expect(autorizaciones).toHaveLength(7);
  });

  // autorizacion-mensual tasks.md 4.4: SCHEMA_VERSION sube 1 -> 2 (Autorizacion suma
  // `periodoMes?`, Fase 3; la cardinalidad por presupuesto pasa de 1:1 a 1:N, Fase 4). Un payload
  // viejo con schemaVersion 1, guardado por una versión anterior de la app, se descarta y se
  // resiembra — mismo criterio que integracion-obra-social D9.
  it('re-siembra desde el fixture si el localStorage quedó en schemaVersion 1 (versión anterior de la app, antes de periodoMes)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        autorizaciones: [
          { id: 'autorizacion-vieja', presupuestoId: 'presupuesto-viejo', estado: 'autorizada' },
        ],
      }),
    );

    const autorizaciones = await flushLatency(mockAutorizacionRepository.list());

    expect(autorizaciones).toHaveLength(7);
    expect(autorizaciones.some((a) => a.id === 'autorizacion-vieja')).toBe(false);
  });

  // -----------------------------------------------------------------------------------------
  // 3.7 — uploadArchivo()/removeArchivo() in-memory (mismo contrato que
  // SupabaseAutorizacionRepository, integracion-documentos-autorizaciones)
  // -----------------------------------------------------------------------------------------

  function buildFile(name: string): File {
    return new File([new Uint8Array(10)], name, { type: 'application/pdf' });
  }

  it('uploadArchivo() persiste un ArchivoAdjunto con nombre/cargadoEn/clave recuperable por getById', async () => {
    const [primera] = await flushLatency(mockAutorizacionRepository.list());
    if (!primera) throw new Error('Debería existir al menos una autorización tras el seed inicial');

    const actualizada = await flushLatency(mockAutorizacionRepository.uploadArchivo(primera.id, buildFile('informe.pdf')));

    expect(actualizada.archivo?.nombre).toBe('informe.pdf');
    expect(typeof actualizada.archivo?.cargadoEn).toBe('string');
    expect(actualizada.archivo?.clave).toBeTruthy();

    const releida = await flushLatency(mockAutorizacionRepository.getById(primera.id));
    expect(releida?.archivo?.nombre).toBe('informe.pdf');
  });

  it('uploadArchivo() dos veces (triangulación de reemplazo): la segunda clave difiere de la primera', async () => {
    const [primera] = await flushLatency(mockAutorizacionRepository.list());
    if (!primera) throw new Error('Debería existir al menos una autorización tras el seed inicial');

    const primeraSubida = await flushLatency(mockAutorizacionRepository.uploadArchivo(primera.id, buildFile('v1.pdf')));
    const segundaSubida = await flushLatency(mockAutorizacionRepository.uploadArchivo(primera.id, buildFile('v2.pdf')));

    expect(segundaSubida.archivo?.nombre).toBe('v2.pdf');
    expect(segundaSubida.archivo?.clave).not.toBe(primeraSubida.archivo?.clave);
  });

  it('uploadArchivo() con id inexistente lanza el mismo mensaje que update()', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    await expect(mockAutorizacionRepository.uploadArchivo('no-existe', buildFile('x.pdf'))).rejects.toThrow(
      'No existe una autorización con id "no-existe".',
    );
  });

  it('removeArchivo() borra el archivo y deja la autorización sin archivo', async () => {
    const [primera] = await flushLatency(mockAutorizacionRepository.list());
    if (!primera) throw new Error('Debería existir al menos una autorización tras el seed inicial');
    await flushLatency(mockAutorizacionRepository.uploadArchivo(primera.id, buildFile('informe.pdf')));

    const actualizada = await flushLatency(mockAutorizacionRepository.removeArchivo(primera.id));

    expect(actualizada.archivo).toBeUndefined();
    const releida = await flushLatency(mockAutorizacionRepository.getById(primera.id));
    expect(releida?.archivo).toBeUndefined();
  });

  it('removeArchivo() sin archivo previo no lanza (idempotente)', async () => {
    const [primera] = await flushLatency(mockAutorizacionRepository.list());
    if (!primera) throw new Error('Debería existir al menos una autorización tras el seed inicial');

    const resultado = await flushLatency(mockAutorizacionRepository.removeArchivo(primera.id));

    expect(resultado.id).toBe(primera.id);
    expect(resultado.archivo).toBeUndefined();
  });

  it('removeArchivo() con id inexistente lanza el mismo mensaje que update()', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    await expect(mockAutorizacionRepository.removeArchivo('no-existe')).rejects.toThrow(
      'No existe una autorización con id "no-existe".',
    );
  });

  // -----------------------------------------------------------------------------------------
  // 7.4/7.10 (presupuestos-vigencia-datos-traslado-vista-previa): uploadArchivo() persiste
  // tipoMime, getUrlArchivo() en memoria (ObjectURL)
  // -----------------------------------------------------------------------------------------

  it('uploadArchivo() persiste tipoMime desde File.type (D6c, mismo criterio que el repository real)', async () => {
    const [primera] = await flushLatency(mockAutorizacionRepository.list());
    if (!primera) throw new Error('Debería existir al menos una autorización tras el seed inicial');

    const actualizada = await flushLatency(mockAutorizacionRepository.uploadArchivo(primera.id, buildFile('informe.pdf')));

    expect(actualizada.archivo?.tipoMime).toBe('application/pdf');
  });

  it('getUrlArchivo() con archivo cargado resuelve un ObjectURL (blob:)', async () => {
    const [primera] = await flushLatency(mockAutorizacionRepository.list());
    if (!primera) throw new Error('Debería existir al menos una autorización tras el seed inicial');
    await flushLatency(mockAutorizacionRepository.uploadArchivo(primera.id, buildFile('informe.pdf')));

    const url = await flushLatency(mockAutorizacionRepository.getUrlArchivo(primera.id, 'inline'));

    expect(url).toMatch(/^blob:/);
  });

  it('getUrlArchivo() sin archivo adjunto resuelve null, sin lanzar', async () => {
    const [primera] = await flushLatency(mockAutorizacionRepository.list());
    if (!primera) throw new Error('Debería existir al menos una autorización tras el seed inicial');

    const url = await flushLatency(mockAutorizacionRepository.getUrlArchivo(primera.id, 'inline'));

    expect(url).toBeNull();
  });

  it('getUrlArchivo() con id inexistente resuelve null, sin lanzar', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    const url = await flushLatency(mockAutorizacionRepository.getUrlArchivo('no-existe', 'descarga'));

    expect(url).toBeNull();
  });
});
