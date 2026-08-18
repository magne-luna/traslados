import { generateId } from '../id';
import type { ActualizacionAutorizacion, ArchivoAdjunto, Autorizacion, NuevaAutorizacion } from '../../types/presupuesto';
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

  // uploadArchivo()/removeArchivo() (integracion-documentos-autorizaciones, tasks.md 3.7): mismo
  // contrato que SupabaseAutorizacionRepository, en memoria — sin Storage real, la "clave" es solo
  // un id local para que el reemplazo (dos uploads seguidos) sea distinguible, igual que
  // `create()` usa `generateId` para el id de la entidad.
  async uploadArchivo(id, file) {
    const current = readStore();
    const index = current.findIndex((autorizacion) => autorizacion.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe una autorización con id "${id}".`);
    }

    const archivo: ArchivoAdjunto = {
      nombre: file.name,
      cargadoEn: new Date().toISOString(),
      clave: `${id}/${generateId('archivo')}-${file.name}`,
    };

    const actualizada: Autorizacion = { ...existing, archivo, id };
    const next = [...current];
    next[index] = actualizada;
    writeStore(next);
    return withLatency(actualizada);
  },

  async removeArchivo(id) {
    const current = readStore();
    const index = current.findIndex((autorizacion) => autorizacion.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe una autorización con id "${id}".`);
    }

    // Idempotente (spec "Quitar cuando no hay archivo no falla"): sin archivo, no hay nada que
    // limpiar — se devuelve la entidad tal cual, sin reescribir el store.
    if (!existing.archivo) return withLatency(existing);

    const actualizada: Autorizacion = { ...existing, id };
    delete actualizada.archivo;
    const next = [...current];
    next[index] = actualizada;
    writeStore(next);
    return withLatency(actualizada);
  },
};
