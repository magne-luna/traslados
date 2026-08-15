import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NuevoRecorridoHabitual } from '../../types/recorridoHabitual';
import { mockRecorridoHabitualRepository } from './mockRecorridoHabitualRepository';

const STORAGE_KEY = 'recorridos-habituales';

async function flushLatency<T>(promise: Promise<T>): Promise<T> {
  const result = promise;
  await vi.runAllTimersAsync();
  return result;
}

function buildNuevoRecorridoHabitual(overrides: Partial<NuevoRecorridoHabitual> = {}): NuevoRecorridoHabitual {
  return {
    pacienteId: 'p-1',
    direccionInicialId: 'd-1',
    direccionFinalId: 'd-2',
    diaSemana: 'lunes',
    hora: '08:30',
    ...overrides,
  };
}

describe('mockRecorridoHabitualRepository', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('un paciente sin destinos habituales cargados devuelve [] (el fixture arranca vacío, RF-110)', async () => {
    const resultado = await flushLatency(mockRecorridoHabitualRepository.list('p-1'));
    expect(resultado).toEqual([]);
  });

  it('create() persiste un destino habitual recuperable por list() de ese paciente', async () => {
    const creado = await flushLatency(mockRecorridoHabitualRepository.create(buildNuevoRecorridoHabitual()));

    expect(creado.id).toBeTruthy();
    const resultado = await flushLatency(mockRecorridoHabitualRepository.list('p-1'));
    expect(resultado.map((r) => r.id)).toContain(creado.id);
  });

  it('list() no devuelve destinos habituales de otro paciente', async () => {
    await flushLatency(mockRecorridoHabitualRepository.create(buildNuevoRecorridoHabitual({ pacienteId: 'p-1' })));
    await flushLatency(mockRecorridoHabitualRepository.create(buildNuevoRecorridoHabitual({ pacienteId: 'p-2' })));

    const resultado = await flushLatency(mockRecorridoHabitualRepository.list('p-1'));

    expect(resultado.every((r) => r.pacienteId === 'p-1')).toBe(true);
  });

  it('remove() borra el destino habitual y deja de aparecer en list()', async () => {
    const creado = await flushLatency(mockRecorridoHabitualRepository.create(buildNuevoRecorridoHabitual()));

    await flushLatency(mockRecorridoHabitualRepository.remove(creado.id));

    const resultado = await flushLatency(mockRecorridoHabitualRepository.list('p-1'));
    expect(resultado.map((r) => r.id)).not.toContain(creado.id);
  });

  it('re-siembra desde el fixture (vacío) si el schemaVersion en localStorage no coincide', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 0, recorridos: [{ id: 'x' }] }));
    const resultado = await flushLatency(mockRecorridoHabitualRepository.list('p-1'));
    expect(resultado).toEqual([]);
  });

  it('re-siembra desde el fixture si el payload de localStorage está corrupto (JSON inválido)', async () => {
    localStorage.setItem(STORAGE_KEY, 'no-es-json{{{');
    const resultado = await flushLatency(mockRecorridoHabitualRepository.list('p-1'));
    expect(resultado).toEqual([]);
  });
});
