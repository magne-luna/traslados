// Mapeo puro fila<->dominio para Pacientes (design.md Decisión 1 de
// openspec/changes/integracion-pacientes/). Funciones exportadas, sin red, sin `any`. Cubre las 11
// discrepancias de la tabla D9 entre `docs/core/Traslados-Modelo-Datos.docx` (tipos de
// `shared/types/paciente.ts`) y `supabase/migrations/20260724100004_schema_pacientes.sql` (columnas
// reales). `SupabasePacienteRepository.ts` (sección 3 del change) es la única capa de I/O; acá solo
// se traduce.

import type {
  Cud,
  Direccion,
  NuevoPaciente,
  Paciente,
  PersonaACargo,
  TipoDireccion,
} from '../../types/paciente';
import type { AccesorioMovilidad } from '../../types/vehiculo';

const TIPOS_DIRECCION_VALIDOS = new Set<TipoDireccion>(['domicilio', 'escuela', 'terapia', 'ciset', 'otro']);

function parseTipoDireccion(value: unknown): TipoDireccion {
  return typeof value === 'string' && TIPOS_DIRECCION_VALIDOS.has(value as TipoDireccion)
    ? (value as TipoDireccion)
    : 'otro';
}

/** Type guard mínimo sobre `unknown` para filas que llegan de PostgREST. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function readNullableString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' ? value : null;
}

/** Campos base de `pacientes.paciente` mapeados al dominio (discrepancia #10 de D9: nullabilidad
 * invertida en `fecha_nacimiento`/`cuil_titular` — `NULL` en la base se traduce a `''`, nunca se
 * lanza ni se descarta el paciente). */
export interface PacienteCamposBase {
  id: string;
  nombre: string;
  segundoNombre?: string;
  apellido: string;
  segundoApellido?: string;
  fechaNacimiento: string;
  dni: string;
  cuilTitular: string;
  obraSocialId: string | null;
  amparoJudicial: boolean;
}

export function parsePacienteRow(row: unknown): PacienteCamposBase {
  if (!isRecord(row)) {
    return {
      id: '',
      nombre: '',
      apellido: '',
      fechaNacimiento: '',
      dni: '',
      cuilTitular: '',
      obraSocialId: null,
      amparoJudicial: false,
    };
  }

  return {
    id: readString(row, 'id'),
    nombre: readString(row, 'nombre_a'),
    segundoNombre: readOptionalString(row, 'nombre_b'),
    apellido: readString(row, 'apellido_a'),
    segundoApellido: readOptionalString(row, 'apellido_b'),
    // Discrepancia #10 (D9): NULL -> '' sin lanzar.
    fechaNacimiento: readNullableString(row, 'fecha_nacimiento') ?? '',
    dni: readString(row, 'dni'),
    // Discrepancia #10 (D9): NULL -> '' sin lanzar.
    cuilTitular: readNullableString(row, 'cuil_titular') ?? '',
    obraSocialId: readNullableString(row, 'obra_social_id'),
    amparoJudicial: typeof row.amparo_judicial === 'boolean' ? row.amparo_judicial : false,
  };
}

/** Datos clínicos de `pacientes.clinicos` (1:1 vía UNIQUE(paciente_id)). Discrepancia #7 (D9):
 * `diagnostico JSONB` en la base vs. `diagnostico: string` en el dominio. */
export interface PacienteDatosClinicos {
  diagnostico: string;
  condicion?: string;
}

/** Normaliza el JSONB de `diagnostico` a `string`, tolerando las tres formas que puede tomar:
 * cadena JSON, objeto `{ texto }`, o `NULL` (discrepancia #7 de D9). Nunca lanza. */
function normalizarDiagnostico(value: unknown): string {
  if (typeof value === 'string') return value;
  if (isRecord(value) && typeof value.texto === 'string') return value.texto;
  return '';
}

export function parseClinicosRow(row: unknown): PacienteDatosClinicos {
  if (!isRecord(row)) return { diagnostico: '' };

  return {
    diagnostico: normalizarDiagnostico(row.diagnostico),
    condicion: readOptionalString(row, 'condicion'),
  };
}

