import { generateId } from '../id';
import type {
  ActualizacionHojaDeRuta,
  HojaDeRuta,
  NuevaHojaDeRuta,
  NuevoRecorrido,
  Recorrido,
} from '../../types/hojaDeRuta';
import type { HojaDeRutaRepository } from '../hojas-de-ruta/HojaDeRutaRepository';
import { buildHojasDeRutaFixture } from './hojasDeRutaFixture';

// Implementación mock de HojaDeRutaRepository (design.md Decisión 10): persiste en localStorage
// (no in-memory) porque el armado del día se prueba a lo largo de varias recargas (armar →
// editar → reasignar → exportar). Cumple la interfaz al pie de la letra para que el reemplazo
// por SupabaseHojaDeRutaRepository (FE-8) sea mecánico.

const STORAGE_KEY = 'hojasDeRuta';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  hojasDeRuta: HojaDeRuta[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.hojasDeRuta);
}

function seedFixture(): HojaDeRuta[] {
  const seeded = buildHojasDeRutaFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): HojaDeRuta[] {
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

  return parsed.hojasDeRuta;
}

function writeStore(hojasDeRuta: HojaDeRuta[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, hojasDeRuta };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Asigna id a la hoja de ruta y, en cascada, a cada recorrido y cada parada (tasks.md 3.3). */
function materializarNuevaHojaDeRuta(data: NuevaHojaDeRuta): HojaDeRuta {
  const recorridos: Recorrido[] = data.recorridos.map((recorrido: NuevoRecorrido) => ({
    ...recorrido,
    id: generateId('recorrido'),
    paradas: recorrido.paradas.map((parada) => ({ ...parada, id: generateId('parada') })),
  }));

  return { ...data, id: generateId('hoja-de-ruta'), recorridos };
}

export const mockHojaDeRutaRepository: HojaDeRutaRepository = {
  async list() {
    return withLatency([...readStore()]);
  },

  async getById(id) {
    const found = readStore().find((hoja) => hoja.id === id) ?? null;
    return withLatency(found);
  },

  async getByFecha(fecha) {
    const found = readStore().find((hoja) => hoja.fecha === fecha) ?? null;
    return withLatency(found);
  },

  async create(data: NuevaHojaDeRuta) {
    const nueva = materializarNuevaHojaDeRuta(data);
    writeStore([...readStore(), nueva]);
    return withLatency(nueva);
  },

  async update(id, data: ActualizacionHojaDeRuta) {
    const current = readStore();
    const index = current.findIndex((hoja) => hoja.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe una hoja de ruta con id "${id}".`);
    }

    const actualizada: HojaDeRuta = { ...existing, ...data, id };
    const next = [...current];
    next[index] = actualizada;
    writeStore(next);
    return withLatency(actualizada);
  },
};
