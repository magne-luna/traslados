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
  Parentesco,
  PersonaACargo,
  TipoDireccion,
} from '../../types/paciente';
import type { AccesorioMovilidad } from '../../types/vehiculo';
// `Coordenada` vive en hojaDeRuta.ts (no en paciente.ts) — no hay ciclo: paciente.ts nunca importa
// de hojaDeRuta.ts, es al revés. Se reusa acá en vez de duplicar `{ lat, lng }` porque es la misma
// forma que consume `ParadaRecorrido.coordenadaOrigen` (change hojas-de-ruta-geocoding, RF-701).
import type { Coordenada } from '../../types/hojaDeRuta';

const TIPOS_DIRECCION_VALIDOS = new Set<TipoDireccion>(['domicilio', 'escuela', 'terapia', 'cet', 'otro']);

function parseTipoDireccion(value: unknown): TipoDireccion {
  return typeof value === 'string' && TIPOS_DIRECCION_VALIDOS.has(value as TipoDireccion)
    ? (value as TipoDireccion)
    : 'otro';
}

const PARENTESCOS_VALIDOS = new Set<Parentesco>(['padre', 'madre', 'tutor_legal', 'otro']);

/** `NULL`/valor desconocido -> `'otro'`, mismo criterio de robustez que `parseTipoDireccion` —
 * nunca lanza ante una fila con un `parentesco` que no está en la unión cerrada. */
function parseParentesco(value: unknown): Parentesco {
  return typeof value === 'string' && PARENTESCOS_VALIDOS.has(value as Parentesco) ? (value as Parentesco) : 'otro';
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

/** `pacientes.direcciones` → `Direccion` del dominio. Discrepancias #4/#5 (D9): `calle` +
 * `numero` se combinan en un único campo al leer (no se inventa un desglose); `dias` y `horario`
 * no tienen columna y quedan `undefined` (viven en `pacientes.recorridos`). `localidad` sí tiene
 * columna propia (`NOT NULL` desde `20260729120000_schema_pacientes_gaps.sql`, cerrando la
 * discrepancia #3) — se lee directo. Devuelve `null` ante una fila malformada (sin `calle`) en vez
 * de lanzar — la robustez de la colección la maneja quien la invoque (`ensamblarPaciente`, tarea
 * 2.10). */
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
    localidad: readNullableString(row, 'localidad') ?? '',
    descripcion: readOptionalString(row, 'descripcion'),
  };
}

/** Fila para escribir en `pacientes.direcciones`. `numero` siempre `null` (discrepancia #5, D9):
 * no se inventa un parseo de la altura desde `calle`. `localidad` es `NOT NULL` en la base — hay
 * que mandarla siempre. `descripcion` es opcional en el dominio y NULLable en la base (misma
 * discrepancia que `Parentesco`) — `undefined`/string vacío se manda como `null`.
 *
 * `lat`/`lng` (change hojas-de-ruta-geocoding, RF-701, columnas nuevas aditivas de
 * `20260805140000_direcciones_geocoding.sql`) son OPCIONALES a propósito, no solo nullable: la
 * clave debe poder faltar del todo en el objeto, no solo valer `null`. En un `upsert` de Supabase,
 * una clave presente con `null` SÍ pisa la columna existente; una clave AUSENTE no la toca. Eso es
 * lo que permite no re-geocodificar una dirección sin cambios (`direccionesACambiar`) sin perder
 * sus coordenadas ya guardadas — ver `SupabasePacienteRepository.geocodificarDirecciones`. */