function parseCudRowUnica(row: Record<string, unknown>): Cud | null {
  const numeroCud = row.numero_cud;
  if (typeof numeroCud !== 'string') return null;

  return {
    numero: numeroCud,
    fechaEmision: readNullableString(row, 'emision') ?? '',
    fechaVencimiento: readNullableString(row, 'vencimiento') ?? '',
  };
}

/** `pacientes.cud` es 1:N pero el dominio modela `Cud | null` (discrepancia #9 de D9): se elige la
 * fila de `vencimiento` más reciente. La columna `vigente` se ignora deliberadamente — es un
 * derivado que el frontend recalcula con `estadoCud`, no una fuente de verdad distinta. Filas
 * malformadas (sin `numero_cud`) se descartan sin romper la selección (robustez, tarea 2.10). */
export function parseCudRow(rows: unknown): Cud | null {
  if (!Array.isArray(rows)) return null;

  const candidatos = rows
    .map((row) => (isRecord(row) ? parseCudRowUnica(row) : null))
    .filter((cud): cud is Cud => cud !== null);

  if (candidatos.length === 0) return null;

  return candidatos.reduce((masReciente, actual) =>
    actual.fechaVencimiento > masReciente.fechaVencimiento ? actual : masReciente,
  );
}

/** `pacientes.direcciones` → `Direccion` del dominio. Discrepancias #3/#4/#5 (D9): `calle` +
 * `numero` se combinan en un único campo al leer (no se inventa un desglose); `localidad`, `dias`
 * y `horario` no tienen columna y quedan vacíos/`undefined`. Devuelve `null` ante una fila
 * malformada (sin `calle`) en vez de lanzar — la robustez de la colección la maneja quien la
 * invoque (`ensamblarPaciente`, tarea 2.10). */
export function parseDireccionRow(row: unknown): Direccion | null {
  if (!isRecord(row)) return null;
  const calleBase = readNullableString(row, 'calle');
  const id = readNullableString(row, 'id');
  if (calleBase === null || id === null) return null;

  const numero = readNullableString(row, 'numero');
  const calle = numero && numero.trim() !== '' ? `${calleBase} ${numero}`.trim() : calleBase;

  return {
    id,
    tipo: parseTipoDireccion(row.tipo_lugar),
    calle,
    // Discrepancias #3/#4 (D9): sin columna en la base.
    localidad: '',
  };
}

/** Fila para escribir en `pacientes.direcciones`. `numero` siempre `null` (discrepancia #5, D9):
 * no se inventa un parseo de la altura desde `calle`. */
export interface DireccionRowInput {
  id?: string;
  calle: string;
  numero: null;
  tipo_lugar: TipoDireccion;
}

export function toDireccionRows(direcciones: Direccion[]): DireccionRowInput[] {
  return direcciones.map((direccion) => ({
    id: direccion.id,
    calle: direccion.calle,
    numero: null,
    tipo_lugar: direccion.tipo,
  }));
}

/** `pacientes.personas_a_cargo` → `PersonaACargo` del dominio. Discrepancia #10 (D9): `dni` es
 * NULLable en la base pero requerido en el dominio — `NULL` → `''` sin lanzar. Devuelve `null`
 * ante una fila malformada (sin `nombre`/`apellido`), igual criterio que `parseDireccionRow`. */
export function parsePersonaACargoRow(row: unknown): PersonaACargo | null {
  if (!isRecord(row)) return null;
  const id = readNullableString(row, 'id');
  const nombre = readNullableString(row, 'nombre');
  const apellido = readNullableString(row, 'apellido');
  if (id === null || nombre === null || apellido === null) return null;

  return {
    id,
    nombre,
    apellido,
    // Discrepancia #10 (D9): NULL -> '' sin lanzar.
    dni: readNullableString(row, 'dni') ?? '',
    telefono: readOptionalString(row, 'telefono'),
    telefonoAlternativo: readOptionalString(row, 'telefono_alternativo'),
  };
}

