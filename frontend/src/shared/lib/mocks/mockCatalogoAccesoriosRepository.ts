import { generateId } from '../id';
import type { AccesorioCatalogo } from '../../types/catalogoAccesorios';
import type { CambiosAccesorio, CatalogoAccesoriosRepository } from '../accesorios/CatalogoAccesoriosRepository';

// Implementación mock de CatalogoAccesoriosRepository (design.md D5): persiste en localStorage
// como el resto de los mocks del repo. Arranca con el mismo seed que la base real
// (`20260729140000_seed_accesorios.sql`: 5 valores, keys de icono = tipo, activos).

const STORAGE_KEY = 'catalogo-accesorios';
const SCHEMA_VERSION = 1;

interface StoredPayload {
  schemaVersion: number;
  accesorios: AccesorioCatalogo[];
}

const SEED: AccesorioCatalogo[] = [
  { id: 'seed-silla-plegable', tipo: 'silla-plegable', icono: 'silla-plegable', activa: true },
  { id: 'seed-silla-rigida', tipo: 'silla-rigida', icono: 'silla-rigida', activa: true },
  { id: 'seed-silla-postural', tipo: 'silla-postural', icono: 'silla-postural', activa: true },
  { id: 'seed-andador', tipo: 'andador', icono: 'andador', activa: true },
  { id: 'seed-tripode', tipo: 'tripode', icono: 'tripode', activa: true },
];

function isStoredPayload(value: unknown): value is StoredPayload {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.schemaVersion === 'number' && Array.isArray(candidate.accesorios);
}

function seedFixture(): AccesorioCatalogo[] {
  writeStore(SEED);
  return [...SEED];
}

function readStore(): AccesorioCatalogo[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === null) return seedFixture();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return seedFixture();
  }

  if (!isStoredPayload(parsed) || parsed.schemaVersion !== SCHEMA_VERSION) {
    return seedFixture();
  }

  return parsed.accesorios;
}

function writeStore(accesorios: AccesorioCatalogo[]): void {
  const payload: StoredPayload = { schemaVersion: SCHEMA_VERSION, accesorios };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function buscarONada(accesorios: AccesorioCatalogo[], id: string): AccesorioCatalogo | undefined {
  return accesorios.find((a) => a.id === id);
}

export const mockCatalogoAccesoriosRepository: CatalogoAccesoriosRepository = {
  async listarActivos(): Promise<AccesorioCatalogo[]> {
    const todos = readStore();
    return todos
      .filter((a) => a.activa)
      .sort((a, b) => a.tipo.localeCompare(b.tipo));
  },

  async listarTodos(): Promise<AccesorioCatalogo[]> {
    const todos = readStore();
    return [...todos].sort((a, b) => a.tipo.localeCompare(b.tipo));
  },

  async crear(tipo: string, icono: string): Promise<AccesorioCatalogo> {
    const todos = readStore();
    const normalizado = tipo.trim().replace(/\s+/g, ' ');
    if (todos.some((a) => a.tipo === normalizado)) {
      throw new Error(`Ya existe un accesorio llamado «${normalizado}».`);
    }
    const nuevo: AccesorioCatalogo = { id: generateId('accesorio'), tipo: normalizado, icono, activa: true };
    writeStore([...todos, nuevo]);
    return nuevo;
  },

  async editar(id: string, cambios: CambiosAccesorio): Promise<AccesorioCatalogo> {
    const todos = readStore();
    const existente = buscarONada(todos, id);
    if (!existente) throw new Error('No existe ese accesorio en el catálogo.');
    const conTipo = cambios.tipo !== undefined ? cambios.tipo.trim().replace(/\s+/g, ' ') : existente.tipo;
    if (todos.some((a) => a.id !== id && a.tipo === conTipo)) {
      throw new Error(`Ya existe un accesorio llamado «${conTipo}».`);
    }
    const actualizado: AccesorioCatalogo = {
      ...existente,
      tipo: conTipo,
      icono: cambios.icono ?? existente.icono,
    };
    writeStore(todos.map((a) => (a.id === id ? actualizado : a)));
    return actualizado;
  },

  async desactivar(id: string): Promise<void> {
    const todos = readStore();
    if (!buscarONada(todos, id)) throw new Error('No existe ese accesorio en el catálogo.');
    writeStore(todos.map((a) => (a.id === id ? { ...a, activa: false } : a)));
  },

  async reactivar(id: string): Promise<void> {
    const todos = readStore();
    if (!buscarONada(todos, id)) throw new Error('No existe ese accesorio en el catálogo.');
    writeStore(todos.map((a) => (a.id === id ? { ...a, activa: true } : a)));
  },
};