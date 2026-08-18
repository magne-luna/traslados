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

  it('siembra el fixture con una autorización por cada estado cuando no hay datos previos', async () => {
    const autorizaciones = await flushLatency(mockAutorizacionRepository.list());

    expect(autorizaciones).toHaveLength(4);
    const estados = autorizaciones.map((a) => a.estado).sort();
    expect(estados).toEqual(['autorizada', 'judicializada', 'pendiente', 'rechazada']);
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

  it('getByPresupuestoId resuelve la autorización asociada a un presupuesto', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    const found = await flushLatency(mockAutorizacionRepository.getByPresupuestoId('presupuesto-facundo-1'));

    expect(found?.presupuestoId).toBe('presupuesto-facundo-1');
    expect(found?.estado).toBe('autorizada');
  });

  it('getByPresupuestoId resuelve null cuando el presupuesto no tiene autorización asociada', async () => {
    await flushLatency(mockAutorizacionRepository.list());

    const found = await flushLatency(mockAutorizacionRepository.getByPresupuestoId('presupuesto-sin-autorizacion'));

    expect(found).toBeNull();
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

    expect(autorizaciones).toHaveLength(4);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');

    const autorizaciones = await flushLatency(mockAutorizacionRepository.list());

    expect(autorizaciones).toHaveLength(4);
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
});
