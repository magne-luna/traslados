// Mapeo puro fila<->dominio para el catálogo de prestaciones del paciente
// (presupuesto-prestaciones, design.md D1, tasks.md Fase 2 — PR 1 de la serie encadenada). Sin
// red, sin `any`, sin `as` sobre datos externos, mismo criterio que `pacienteMapping.ts`.
//
// Módulo standalone y por ahora SIN llamador (tasks.md Fase 2/4): `pacienteMapping.ts` y
// `SupabasePacienteRepository.ts` todavía no lo consumen — la migración
// `pacientes.prestaciones` (Fase 3) recién existe como `.sql` sin aplicar, y `Paciente.prestaciones`
// es opcional exactamente por eso (ver `shared/types/paciente.ts`). Queda listo para wirearse en un
// PR posterior una vez que la tabla esté aplicada, sin reescribir esta lógica.

import type { NuevaPrestacion, Prestacion } from '../../types/prestacion';

/** Type guard mínimo sobre `unknown` para filas que llegan de PostgREST — mismo criterio que
 * `pacienteMapping.ts` (`isRecord`), duplicado acá para mantener este módulo standalone (design.md
 * D1: "cero patrón nuevo que revisar", no una dependencia cruzada nueva entre mapeos de dominio). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

/**
 * `pacientes.prestaciones` → `Prestacion` del dominio. Devuelve `null` ante una fila malformada
 * (sin `id`, sin `paciente_id`, o sin `nombre`) en vez de lanzar — mismo criterio de robustez que
 * `parseDireccionRow`/`parsePersonaACargoRow` (`pacienteMapping.ts`). `activa` degrada a `true`
 * ante cualquier valor que no sea booleano explícito — mismo default que la columna
 * (`NOT NULL DEFAULT true`, tasks.md 3.1), nunca se interpreta un dato ausente como "inactiva".
 */
export function parsePrestacionRow(row: unknown): Prestacion | null {
  if (!isRecord(row)) return null;

  const id = readNullableString(row, 'id');
  const pacienteId = readNullableString(row, 'paciente_id');
  const nombre = readNullableString(row, 'nombre');
  if (id === null || pacienteId === null || nombre === null || nombre.trim() === '') return null;

  return {
    id,
    pacienteId,
    nombre,
    descripcion: readOptionalString(row, 'descripcion'),
    activa: typeof row.activa === 'boolean' ? row.activa : true,
  };
}

/** Fila para escribir en `pacientes.prestaciones`. `descripcion` es opcional en el dominio y
 * NULLable en la base — cadena vacía/`undefined` se manda como `null` explícito, mismo criterio
 * que `PersonaACargoRowInput` (`pacienteMapping.ts`, función `vacioANull`). `id` es opcional: un
 * alta nueva no lo manda, un upsert de una prestación existente sí. */
export interface PrestacionRowInput {
  id?: string;
  paciente_id: string;
  nombre: string;
  descripcion: string | null;
  activa: boolean;
}

export function toPrestacionRow(prestacion: Prestacion): PrestacionRowInput {
  return {
    id: prestacion.id,
    paciente_id: prestacion.pacienteId,
    nombre: prestacion.nombre,
    descripcion: prestacion.descripcion?.trim() ? prestacion.descripcion.trim() : null,
    activa: prestacion.activa,
  };
}

/** Colección completa — mismo criterio que `toDireccionRows`. */
export function toPrestacionRows(prestaciones: Prestacion[]): PrestacionRowInput[] {
  return prestaciones.map(toPrestacionRow);
}

/** Payload de alta (sin `id`, lo asigna la base) para un `INSERT` directo. `activa` siempre `true`
 * en una prestación nueva — no tiene sentido dar de alta una ya inactiva. */
export function toNuevaPrestacionRow(nueva: NuevaPrestacion): Omit<PrestacionRowInput, 'id'> {
  return {
    paciente_id: nueva.pacienteId,
    nombre: nueva.nombre,
    descripcion: nueva.descripcion?.trim() ? nueva.descripcion.trim() : null,
    activa: nueva.activa,
  };
}
