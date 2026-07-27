import { generateId } from '../id';
import type { Cobro, NuevoCobro } from '../../types/factura';
import type { CobroRepository } from '../facturacion/CobroRepository';
import { buildCobrosFixture } from './cobrosFixture';

// Implementación mock de CobroRepository (tasks.md 4.6, design.md Decisión 1): persiste en
// localStorage (clave `cobros`, con `schemaVersion`), siembra desde el fixture cuando no hay
// datos y devuelve promesas con latencia simulada. Mismo patrón que mockFacturaRepository.

const STORAGE_KEY = 'cobros';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  cobros: Cobro[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.cobros);
}

function seedFixture(): Cobro[] {
  const seeded = buildCobrosFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): Cobro[] {
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

  return parsed.cobros;
}

function writeStore(cobros: Cobro[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, cobros };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockCobroRepository: CobroRepository = {
  // tasks.md 2.3, design.md Decisión 6: adición aditiva, reutilizando la misma lectura de
  // localStorage y la misma latencia simulada — sin tocar schemaVersion ni el fixture.
  async list() {
    return withLatency(readStore());
  },

  async listByFactura(facturaId) {
    return withLatency(readStore().filter((cobro) => cobro.facturaId === facturaId));
  },

  async create(data: NuevoCobro) {
    const nuevo: Cobro = { ...data, id: generateId('cobro') };
    writeStore([...readStore(), nuevo]);
    return withLatency(nuevo);
  },

  async remove(id) {
    writeStore(readStore().filter((cobro) => cobro.id !== id));
    return withLatency(undefined);
  },
};
