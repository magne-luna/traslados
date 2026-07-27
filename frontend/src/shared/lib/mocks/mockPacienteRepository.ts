import { generateId } from '../id';
import type { ActualizacionPaciente, NuevoPaciente, Paciente } from '../../types/paciente';
import type { PacienteRepository } from '../pacientes/PacienteRepository';
import { buildPacientesFixture } from './pacientesFixture';

// Implementación mock de PacienteRepository (design.md Decisión 5): persiste en localStorage
// con schemaVersion + withLatency + re-siembra ante payload ausente/corrupto/versión distinta,
// replicando el patrón de mockObraSocialRepository (FE-2). Cumple la interfaz al pie de la letra
// para que el reemplazo por SupabasePacienteRepository (FE-8) sea mecánico.

const STORAGE_KEY = 'pacientes';
const SCHEMA_VERSION = 2;

interface StoredPayload {
  schemaVersion: number;
  pacientes: Paciente[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.pacientes);
}

function seedFixture(): Paciente[] {
  const seeded = buildPacientesFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): Paciente[] {
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

  return parsed.pacientes;
}

function writeStore(pacientes: Paciente[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, pacientes };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockPacienteRepository: PacienteRepository = {
  async list() {
    return withLatency([...readStore()]);
  },

  async getById(id) {
    const found = readStore().find((paciente) => paciente.id === id) ?? null;
    return withLatency(found);
  },

  async create(data: NuevoPaciente) {
    const nuevo: Paciente = { ...data, id: generateId('paciente') };
    writeStore([...readStore(), nuevo]);
    return withLatency(nuevo);
  },

  async update(id, data: ActualizacionPaciente) {
    const current = readStore();
    const index = current.findIndex((paciente) => paciente.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe un paciente con id "${id}".`);
    }

    const actualizado: Paciente = { ...existing, ...data, id };
    const next = [...current];
    next[index] = actualizado;
    writeStore(next);
    return withLatency(actualizado);
  },
};