/** Fila para escribir en `pacientes.personas_a_cargo`. Inverso de la discrepancia #10: una cadena
 * vacía en el dominio se escribe como `NULL` (la columna es NULLable; no tiene sentido persistir
 * `''` cuando la base ya modela "sin dato" como `NULL`). */
export interface PersonaACargoRowInput {
  id?: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  telefono: string | null;
  telefono_alternativo: string | null;
}

function vacioANull(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

export function toPersonaACargoRows(personas: PersonaACargo[]): PersonaACargoRowInput[] {
  return personas.map((persona) => ({
    id: persona.id,
    nombre: persona.nombre,
    apellido: persona.apellido,
    dni: vacioANull(persona.dni),
    telefono: vacioANull(persona.telefono),
    telefono_alternativo: vacioANull(persona.telefonoAlternativo),
  }));
}

const ACCESORIOS_VALIDOS = new Set<AccesorioMovilidad>([
  'silla-plegable',
  'silla-rigida',
  'silla-postural',
  'andador',
  'tripode',
]);

/** `accesorios_pacientes ( accesorios ( tipo ) )` embebido (D2) → `AccesorioMovilidad[]`.
 * Discrepancia #11 (D9): `pacientes.accesorios.tipo` es `TEXT` libre y el dominio modela una
 * unión cerrada; los `tipo` desconocidos se descartan en silencio, se conserva el resto. Nunca
 * lanza ante filas malformadas (robustez, tarea 2.10). */
export function parseAccesorios(rows: unknown): AccesorioMovilidad[] {
  if (!Array.isArray(rows)) return [];

  const tipos: AccesorioMovilidad[] = [];
  for (const row of rows) {
    if (!isRecord(row) || !isRecord(row.accesorios)) continue;
    const tipo = row.accesorios.tipo;
    if (typeof tipo === 'string' && ACCESORIOS_VALIDOS.has(tipo as AccesorioMovilidad)) {
      tipos.push(tipo as AccesorioMovilidad);
    }
  }
  return tipos;
}

/** `obra_social.coberturas_paciente` → `{ valor }` del número de afiliado (D3). Ausencia de fila
 * (0 filas, error de la consulta, o `null`/`undefined`) degrada a `valor: ''` sin lanzar — el
 * repository decide *por qué* no hay fila (0 filas vs. RLS), acá solo se normaliza el resultado. */
export function parseCoberturaRow(row: unknown): { valor: string } {
  if (!isRecord(row)) return { valor: '' };
  return { valor: readNullableString(row, 'num_afiliado') ?? '' };
}

/** Combina la fila con embeds de `pacientes.paciente` (D2) más la fila de cobertura (D3, segunda
 * consulta a otro schema) en un `Paciente` completo. Filas hijas malformadas se descartan en
 * silencio (tarea 2.10) sin romper el paciente. `coberturaRow === null` degrada `numeroAfiliado` a
 * `{ valor: '' }` (discrepancia #1 de D9) — el formato ya no viaja acá, se deriva de
 * `ObraSocial.formatoAfiliado` (RN-ID-02, IN-01). */
export function ensamblarPaciente(row: unknown, coberturaRow: unknown): Paciente {
  const base = parsePacienteRow(row);
  const record = isRecord(row) ? row : {};
  const clinicos = parseClinicosRow(record.clinicos);
  const cud = parseCudRow(record.cud);
  const cobertura = parseCoberturaRow(coberturaRow);

  const direccionesRaw = Array.isArray(record.direcciones) ? record.direcciones : [];
  const direcciones = direccionesRaw
    .map((d) => parseDireccionRow(d))
    .filter((d): d is Direccion => d !== null);

  const personasRaw = Array.isArray(record.personas_a_cargo) ? record.personas_a_cargo : [];
  const personasACargo = personasRaw
    .map((p) => parsePersonaACargoRow(p))
    .filter((p): p is PersonaACargo => p !== null);

  return {
    id: base.id,
    nombre: base.nombre,
    segundoNombre: base.segundoNombre,
    apellido: base.apellido,
    segundoApellido: base.segundoApellido,
    fechaNacimiento: base.fechaNacimiento,
    dni: base.dni,
    cuilTitular: base.cuilTitular,
    diagnostico: clinicos.diagnostico,
    condicion: clinicos.condicion,
    accesorioMovilidad: parseAccesorios(record.accesorios_pacientes),
    obraSocialId: base.obraSocialId,
    // Discrepancia #1 (D9, D3 CONFIRMADA): el formato ya no vive en el paciente (RN-ID-02,
    // IN-01) — se deriva de `ObraSocial.formatoAfiliado`. La lectura degradable de `valor` ya
    // viene resuelta en `parseCoberturaRow`.
    numeroAfiliado: { valor: cobertura.valor },
    cud,
    direcciones,
    personasACargo,
    amparoJudicial: base.amparoJudicial,
    amparoJudicialAclaracion: undefined,
  };
}

/** Argumento `p_paciente jsonb` de `pacientes.crear_paciente_completo` (D4). Espeja exactamente
 * las claves que lee `20260730180000_crear_paciente_completo.sql` (sus `->>`/`->`) — nunca agrega
 * una clave que la migración no consuma. Discrepancias #1 (`formato`), #3/#4 (`localidad`/`dias`/
 * `horario` de direcciones) y #6 (`domicilio`) NO viajan (D9): son datos que el usuario ve en
 * pantalla pero el esquema real no persiste. La mayoría de los campos de texto se pasan tal cual
 * (incluso `''`) porque la migración ya hace `NULLIF(..., '')` de su lado — duplicar esa decisión
 * acá sería un segundo criterio para la misma regla. */
export interface CrearPacientePayload {
  nombre_a: string;
  nombre_b: string | null;
  apellido_a: string;
  apellido_b: string | null;
  fecha_nacimiento: string;
  dni: string;
  cuil_titular: string;
  obra_social_id: string | null;
  amparo_judicial: boolean;
  clinicos: { diagnostico: string; condicion: string | null };
  cud: { numero_cud: string; emision: string; vencimiento: string } | null;
  direcciones: DireccionRowInput[];
  personas_a_cargo: PersonaACargoRowInput[];
  accesorios: AccesorioMovilidad[];
  num_afiliado: string;
}

export function toCrearPacientePayload(nuevo: NuevoPaciente): CrearPacientePayload {
  return {
    nombre_a: nuevo.nombre,
    nombre_b: nuevo.segundoNombre ?? null,
    apellido_a: nuevo.apellido,
    apellido_b: nuevo.segundoApellido ?? null,
    fecha_nacimiento: nuevo.fechaNacimiento,
    dni: nuevo.dni,
    cuil_titular: nuevo.cuilTitular,
    obra_social_id: nuevo.obraSocialId,
    amparo_judicial: nuevo.amparoJudicial,
    clinicos: { diagnostico: nuevo.diagnostico, condicion: nuevo.condicion ?? null },
    cud: nuevo.cud
      ? {
          numero_cud: nuevo.cud.numero,
          emision: nuevo.cud.fechaEmision,
          vencimiento: nuevo.cud.fechaVencimiento,
        }
      : null,
    // Discrepancias #3/#4/#6 (D9): toDireccionRows ya excluye localidad/dias/horario/domicilio —
    // no hay clave que omitir acá, nunca existió.
    direcciones: toDireccionRows(nuevo.direcciones),
    personas_a_cargo: toPersonaACargoRows(nuevo.personasACargo),
    accesorios: nuevo.accesorioMovilidad,
    // Discrepancia #1 (D9): solo viaja `valor` — el formato ya no es un campo del paciente
    // (RN-ID-02, IN-01 resuelta): se deriva de `ObraSocial.formatoAfiliado`, no se envía acá.
    num_afiliado: nuevo.numeroAfiliado.valor,
  };
}
