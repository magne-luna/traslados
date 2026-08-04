import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mockPrestadorRepository } from './mockPrestadorRepository';
import { PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR } from './prestadoresFixture';

const STORAGE_KEY = 'prestadores';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

describe('mockPrestadorRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra los 2 prestadores del fixture cuando no hay datos previos en localStorage', async () => {
    const prestadores = await flushLatency(mockPrestadorRepository.list());

    expect(prestadores).toHaveLength(2);
    expect(prestadores.map((p) => p.razonSocial)).toContain('Traslados Andrea Pastor');
  });

  it('listarPorObraSocial("osecac") resuelve los 2 prestadores vinculados en el fixture', async () => {
    const vinculados = await flushLatency(mockPrestadorRepository.listarPorObraSocial('osecac'));

    expect(vinculados).toHaveLength(2);
    expect(vinculados.map((p) => p.id)).toContain(PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR);
  });

  it('listarPorObraSocial resuelve [] para una obra social sin ningún prestador vinculado', async () => {
    const vinculados = await flushLatency(mockPrestadorRepository.listarPorObraSocial('otra-obra-social'));

    expect(vinculados).toEqual([]);
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockPrestadorRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  it('create() persiste un nuevo prestador sin ningún vínculo (recuperable por list(), ausente de listarPorObraSocial)', async () => {
    await flushLatency(mockPrestadorRepository.list());

    const creado = await flushLatency(
      mockPrestadorRepository.create({
        razonSocial: 'Nuevo Prestador SRL',
        cuit: '30-11111111-1',
        plazoCobroDias: 90,
        tipoComprobante: 'A',
      }),
    );

    expect(creado.id).toBeTruthy();
    const prestadores = await flushLatency(mockPrestadorRepository.list());
    expect(prestadores.map((p) => p.razonSocial)).toContain('Nuevo Prestador SRL');

    const vinculadosOsecac = await flushLatency(mockPrestadorRepository.listarPorObraSocial('osecac'));
    expect(vinculadosOsecac.map((p) => p.id)).not.toContain(creado.id);
  });

  it('update() persiste los campos planos sin tocar el vínculo cuando obrasSocialesIds está ausente', async () => {
    const actualizado = await flushLatency(
      mockPrestadorRepository.update(PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR, { plazoCobroDias: 45 }),
    );

    expect(actualizado.plazoCobroDias).toBe(45);
    expect(actualizado.razonSocial).toBe('Traslados Andrea Pastor');

    const vinculados = await flushLatency(mockPrestadorRepository.listarPorObraSocial('osecac'));
    expect(vinculados.map((p) => p.id)).toContain(PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR);
  });

  it('update() con obrasSocialesIds reemplaza el vínculo completo (diff, no acumula)', async () => {
    await flushLatency(
      mockPrestadorRepository.update(PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR, { obrasSocialesIds: [] }),
    );

    const vinculados = await flushLatency(mockPrestadorRepository.listarPorObraSocial('osecac'));
    expect(vinculados.map((p) => p.id)).not.toContain(PRESTADOR_ID_TRASLADOS_ANDREA_PASTOR);
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ schemaVersion: 0, prestadores: [{ id: 'x', razonSocial: 'Basura' }], vinculos: {} }),
    );

    const prestadores = await flushLatency(mockPrestadorRepository.list());

    expect(prestadores).toHaveLength(2);
  });
});
