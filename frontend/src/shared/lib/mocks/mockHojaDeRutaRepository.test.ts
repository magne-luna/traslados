import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';
import type { NuevaHojaDeRuta } from '../../types/hojaDeRuta';
import { mockHojaDeRutaRepository } from './mockHojaDeRutaRepository';

const STORAGE_KEY = 'hojasDeRuta';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevaHojaDeRuta(overrides: Partial<NuevaHojaDeRuta> = {}): NuevaHojaDeRuta {
  return {
    fecha: '2026-08-01',
    franjaInicio: '08:00',
    franjaFin: '20:00',
    recorridos: [],
    ...overrides,
  };
}

describe('mockHojaDeRutaRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra el fixture de la hoja de ruta de hoy cuando no hay datos previos en localStorage', async () => {
    const hojas = await flushLatency(mockHojaDeRutaRepository.list());

    expect(hojas).toHaveLength(1);
    expect(hojas[0]?.recorridos.length).toBeGreaterThanOrEqual(2);
  });

  it('list() resuelve una promesa con latencia simulada (loading states reales)', async () => {
    let resolved = false;
    mockHojaDeRutaRepository.list().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('create() persiste una nueva hoja de ruta recuperable por list() (persistencia entre "recargas")', async () => {
    await flushLatency(mockHojaDeRutaRepository.list());

    const creada = await flushLatency(
      mockHojaDeRutaRepository.create(buildNuevaHojaDeRuta({ fecha: '2026-09-15' })),
    );

    expect(creada.id).toBeTruthy();

    const hojas = await flushLatency(mockHojaDeRutaRepository.list());
    expect(hojas.map((h) => h.fecha)).toContain('2026-09-15');
  });

  it('create() asigna ids a la hoja, a cada recorrido y a cada parada (agregado completo)', async () => {
    const creada = await flushLatency(
      mockHojaDeRutaRepository.create(
        buildNuevaHojaDeRuta({
          fecha: '2026-09-20',
          recorridos: [
            {
              vehiculoId: 'vehiculo-etios',
              conductorId: 'conductor-gonzalez',
              manual: false,
              paradas: [
                {
                  pacienteId: 'paciente-martina',
                  tramo: 'ida',
                  direccionOrigenId: 'dir-martina-domicilio-ida',
                  direccionDestinoId: 'dir-martina-escuela-vuelta',
                  orden: 0,
                },
              ],
            },
          ],
        }),
      ),
    );

    expect(creada.recorridos[0]?.id).toBeTruthy();
    expect(creada.recorridos[0]?.paradas[0]?.id).toBeTruthy();
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockHojaDeRutaRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  it('getByFecha resuelve null cuando no hay hoja de ruta cargada para esa fecha', async () => {
    const found = await flushLatency(mockHojaDeRutaRepository.getByFecha('1999-01-01'));

    expect(found).toBeNull();
  });

  it('getByFecha resuelve la hoja de ruta existente para una fecha dada (triangulación de getById)', async () => {
    await flushLatency(mockHojaDeRutaRepository.create(buildNuevaHojaDeRuta({ fecha: '2026-10-05' })));

    const found = await flushLatency(mockHojaDeRutaRepository.getByFecha('2026-10-05'));

    expect(found?.fecha).toBe('2026-10-05');
  });

  it('update() persiste los cambios del agregado y devuelve la entidad actualizada', async () => {
    const [primera] = await flushLatency(mockHojaDeRutaRepository.list());
    if (!primera) throw new Error('Debería existir al menos una hoja de ruta tras el seed inicial');

    const actualizada = await flushLatency(
      mockHojaDeRutaRepository.update(primera.id, { notas: 'Nota actualizada de prueba' }),
    );

    expect(actualizada.notas).toBe('Nota actualizada de prueba');

    const releida = await flushLatency(mockHojaDeRutaRepository.getById(primera.id));
    expect(releida?.notas).toBe('Nota actualizada de prueba');
  });

  it('update() lanza un error explícito si el id no existe (borde)', async () => {
    await flushLatency(mockHojaDeRutaRepository.list());

    await expect(mockHojaDeRutaRepository.update('no-existe', { notas: 'x' })).rejects.toThrow();
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, hojasDeRuta: [{ id: 'x' }] }));

    const hojas = await flushLatency(mockHojaDeRutaRepository.list());

    expect(hojas).toHaveLength(1);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');

    const hojas = await flushLatency(mockHojaDeRutaRepository.list());

    expect(hojas).toHaveLength(1);
  });
});
