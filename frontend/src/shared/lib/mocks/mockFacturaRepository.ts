import { generateId } from '../id';
import type { ActualizacionFactura, Factura, NuevaFactura } from '../../types/factura';
import type { FacturaRepository } from '../facturacion/FacturaRepository';
import { buildFacturasFixture } from './facturasFixture';

// Implementación mock de FacturaRepository (tasks.md 4.6, design.md Decisión 1): persiste en
// localStorage (claves `facturas`, con `schemaVersion`), siembra desde el fixture cuando no hay
// datos y devuelve promesas con latencia simulada. Cumple la interfaz al pie de la letra para que
// el reemplazo por SupabaseFacturaRepository (FE-8) sea mecánico — mismo patrón que
// mockPresupuestoRepository/mockAutorizacionRepository.

const STORAGE_KEY = 'facturas';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  facturas: Factura[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.facturas);
}

function seedFixture(): Factura[] {
  const seeded = buildFacturasFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): Factura[] {
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

  return parsed.facturas;
}

function writeStore(facturas: Factura[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, facturas };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockFacturaRepository: FacturaRepository = {
  async list() {
    return withLatency([...readStore()]);
  },

  async getById(id) {
    const found = readStore().find((factura) => factura.id === id) ?? null;
    return withLatency(found);
  },

  async listByPaciente(pacienteId) {
    return withLatency(readStore().filter((factura) => factura.pacienteId === pacienteId));
  },

  async create(data: NuevaFactura) {
    const nueva: Factura = { ...data, id: generateId('factura') };
    writeStore([...readStore(), nueva]);
    return withLatency(nueva);
  },

  async update(id, data: ActualizacionFactura) {
    const current = readStore();
    const index = current.findIndex((factura) => factura.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe una factura con id "${id}".`);
    }

    const actualizada: Factura = { ...existing, ...data, id };
    const next = [...current];
    next[index] = actualizada;
    writeStore(next);
    return withLatency(actualizada);
  },
};
