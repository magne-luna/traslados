import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NuevoConductor } from '../../types/conductor';
import { mockConductorRepository } from './mockConductorRepository';

const STORAGE_KEY = 'conductores';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevoConductor(overrides: Partial<NuevoConductor> = {}): NuevoConductor {
  return {
    apellido: 'Fernández',
    nombre: 'Ana',
    documento: '99887766',
    domicilio: 'Belgrano 200, Quilmes',
    cuil: '27-99887766-1',
    estado: 'operando',
    asignaciones: [],
    ...overrides,
  };
}

describe('mockConductorRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra el fixture de 3 conductores cuando no hay datos previos en localStorage', async () => {
    const promise = mockConductorRepository.list();
    const conductores = await flushLatency(promise);

    expect(conductores).toHaveLength(3);
  });

  it('simula latencia de red: la promesa no resuelve antes de avanzar los timers (triangulación)', async () => {
    let resolved = false;
    mockConductorRepository.list().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('create() persiste un nuevo conductor recuperable por list() (persistencia entre "recargas")', async () => {
    await flushLatency(mockConductorRepository.list());

    const creado = await flushLatency(mockConductorRepository.create(buildNuevoConductor({ apellido: 'Nuevo' })));

    expect(creado.id).toBeTruthy();

    const conductores = await flushLatency(mockConductorRepository.list());
    expect(conductores.map((c) => c.apellido)).toContain('Nuevo');
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockConductorRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  it('update() persiste los cambios y devuelve la entidad actualizada', async () => {
    const [primero] = await flushLatency(mockConductorRepository.list());
    if (!primero) throw new Error('Debería existir al menos un conductor tras el seed inicial');

    const actualizado = await flushLatency(
      mockConductorRepository.update(primero.id, { telefono: '11-0000-1111' }),
    );

    expect(actualizado.telefono).toBe('11-0000-1111');
    expect(actualizado.apellido).toBe(primero.apellido);

    const releido = await flushLatency(mockConductorRepository.getById(primero.id));
    expect(releido?.telefono).toBe('11-0000-1111');
  });

  it('update() lanza un error explícito si el id no existe (borde)', async () => {
    await flushLatency(mockConductorRepository.list());

    await expect(mockConductorRepository.update('no-existe', { telefono: '1' })).rejects.toThrow();
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, conductores: [{ id: 'x' }] }));

    const conductores = await flushLatency(mockConductorRepository.list());

    expect(conductores).toHaveLength(3);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');

    const conductores = await flushLatency(mockConductorRepository.list());

    expect(conductores).toHaveLength(3);
  });
});