export interface DireccionRowInput {
  id?: string;
  calle: string;
  numero: null;
  tipo_lugar: TipoDireccion;
  localidad: string;
  descripcion: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * `coordenadas` (change hojas-de-ruta-geocoding): mapa `direccion.id -> Coordenada | null`,
 * resuelto de antemano por quien llama (I/O async, no puede vivir en esta función pura). Solo
 * contiene una entrada para las direcciones que se intentaron geocodificar EN ESTE guardado —
 * nuevas o con `calle`/`localidad` cambiada (`direccionesACambiar`). Semántica:
 *   - id presente en `coordenadas`, valor `Coordenada` -> `lat`/`lng` viajan con el valor geocodificado.
 *   - id presente en `coordenadas`, valor `null` (geocoding falló o no se intentó por key ausente)
 *     -> `lat`/`lng` viajan como `null` explícito (limpia coordenadas viejas de una dirección que
 *     cambió y ya no se pudo volver a ubicar).
 *   - id AUSENTE de `coordenadas` (dirección sin cambios, no se re-geocodificó) -> `lat`/`lng` NO
 *     se incluyen en la fila — el upsert no toca esas columnas, preserva lo que ya había.
 * Sin segundo argumento (`= new Map()`), el comportamiento es idéntico al de antes de este change:
 * ninguna fila incluye `lat`/`lng`.
 */
export function toDireccionRows(
  direcciones: Direccion[],
  coordenadas: ReadonlyMap<string, Coordenada | null> = new Map(),
): DireccionRowInput[] {
  return direcciones.map((direccion) => {
    const fila: DireccionRowInput = {
      id: direccion.id,
      calle: direccion.calle,
      numero: null,
      tipo_lugar: direccion.tipo,
      localidad: direccion.localidad,
      descripcion: direccion.descripcion?.trim() ? direccion.descripcion.trim() : null,
    };

    if (coordenadas.has(direccion.id)) {
      const coordenada = coordenadas.get(direccion.id) ?? null;
      fila.lat = coordenada ? coordenada.lat : null;
      fila.lng = coordenada ? coordenada.lng : null;
    }

    return fila;
  });
}

/**
 * Determina qué direcciones hay que (re)geocodificar en este guardado (change
 * hojas-de-ruta-geocoding, RF-701): las que son nuevas (`id` no está entre las `existentes`) y las
 * que cambiaron `calle` o `localidad` respecto de lo que ya había — nunca las que llegan
 * idénticas, para no gastar cuota de la Geocoding API ni pisar una coordenada válida con el mismo
 * resultado. Pura: no decide CÓMO geocodificar, solo QUÉ direcciones lo necesitan.
 */
export function direccionesACambiar(existentes: Direccion[], entrantes: Direccion[]): Direccion[] {
  const existentesPorId = new Map(existentes.map((direccion) => [direccion.id, direccion]));

  return entrantes.filter((entrante) => {
    const previa = existentesPorId.get(entrante.id);
    if (previa === undefined) return true; // dirección nueva
    return previa.calle !== entrante.calle || previa.localidad !== entrante.localidad;
  });
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
    parentesco: parseParentesco(row.parentesco),
    telefono: readOptionalString(row, 'telefono'),
    telefonoAlternativo: readOptionalString(row, 'telefono_alternativo'),
  };
}

/** Fila para escribir en `pacientes.personas_a_cargo`. Inverso de la discrepancia #10: una cadena
 * vacía en el dominio se escribe como `NULL` (la columna es NULLable; no tiene sentido persistir
 * `''` cuando la base ya modela "sin dato" como `NULL`). `parentesco` es obligatorio en el dominio
 * (unión cerrada, siempre tiene un valor válido) — nunca viaja `null`, a diferencia de `dni`. */
