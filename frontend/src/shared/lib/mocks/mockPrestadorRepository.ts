import { generateId } from '../id';
import type { ActualizacionPrestador, NuevoPrestador, Prestador } from '../../types/prestador';
import type { PrestadorRepository } from '../prestadores/PrestadorRepository';
import { buildPrestadoresFixture, buildVinculosFixture } from './prestadoresFixture';

// Implementación mock de PrestadorRepository (fix de coordinación 2026-08-04 sobre
// `factura-por-prestador`, ver `CHANGES.md` y `prestadoresFixture.ts`): persiste en localStorage
// (claves `prestadores`, con `schemaVersion`), siembra desde el fixture cuando no hay datos y
// devuelve promesas con latencia simulada — mismo patrón que `mockObraSocialRepository.ts`.
//
// El vínculo N:N con ObraSocial (`obrasSocialesIds` en `ActualizacionPrestador`) se guarda aparte,
// como `Record<prestadorId, obraSocialId[]>`, en la misma clave de localStorage: el mock no
// necesita una tabla de join real, solo lo que `listarPorObraSocial()` consulta. `create()` nace
// sin ningún vínculo (mismo comportamiento que `SupabasePrestadorRepository.crearPrestador` —
// el alta de vínculos es responsabilidad de `update()`, `ActualizacionPrestador.obrasSocialesIds`).

const STORAGE_KEY = 'prestadores';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  prestadores: Prestador[];
  vinculos: Record<string, string[]>;
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.schemaVersion === 'number' &&
    Array.isArray(candidate.prestadores) &&
    typeof candidate.vinculos === 'object' &&
    candidate.vinculos !== null
  );
}

function seedFixture(): StoredPayload {
  const seeded: StoredPayload = {
    schemaVersion: SCHEMA_VERSION,
    prestadores: buildPrestadoresFixture(),
    vinculos: buildVinculosFixture(),
  };
  writeStore(seeded);
  return seeded;
}

function readStore(): StoredPayload {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return seedFixture();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Payload corrupto: es solo un mock, no hay dato de producción que preservar (mismo criterio
    // que `mockObraSocialRepository.ts`/`mockFacturaRepository.ts`).
    return seedFixture();
  }

  if (!isStoredPayload(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return seedFixture();
  }

  return parsed;
}

function writeStore(payload: StoredPayload): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export const mockPrestadorRepository: PrestadorRepository = {
  async list() {
    return withLatency([...readStore().prestadores]);
  },

  async getById(id) {
    const found = readStore().prestadores.find((prestador) => prestador.id === id) ?? null;
    return withLatency(found);
  },

  async create(data: NuevoPrestador) {
    const store = readStore();
    const nuevo: Prestador = { ...data, id: generateId('prestador') };
    writeStore({ ...store, prestadores: [...store.prestadores, nuevo] });
    return withLatency(nuevo);
  },

  async update(id, data: ActualizacionPrestador) {
    const store = readStore();
    const index = store.prestadores.findIndex((prestador) => prestador.id === id);
    const existing = index === -1 ? undefined : store.prestadores[index];
    if (!existing) {
      throw new Error(`No existe un prestador con id "${id}".`);
    }

    const { obrasSocialesIds, ...camposPlanos } = data;
    const actualizado: Prestador = { ...existing, ...camposPlanos, id };
    const prestadores = [...store.prestadores];
    prestadores[index] = actualizado;

    // `obrasSocialesIds` ausente = "no tocar el vínculo" (mismo contrato que
    // `SupabasePrestadorRepository.update`, ver `shared/types/prestador.ts`).
    const vinculos =
      obrasSocialesIds === undefined ? store.vinculos : { ...store.vinculos, [id]: obrasSocialesIds };

    writeStore({ ...store, prestadores, vinculos });
    return withLatency(actualizado);
  },

  async listarPorObraSocial(obraSocialId) {
    const store = readStore();
    const vinculados = store.prestadores.filter((prestador) => (store.vinculos[prestador.id] ?? []).includes(obraSocialId));
    return withLatency(vinculados);
  },
};
