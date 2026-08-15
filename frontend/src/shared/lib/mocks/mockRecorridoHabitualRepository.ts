import { generateId } from '../id';
import type { NuevoRecorridoHabitual, RecorridoHabitual } from '../../types/recorridoHabitual';
import type { RecorridoHabitualRepository } from '../pacientes/RecorridoHabitualRepository';
import { buildRecorridosHabitualesFixture } from './recorridosHabitualesFixture';

// Implementación mock de RecorridoHabitualRepository (RF-110): persiste en localStorage (clave
// `recorridos-habituales`, con `schemaVersion`), siembra desde el fixture (vacío — ver
// recorridosHabitualesFixture.ts) cuando no hay datos, devuelve promesas con latencia simulada.
// Mismo patrón que mockCobroRepository.

const STORAGE_KEY = 'recorridos-habituales';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  recorridos: RecorridoHabitual[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.recorridos);
}

function seedFixture(): RecorridoHabitual[] {
  const seeded = buildRecorridosHabitualesFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): RecorridoHabitual[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return seedFixture();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Payload corrupto: es solo un mock, no hay dato de producción que preservar.
    return seedFixture();
  }

  if (!isStoredPayload(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return seedFixture();
  }

  return parsed.recorridos;
}

function writeStore(recorridos: RecorridoHabitual[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, recorridos };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockRecorridoHabitualRepository: RecorridoHabitualRepository = {
  async list(pacienteId) {
    return withLatency(readStore().filter((recorrido) => recorrido.pacienteId === pacienteId));
  },

  async create(data: NuevoRecorridoHabitual) {
    const nuevo: RecorridoHabitual = { ...data, id: generateId('recorrido-habitual') };
    writeStore([...readStore(), nuevo]);
    return withLatency(nuevo);
  },

  async remove(id) {
    writeStore(readStore().filter((recorrido) => recorrido.id !== id));
    return withLatency(undefined);
  },
};
