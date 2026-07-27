import { generateId } from '../id';
import type { ActualizacionObraSocial, NuevaObraSocial, ObraSocial } from '../../types/obraSocial';
import type { ObraSocialRepository } from '../obrasSociales/ObraSocialRepository';
import { buildOsecacFixture } from './osecacFixture';

// Implementación mock de ObraSocialRepository (design.md Decisión 1): persiste en localStorage
// (a diferencia del mock in-memory de FE-1) porque Obras Sociales es un maestro que el usuario
// configura una vez y espera reencontrar entre recargas. Cumple la interfaz al pie de la letra
// para que el reemplazo por SupabaseObraSocialRepository (FE-8) sea mecánico.

const STORAGE_KEY = 'obras-sociales';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  obrasSociales: ObraSocial[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.obrasSociales);
}

function seedFixture(): ObraSocial[] {
  const seeded = [buildOsecacFixture()];
  writeStore(seeded);
  return seeded;
}

function readStore(): ObraSocial[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return seedFixture();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Payload corrupto: es solo un mock, no hay dato de producción que preservar (design.md
    // Risks/Trade-offs — localStorage sin versionado de esquema).
    return seedFixture();
  }

  if (!isStoredPayload(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return seedFixture();
  }

  return parsed.obrasSociales;
}

function writeStore(obrasSociales: ObraSocial[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, obrasSociales };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockObraSocialRepository: ObraSocialRepository = {
  async list() {
    return withLatency([...readStore()]);
  },

  async getById(id) {
    const found = readStore().find((obraSocial) => obraSocial.id === id) ?? null;
    return withLatency(found);
  },

  async create(data: NuevaObraSocial) {
    const nueva: ObraSocial = { ...data, id: generateId('os') };
    writeStore([...readStore(), nueva]);
    return withLatency(nueva);
  },

  async update(id, data: ActualizacionObraSocial) {
    const current = readStore();
    const index = current.findIndex((obraSocial) => obraSocial.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe una obra social con id "${id}".`);
    }

    const actualizada: ObraSocial = { ...existing, ...data, id };
    const next = [...current];
    next[index] = actualizada;
    writeStore(next);
    return withLatency(actualizada);
  },
};