export interface PersonaACargoRowInput {
  id?: string;
  nombre: string;
  apellido: string;
  dni: string | null;
  parentesco: Parentesco;
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
    parentesco: persona.parentesco,
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

/** `obra_social.coberturas_paciente` → `{ valor }` del número de afiliado (D3). El `formato` NO
 * se lee de acá — es una propiedad de la obra social (RF-106, D12 vigente: `coberturas_paciente
 * .formato_afiliado` existe en la base pero queda sin usar, no se dropea, ver
 * `ObraSocial.formatoAfiliado`). Ausencia de fila (0 filas, error de la consulta, o
 * `null`/`undefined`) degrada a `valor: ''` sin lanzar — el repository decide *por qué* no hay
 * fila (0 filas vs. RLS), acá solo se normaliza el resultado. */
export function parseCoberturaRow(row: unknown): { valor: string } {
  if (!isRecord(row)) return { valor: '' };
  return { valor: readNullableString(row, 'num_afiliado') ?? '' };
}

/** Combina la fila con embeds de `pacientes.paciente` (D2) más la fila de cobertura (D3, segunda
 * consulta a otro schema) en un `Paciente` completo. Filas hijas malformadas se descartan en
 * silencio (tarea 2.10) sin romper el paciente. `coberturaRow === null` degrada `numeroAfiliado`
 * a `{ valor: '' }` (discrepancia #1 de D9, vigente). */
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
    // Discrepancia #1 (D9, vigente): `formato` no viaja acá — es propiedad de la obra social
    // (RF-106, `ObraSocial.formatoAfiliado`), no del paciente. Solo `valor` viene de la cobertura.
    numeroAfiliado: { valor: cobertura.valor },
    cud,
    direcciones,
    personasACargo,
    amparoJudicial: base.amparoJudicial,
    amparoJudicialAclaracion: undefined,
  };
}

/** Argumento `p_paciente jsonb` de `pacientes.crear_paciente_completo` (D4). Espeja exactamente
 * las claves que lee `20260804120000_crear_paciente_completo_localidad_direccion.sql` (sus
 * `->>`/`->`) — nunca agrega una clave que la migración no consuma. Discrepancias #1 (`formato`,
 * vive en la obra social — RF-106), #4 (`dias`/`horario` de direcciones) y #6 (`domicilio`) NO
 * viajan (D9): son datos que el usuario ve en pantalla pero el esquema real no persiste acá.
 * `localidad` sí viaja (discrepancia #3 cerrada). La mayoría de los campos de texto se pasan tal
 * cual (incluso `''`) porque la migración ya hace `NULLIF(..., '')` de su lado — duplicar esa
 * decisión acá sería un segundo criterio para la misma regla. */
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

/**
 * `coordenadas` (change hojas-de-ruta-geocoding): igual semántica que en `toDireccionRows`. En el
 * alta TODAS las direcciones son nuevas (no hay `existentes` contra qué diffar), así que quien
 * llama (`SupabasePacienteRepository.crearPaciente`) geocodifica siempre las `nuevo.direcciones`
 * completas y arma un mapa con una entrada por cada una (éxito -> `Coordenada`, falla -> `null`) —
 * nunca queda una dirección nueva sin intentar. Default `= new Map()` para no romper compatibilidad
 * si algo llama a esta función sin coordenadas (equivalente a "ninguna geocodificó").
 */
export function toCrearPacientePayload(
  nuevo: NuevoPaciente,
  coordenadas: ReadonlyMap<string, Coordenada | null> = new Map(),
): CrearPacientePayload {
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
    // Discrepancias #4/#6 (D9): toDireccionRows ya excluye dias/horario/domicilio — no hay clave
    // que omitir acá, nunca existió. `localidad` sí viaja (discrepancia #3 cerrada). `lat`/`lng`
    // viajan desde `coordenadas` (change hojas-de-ruta-geocoding).
    direcciones: toDireccionRows(nuevo.direcciones, coordenadas),
    personas_a_cargo: toPersonaACargoRows(nuevo.personasACargo),
    accesorios: nuevo.accesorioMovilidad,
    // Discrepancia #1 (D9): solo viaja `valor`; `numeroAfiliado.formato` no tiene columna propia
    // en pacientes/coberturas — es una propiedad de la obra social (RF-106).
    num_afiliado: nuevo.numeroAfiliado.valor,
  };
}
