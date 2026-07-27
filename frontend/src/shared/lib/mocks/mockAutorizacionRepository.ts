import { generateId } from '../id';
import type { ActualizacionAutorizacion, Autorizacion, NuevaAutorizacion } from '../../types/presupuesto';
import type { AutorizacionRepository } from '../presupuestos/AutorizacionRepository';
import { buildAutorizacionesFixture } from './autorizacionesFixture';

// Implementación mock de AutorizacionRepository (design.md Decisión 1 y 2): persiste en
// localStorage, entidad separada de Presupuesto referenciada por `presupuestoId`. Cumple la
// interfaz al pie de la letra para que el reemplazo por SupabaseAutorizacionRepository (FE-8) sea
// mecánico — mismo patrón que mockPresupuestoRepository.

const STORAGE_KEY = 'autorizaciones';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  autorizaciones: Autorizacion[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.autorizaciones);
}

function seedFixture(): Autorizacion[] {
  const seeded = buildAutorizacionesFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): Autorizacion[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return seedFixture();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Payload corrupto: es solo un mock, no hay dato de producción que preservar (design.md
    // Risks/Trade-offs — localStorage sin versionado robusto).
    return seedFixture();
  }

  if (!isStoredPayload(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return seedFixture();
  }

  return parsed.autorizaciones;
}

function writeStore(autorizaciones: Autorizacion[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, autorizaciones };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockAutorizacionRepository: AutorizacionRepository = {
  async list() {
    return withLatency([...readStore()]);
  },

  async getById(id) {
    const found = readStore().find((autorizacion) => autorizacion.id === id) ?? null;
    return withLatency(found);
  },

  async getByPresupuestoId(presupuestoId) {
    const found = readStore().find((autorizacion) => autorizacion.presupuestoId === presupuestoId) ?? null;
    return withLatency(found);
  },

  async create(data: NuevaAutorizacion) {
    const nueva: Autorizacion = { ...data, id: generateId('autorizacion') };
    writeStore([...readStore(), nueva]);
    return withLatency(nueva);
  },

  async update(id, data: ActualizacionAutorizacion) {
    const current = readStore();
    const index = current.findIndex((autorizacion) => autorizacion.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe una autorización con id "${id}".`);
    }

    const actualizada: Autorizacion = { ...existing, ...data, id };
    const next = [...current];
    next[index] = actualizada;
    writeStore(next);
    return withLatency(actualizada);
  },
};
