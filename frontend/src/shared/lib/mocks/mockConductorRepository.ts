import { generateId } from '../id';
import type { ActualizacionConductor, Conductor, NuevoConductor } from '../../types/conductor';
import type { ConductorRepository } from '../conductores/ConductorRepository';
import { construirFiltroBusqueda, matcheaFiltroBusqueda } from '../paginacion/construirFiltroBusqueda';
import { rangoSupabase } from '../paginacion/rangoSupabase';
import { buildConductoresFixture } from './conductoresFixture';

// Implementación mock de ConductorRepository (design.md Decisión 1): persiste en localStorage
// (no in-memory) porque el maestro de conductores se configura una vez y se espera reencontrar
// entre recargas mientras se prueban las asignaciones semanales y los documentos, que son datos
// acumulados. Cumple la interfaz al pie de la letra para que el reemplazo por
// SupabaseConductorRepository (FE-8) sea mecánico.

const STORAGE_KEY = 'conductores';
// v2: se agregaron `domicilio`/`cuil`/`estado` a Conductor (04_modelo_de_datos.md §Conductor);
// datos persistidos en v1 no tienen `estado`, lo que rompe conductoresDisponibles() en FE-5.
// v3 (integracion-conductores-vehiculos, tasks.md 2C.6, D6-B): `restricciones` y el tipo
// `RestriccionConductor` se eliminan del dominio — el catálogo cerrado no existe en la base, el
// docx modela una única `Notas` de texto libre. La forma de `Conductor` cambia de manera
// incompatible con el payload guardado (`restricciones` ya no es una clave válida); el mismatch
// re-siembra, nunca migra (es un mock, sin dato de producción que preservar).
const SCHEMA_VERSION = 3;

interface StoredPayload {
  schemaVersion: number;
  conductores: Conductor[];
}

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.conductores);
}

function seedFixture(): Conductor[] {
  const seeded = buildConductoresFixture();
  writeStore(seeded);
  return seeded;
}

function readStore(): Conductor[] {
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

  return parsed.conductores;
}

function writeStore(conductores: Conductor[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, conductores };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function withLatency<T>(value: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

// paginacion-listados (design.md §D4/§D9, tasks.md 16.2): mismo criterio de orden que
// SupabaseConductorRepository.listPage — apellido, nombre, y `id` como desempate obligatorio.
function ordenarConductores(conductores: Conductor[]): Conductor[] {
  return [...conductores].sort((a, b) => {
    const porApellido = a.apellido.localeCompare(b.apellido);
    if (porApellido !== 0) return porApellido;
    const porNombre = a.nombre.localeCompare(b.nombre);
    if (porNombre !== 0) return porNombre;
    return a.id.localeCompare(b.id);
  });
}

// Mismas columnas "lógicas" que traduce SupabaseConductorRepository.listPage a `.or()`
// (design.md §D5, búsqueda simple sin checkpoint) — el match real lo hace `matcheaFiltroBusqueda`
// sobre `valoresBuscables`, no sobre estos nombres de columna.
const COLUMNAS_BUSQUEDA_CONDUCTOR = ['apellido', 'nombre', 'dni', 'cuil'] as const;

function valoresBuscables(conductor: Conductor): Array<string | null | undefined> {
  return [conductor.apellido, conductor.nombre, conductor.documento, conductor.cuil];
}

export const mockConductorRepository: ConductorRepository = {
  async list() {
    return withLatency([...readStore()]);
  },

  async listPage({ pagina, tamanio, filtros }) {
    const filtro = construirFiltroBusqueda(filtros.busqueda, COLUMNAS_BUSQUEDA_CONDUCTOR);
    const todos = ordenarConductores(readStore()).filter((conductor) =>
      matcheaFiltroBusqueda(valoresBuscables(conductor), filtro),
    );
    const { desde, hasta } = rangoSupabase({ pagina, tamanio });
    const items = todos.slice(desde, hasta + 1);
    return withLatency({ items, total: todos.length, pagina, tamanio });
  },

  async getById(id) {
    const found = readStore().find((conductor) => conductor.id === id) ?? null;
    return withLatency(found);
  },

  async create(data: NuevoConductor) {
    const nuevo: Conductor = { ...data, id: generateId('conductor') };
    writeStore([...readStore(), nuevo]);
    return withLatency(nuevo);
  },

  async update(id, data: ActualizacionConductor) {
    const current = readStore();
    const index = current.findIndex((conductor) => conductor.id === id);
    const existing = index === -1 ? undefined : current[index];
    if (!existing) {
      throw new Error(`No existe un conductor con id "${id}".`);
    }

    const actualizado: Conductor = { ...existing, ...data, id };
    const next = [...current];
    next[index] = actualizado;
    writeStore(next);
    return withLatency(actualizado);
  },
};
