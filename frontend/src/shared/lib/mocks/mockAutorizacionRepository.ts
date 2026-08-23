import { generateId } from '../id';
import type { ActualizacionAutorizacion, ArchivoAdjunto, Autorizacion, NuevaAutorizacion } from '../../types/presupuesto';
import type { AutorizacionRepository } from '../presupuestos/AutorizacionRepository';
import { buildAutorizacionesFixture } from './autorizacionesFixture';

// Implementación mock de AutorizacionRepository (design.md Decisión 1 y 2): persiste en
// localStorage, entidad separada de Presupuesto referenciada por `presupuestoId`. Cumple la
// interfaz al pie de la letra para que el reemplazo por SupabaseAutorizacionRepository (FE-8) sea
// mecánico — mismo patrón que mockPresupuestoRepository.

const STORAGE_KEY = 'autorizaciones';
// v1 -> v2 (autorizacion-mensual design.md D1/D5, tasks.md Fase 4): `Autorizacion` suma
// `periodoMes?` (Fase 3, design.md D2/D3) y la cardinalidad por presupuesto pasa de 1:1 a 1:N. Un
// payload viejo en localStorage con `schemaVersion: 1` no tiene por qué tener `periodoMes` en sus
// filas y modela "una autorización por presupuesto" — se descarta y se resiembra (regla de
// `openspec/config.yaml` §apply.guidelines), mismo criterio que `mockObraSocialRepository` en
// `integracion-obra-social` D9.
const SCHEMA_VERSION = 2;

// getUrlArchivo() (presupuestos-vigencia-datos-traslado-vista-previa, tasks.md 7.4, design.md
// D6b): mismo criterio que `archivoPorDocumentoId` de `mockDocumentoRepository.ts` — el `File` NO
// se serializa en `localStorage` junto con `Autorizacion` (no sobreviviría un `JSON.stringify`, y
// tampoco tendría sentido: es contenido de sesión, no un dato de dominio). Vive en memoria pura,
// una entrada por autorización (a diferencia del otro mock, que es N por entidad — acá el docx
// modela un solo archivo por autorización, Decisión 3).
const archivoPorAutorizacionId = new Map<string, File>();

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

  async listByPresupuestoId(presupuestoId, periodoMes) {
    const coincidencias = readStore().filter((autorizacion) => {
      if (autorizacion.presupuestoId !== presupuestoId) return false;
      if (periodoMes !== undefined && autorizacion.periodoMes !== periodoMes) return false;
      return true;
    });

    // Mismo orden que la Edge Function real (design.md D5): legacy (`periodoMes === undefined`)
    // primero, después ascendente por mes — para que el mock sea intercambiable sin sorpresas de
    // orden (FE-8).
    const ordenadas = [...coincidencias].sort((a, b) => {
      if (a.periodoMes === b.periodoMes) return 0;
      if (a.periodoMes === undefined) return -1;
      if (b.periodoMes === undefined) return 1;
      return a.periodoMes.localeCompare(b.periodoMes);
    });

    return withLatency(ordenadas);
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
      // tasks.md 7.4 (D6c, mismo criterio que SupabaseAutorizacionRepository.subirArchivoAutorizacion
      // / tasks.md 7.3): se persiste desde `File.type`, el dato exacto, no inferido.
      tipoMime: file.type || undefined,
    };

    const actualizada: Autorizacion = { ...existing, archivo, id };
    const next = [...current];
    next[index] = actualizada;
    writeStore(next);
    // getUrlArchivo() (tasks.md 7.4): guarda el `File` real para poder crear un ObjectURL bajo
    // demanda — mismo criterio que `mockDocumentoRepository`. Reemplaza cualquier `File` anterior
    // de esta autorización (reemplazo, un solo archivo por autorización).
    archivoPorAutorizacionId.set(id, file);
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
    archivoPorAutorizacionId.delete(id);
    return withLatency(actualizada);
  },

  // getUrlArchivo() (tasks.md 7.4, design.md D6b): crea un ObjectURL NUEVO en cada llamada, nunca
  // reutiliza uno viejo (mismo criterio que `mockDocumentoRepository.resolverPrevisualizacion`,
  // corrección 2026-08-06 documentada ahí). `null` sin lanzar cuando la autorización no existe o
  // no tiene archivo. **Sin distinción real entre `'inline'`/`'descarga'`**: una `blob:` URL es
  // same-origin y el atributo `download` del `<a>` que la consuma SÍ la respeta en ambos casos
  // (a diferencia del cross-origin real de Storage, que es justo el problema que D6b resuelve) —
  // el mock no puede simular `Content-Disposition`, así que ambos modos devuelven la misma clase
  // de URL. El contrato de la interfaz (dos modos explícitos) se cumple igual, para que el swap a
  // `SupabaseAutorizacionRepository` (FE-8) sea mecánico.
  async getUrlArchivo(id, _modo) {
    const encontrada = readStore().find((autorizacion) => autorizacion.id === id);
    if (!encontrada?.archivo) return withLatency(null);
    const file = archivoPorAutorizacionId.get(id);
    return withLatency(file ? URL.createObjectURL(file) : null);
  },
};
