import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NuevoPresupuesto } from '../../types/presupuesto';
import { mockPresupuestoRepository } from './mockPresupuestoRepository';

const STORAGE_KEY = 'presupuestos';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevoPresupuesto(overrides: Partial<NuevoPresupuesto> = {}): NuevoPresupuesto {
  return {
    pacienteId: 'paciente-martina',
    obraSocialId: 'osecac',
    monto: 12_345,
    fechaEmision: '2026-07-01',
    ...overrides,
  };
}

describe('mockPresupuestoRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('siembra el fixture de 4 presupuestos cuando no hay datos previos en localStorage', async () => {
    const presupuestos = await flushLatency(mockPresupuestoRepository.list());

    expect(presupuestos).toHaveLength(4);
    expect(presupuestos.map((p) => p.pacienteId)).toContain('paciente-martina');
  });

  it('list() resuelve una promesa con latencia simulada (loading states reales)', async () => {
    let resolved = false;
    mockPresupuestoRepository.list().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    await vi.runAllTimersAsync();
    expect(resolved).toBe(true);
  });

  it('create() persiste un nuevo presupuesto recuperable por list() (persistencia entre "recargas")', async () => {
    await flushLatency(mockPresupuestoRepository.list());

    const creado = await flushLatency(mockPresupuestoRepository.create(buildNuevoPresupuesto({ monto: 999 })));

    expect(creado.id).toBeTruthy();

    const presupuestos = await flushLatency(mockPresupuestoRepository.list());
    expect(presupuestos.map((p) => p.monto)).toContain(999);
  });

  it('getById resuelve null cuando el id no existe', async () => {
    const found = await flushLatency(mockPresupuestoRepository.getById('no-existe'));

    expect(found).toBeNull();
  });

  it('update() persiste los cambios y devuelve la entidad actualizada', async () => {
    const [primero] = await flushLatency(mockPresupuestoRepository.list());
    if (!primero) throw new Error('Debería existir al menos un presupuesto tras el seed inicial');

    const actualizado = await flushLatency(mockPresupuestoRepository.update(primero.id, { monto: 555_555 }));

    expect(actualizado.monto).toBe(555_555);
    expect(actualizado.pacienteId).toBe(primero.pacienteId);

    const releido = await flushLatency(mockPresupuestoRepository.getById(primero.id));
    expect(releido?.monto).toBe(555_555);
  });

  it('update() lanza un error explícito si el id no existe (borde)', async () => {
    await flushLatency(mockPresupuestoRepository.list());

    await expect(mockPresupuestoRepository.update('no-existe', { monto: 1 })).rejects.toThrow();
  });

  it('re-siembra desde el fixture si el schemaVersion en localStorage no coincide (dato corrupto/viejo)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, presupuestos: [{ id: 'x' }] }));

    const presupuestos = await flushLatency(mockPresupuestoRepository.list());

    expect(presupuestos).toHaveLength(4);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');

    const presupuestos = await flushLatency(mockPresupuestoRepository.list());

    expect(presupuestos).toHaveLength(4);
  });
});
