import { generateId } from '../id';
import type { ActualizacionPaciente, NuevoPaciente, Paciente } from '../../types/paciente';
import type { PacienteRepository } from '../pacientes/PacienteRepository';
import { construirFiltroBusqueda, matcheaFiltroBusqueda } from '../paginacion/construirFiltroBusqueda';
import { rangoSupabase } from '../paginacion/rangoSupabase';
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

// paginacion-listados (design.md §D9, tasks.md 11.4/12.3): mismo criterio de orden que
// SupabasePacienteRepository.listPage — apellido, nombre, y `id` como desempate obligatorio (sin
// desempate, dos pacientes con mismo apellido+nombre podrían "flotar" de posición entre llamadas).
function ordenarPacientes(pacientes: Paciente[]): Paciente[] {
  return [...pacientes].sort((a, b) => {
    const porApellido = a.apellido.localeCompare(b.apellido);
    if (porApellido !== 0) return porApellido;
    const porNombre = a.nombre.localeCompare(b.nombre);
    if (porNombre !== 0) return porNombre;
    return a.id.localeCompare(b.id);
  });
}

// Mismas columnas "lógicas" que traduce SupabasePacienteRepository.listPage a `.or()` (design.md
// §D5/CHECKPOINT 1) — acá solo importan para pasarlas a `construirFiltroBusqueda` (que las usa
// para armar `expresionesOr`, sin consumidor en el mock); el match real lo hace
// `matcheaFiltroBusqueda` sobre `valoresBuscables`, no sobre estos nombres de columna.
const COLUMNAS_BUSQUEDA_PACIENTE = ['nombre_a', 'nombre_b', 'apellido_a', 'apellido_b', 'dni'] as const;

function valoresBuscables(paciente: Paciente): Array<string | null | undefined> {
  return [paciente.nombre, paciente.segundoNombre, paciente.apellido, paciente.segundoApellido, paciente.dni];
}

export const mockPacienteRepository: PacienteRepository = {
  // select-liviano-selectores: el mock guarda pacientes completos, y `Paciente` es asignable a
  // `PacienteResumen` (es un Pick), así que la misma lectura sirve para las dos firmas. El ahorro
  // real está en el repository de Supabase, que es donde se recorta el tráfico.
  async listCompleto(): Promise<Paciente[]> {
    return ordenarPacientes(readStore());
  },
  async list() {
    return withLatency([...readStore()]);
  },

  async listPage({ pagina, tamanio, filtros }) {
    const filtro = construirFiltroBusqueda(filtros.busqueda, COLUMNAS_BUSQUEDA_PACIENTE);
    const todos = ordenarPacientes(readStore()).filter((paciente) =>
      matcheaFiltroBusqueda(valoresBuscables(paciente), filtro),
    );
    const { desde, hasta } = rangoSupabase({ pagina, tamanio });
    const items = todos.slice(desde, hasta + 1);
    return withLatency({ items, total: todos.length, pagina, tamanio });
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
