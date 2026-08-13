import { generateId } from '../id';
import type { ActualizacionPresupuesto, NuevoPresupuesto, Presupuesto } from '../../types/presupuesto';
import type { PresupuestoRepository } from '../presupuestos/PresupuestoRepository';
import { buildPresupuestosFixture } from './presupuestosFixture';

// Implementación mock de PresupuestoRepository (design.md Decisión 1): persiste en localStorage
// (no in-memory) porque presupuestos son datos acumulados que se prueban a lo largo de varias
// recargas (cargar presupuesto → cargar autorización → cambiar estado → revalidar). Cumple la
// interfaz al pie de la letra para que el reemplazo por SupabasePresupuestoRepository (FE-8) sea
// mecánico — mismo patrón que mockVehiculoRepository/mockPacienteRepository.

const STORAGE_KEY = 'presupuestos';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  presupuestos: Presupuesto[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.presupuestos);
}

function seedFixture(): Presupuesto[] {
  const seeded = buildPresupuestosFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): Presupuesto[] {
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

  return parsed.presupuestos;
}

function writeStore(presupuestos: Presupuesto[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, presupuestos };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockPresupuestoRepository: PresupuestoRepository = {
  async list() {
    return withLatency([...readStore()]);
  },

  async getById(id) {
    const found = readStore().find((presupuesto) => presupuesto.id === id) ?? null;
    return withLatency(found);
  },

  async create(data: NuevoPresupuesto) {
    const nuevo: Presupuesto = { ...data, id: generateId('presupuesto') };
    writeStore([...readStore(), nuevo]);
    return withLatency(nuevo);
  },

  // 6.3 (presupuesto-prestaciones PR 2): misma semántica atómica (simulada) que
  // facturacion.crear_presupuestos_lote — se valida el lote ENTERO antes de escribir nada, y se
  // persiste con un único writeStore() (o entran todos, o no entra ninguno).
  async createLote(nuevos: NuevoPresupuesto[]) {
    if (nuevos.length === 0) {
      throw new Error('El lote de presupuestos no puede estar vacío.');
    }
    for (const nuevo of nuevos) {
      if (
        !nuevo.pacienteId ||
        !nuevo.obraSocialId ||
        typeof nuevo.monto !== 'number' ||
        Number.isNaN(nuevo.monto) ||
        !nuevo.fechaEmision
      ) {
        throw new Error('Faltan datos obligatorios del presupuesto.');
      }
    }

    const creados: Presupuesto[] = nuevos.map((nuevo) => ({ ...nuevo, id: generateId('presupuesto') }));
    writeStore([...readStore(), ...creados]);
    return withLatency(creados);
  },

  async update(id, data: ActualizacionPresupuesto) {
    const current = readStore();
    const index = current.findIndex((presupuesto) => presupuesto.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe un presupuesto con id "${id}".`);
    }

    const actualizado: Presupuesto = { ...existing, ...data, id };
    const next = [...current];
    next[index] = actualizado;
    writeStore(next);
    return withLatency(actualizado);
  },
};
