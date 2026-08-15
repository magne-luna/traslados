import type { DiaSemana, NuevoRecorridoHabitual, RecorridoHabitual } from '../../types/recorridoHabitual';

// Mapeo puro fila<->dominio de "Destinos habituales" (RF-110, `pacientes.recorridos`). Sin red,
// sin `any`, sin `as` sobre datos externos — solo `SupabaseRecorridoHabitualRepository.ts` hace
// I/O, acá se traduce (mismo criterio que facturaMapping.ts).

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

const DIAS_SEMANA_VALIDOS = new Set<DiaSemana>([
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
]);
const DEFAULT_DIA_SEMANA: DiaSemana = 'lunes';

// `pacientes.recorridos.dia_semana` es `text` SIN CHECK constraint en la base (RF-110, ver
// comentario de recorridoHabitual.ts): la unión cerrada la impone este parser, no la columna. Un
// valor fuera de los 7 literales conocidos (dato corrupto/legacy) cae al default documentado en
// vez de lanzar — mismo criterio de totalidad que `parseTipoComprobante` en facturaMapping.ts.
function parseDiaSemana(value: unknown): DiaSemana {
  if (typeof value === 'string') {
    for (const dia of DIAS_SEMANA_VALIDOS) {
      if (dia === value) return dia;
    }
  }
  return DEFAULT_DIA_SEMANA;
}

// La columna real es `time` (Postgres) y PostgREST la serializa como 'HH:MM:SS' (o con fracción
// de segundos) — el dominio usa 'HH:MM' (mismo criterio que `horaEstimada` en hojaDeRuta.ts), así
// que se recorta todo lo que exceda 'HH:MM' en vez de propagar el segundero al formulario.
function parseHora(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.slice(0, 5);
}

/** Fila de `pacientes.recorridos` -> `RecorridoHabitual` del dominio. Nunca lanza: una fila
 * parcial o corrupta se lee como un destino habitual incompleto pero coherente. */
export function parseRecorridoHabitualRow(row: unknown): RecorridoHabitual {
  const record = isRecord(row) ? row : {};

  return {
    id: readString(record, 'id'),
    pacienteId: readString(record, 'paciente_id'),
    direccionInicialId: readString(record, 'id_dir_inicial'),
    direccionFinalId: readString(record, 'id_dir_final'),
    diaSemana: parseDiaSemana(record.dia_semana),
    hora: parseHora(record.hora),
  };
}

/** `NuevoRecorridoHabitual` del dominio -> payload snake_case para `.insert()`, sin `id` (lo
 * asigna la base). */
export function toCrearRecorridoHabitualPayload(data: NuevoRecorridoHabitual): Record<string, unknown> {
  return {
    paciente_id: data.pacienteId,
    id_dir_inicial: data.direccionInicialId,
    id_dir_final: data.direccionFinalId,
    dia_semana: data.diaSemana,
    hora: data.hora,
  };
}
