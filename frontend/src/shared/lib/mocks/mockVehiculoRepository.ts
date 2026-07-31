import { generateId } from '../id';
import type { ActualizacionVehiculo, NuevoVehiculo, Vehiculo } from '../../types/vehiculo';
import { derivarHabilitaciones } from '../mantenimiento/derivarHabilitaciones';
import type { VehiculoRepository } from '../vehiculos/VehiculoRepository';
import { buildVehiculosFixture } from './vehiculosFixture';

// Implementación mock de VehiculoRepository (design.md Decisión 1): persiste en localStorage
// (no in-memory) porque la flota es un maestro que la administradora configura una vez y espera
// reencontrar entre recargas mientras prueba kilometraje/gastos/documentos. Cumple la interfaz
// al pie de la letra para que el reemplazo por SupabaseVehiculoRepository (FE-8) sea mecánico.

const STORAGE_KEY = 'vehiculos';
// v2: GastoVehiculo sumó `categoria` (obligatorio) — bump para descartar localStorage con gastos
// del esquema viejo (sin esa propiedad), que rompía <Chip> al buscar un kind inexistente.
// v3 (vehiculo-mantenimiento-registro, design.md Decisión 1/8): GastoVehiculo.categoria se
// eliminó (los valores eran inventados, sin fuente en el docx) y Vehiculo sumó
// `mantenimientos: MantenimientoRegistro[]`. Los gastos guardados en localStorage con `categoria`
// ya no matchean el tipo actual (`<Chip>` volvería a romper buscando un kind inexistente) y
// ningún vehículo guardado tiene `mantenimientos`. Re-seed, no migración de payload (es un mock,
// sin dato de producción que preservar).
// v4 (integracion-conductores-vehiculos, tasks.md 2.3 y 2B.4, dos motivos):
//   1. Vehiculo sumó `notas?: string` (C-08, columna `conductores.vehiculo.notas` que nacía NULL
//      para siempre). Los vehículos guardados en localStorage con schemaVersion 3 no tienen esa
//      clave — no rompen nada al leerse (es opcional), pero el fixture nuevo la ejercita a
//      propósito y conviene re-sembrar para verla en el navegador sin borrar manualmente.
//   2. D3-B: `Vehiculo.habilitaciones` pasa a derivarse de `mantenimientos` (ver
//      `derivarHabilitaciones` en `shared/lib/mantenimiento/`). El fixture reescribe sus
//      habilitaciones para que cada una tenga su fila de mantenimiento `preventivo` + `vtv`/`rto`
//      correspondiente — un payload viejo sin esa correspondencia mostraría habilitaciones que ya
//      no coinciden con lo que la derivación calcularía, una divergencia invisible entre mock y
//      real. Re-seed, no migración de payload (es un mock, sin dato de producción que preservar).
const SCHEMA_VERSION = 4;

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

// D3-B (tasks.md 2B.2, design.md D3 opción B): `habilitaciones` deja de ser una colección
// persistida — se deriva de `mantenimientos` en cada lectura, igual que hará
// `SupabaseVehiculoRepository` (4.7) en `ensamblarVehiculo`. Lo que haya quedado escrito bajo la
// clave `habilitaciones` (en `localStorage` o en un payload de escritura) se ignora: es un campo
// de salida, nunca de entrada.
function conHabilitacionesDerivadas(vehiculo: Vehiculo): Vehiculo {
  return { ...vehiculo, habilitaciones: derivarHabilitaciones(vehiculo.mantenimientos) };
}

export const mockVehiculoRepository: VehiculoRepository = {
  async list() {
    return withLatency(readStore().map(conHabilitacionesDerivadas));
  },

  async getById(id) {
    const found = readStore().find((vehiculo) => vehiculo.id === id) ?? null;
    return withLatency(found ? conHabilitacionesDerivadas(found) : null);
  },

  async create(data: NuevoVehiculo) {
    const nuevo: Vehiculo = { ...data, id: generateId('vehiculo') };
    writeStore([...readStore(), nuevo]);
    return withLatency(conHabilitacionesDerivadas(nuevo));
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
    return withLatency(conHabilitacionesDerivadas(actualizado));
  },
};
