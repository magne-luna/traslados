import { generateId } from '../id';
import type { ActualizacionVehiculo, NuevoVehiculo, Vehiculo } from '../../types/vehiculo';
import type { VehiculoRepository } from '../vehiculos/VehiculoRepository';
import { buildVehiculosFixture } from './vehiculosFixture';

// Implementación mock de VehiculoRepository (design.md Decisión 1): persiste en localStorage
// (no in-memory) porque la flota es un maestro que la administradora configura una vez y espera
// reencontrar entre recargas mientras prueba kilometraje/gastos/documentos. Cumple la interfaz
// al pie de la letra para que el reemplazo por SupabaseVehiculoRepository (FE-8) sea mecánico.

const STORAGE_KEY = 'vehiculos';
// v2: GastoVehiculo sumó `categoria` (obligatorio) — bump para descartar localStorage con gastos
// del esquema viejo (sin esa propiedad), que rompía <Chip> al buscar un kind inexistente.
const SCHEMA_VERSION = 2;

interface StoredPayload {
  schemaVersion: number;
  vehiculos: Vehiculo[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.vehiculos);
}

function seedFixture(): Vehiculo[] {
  const seeded = buildVehiculosFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): Vehiculo[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return seedFixture();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Payload corrupto: es solo un mock, no hay dato de producción que preservar (design.md
    // Risks/Trade-offs — localStorage sin versionado robusto de esquema).
    return seedFixture();
  }

  if (!isStoredPayload(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return seedFixture();
  }

  return parsed.vehiculos;
}

function writeStore(vehiculos: Vehiculo[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, vehiculos };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockVehiculoRepository: VehiculoRepository = {
  async list() {
    return withLatency([...readStore()]);
  },

  async getById(id) {
    const found = readStore().find((vehiculo) => vehiculo.id === id) ?? null;
    return withLatency(found);
  },

  async create(data: NuevoVehiculo) {
    const nuevo: Vehiculo = { ...data, id: generateId('vehiculo') };
    writeStore([...readStore(), nuevo]);
    return withLatency(nuevo);
  },

  async update(id, data: ActualizacionVehiculo) {
    const current = readStore();
    const index = current.findIndex((vehiculo) => vehiculo.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe un vehículo con id "${id}".`);
    }

    const actualizado: Vehiculo = { ...existing, ...data, id };
    const next = [...current];
    next[index] = actualizado;
    writeStore(next);
    return withLatency(actualizado);
  },
};
