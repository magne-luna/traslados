// Mapeo puro fila<->dominio para Obras Sociales (design.md D1/D2/D3/D4/D5 del change
// `integracion-obra-social`). Funciones exportadas, sin red, sin `any`, sin `as`.
// `SupabaseObraSocialRepository.ts` (sección 4) es la única capa de I/O; acá solo se traduce.
//
// ⚠️ Nombres de tabla/columna tomados LITERALMENTE del schema REAL, verificado con
// `supabase db query --linked` contra el proyecto (2026-07-31) — no del docx ni de lo que
// `design.md` planeaba agregar. El hallazgo completo está documentado en
// `knowledge-base/04_modelo_de_datos.md` §Discrepancias y en `CHANGES.md` §C-04:
//   - La columna se llama `tipo_comprobante` (no `tipo_factura`): ya fue renombrada y retipada
//     como enum `facturacion.tipo_factura` ('A'|'B'|'C') en el schema real, antes de que este
//     change escribiera ninguna migración.
//   - La tabla se llama `plantilla_campo` (no `campos_plantilla_factura` como decía D4/D6): ya
//     existía con ese nombre, con RLS y trigger de auditoría propios.
//   - `plazo_cobro_dias`, `modalidad_facturacion`, `admite_pagos_parciales`, `identificador_origen`
//     y `requisitos_os.orden`/`requerido` YA EXISTEN en la base real — no son columnas que este
//     change agregue, son columnas que ya estaban ahí cuando se verificó el schema.

import type {
  ActualizacionObraSocial,
  FormatoAfiliado,
  IdentificadorOrigenFactura,
  ModalidadFacturacion,
  NuevaObraSocial,
  ObraSocial,
  OrigenCampoPlantilla,
  PlantillaCampo,
} from '../../types/obraSocial';
import type { ChecklistItem } from '../../types/documento';

// Type guard mínimo sobre `unknown` para filas que llegan de PostgREST — mismo criterio que
// `pacienteMapping.ts`.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

// -------------------------------------------------------------------------------------------
// Defaults documentados (design.md D4/D9) — nunca hardcodeados aguas abajo del mapeo; si el
// valor real de la base no pertenece a la unión cerrada correspondiente (o es NULL), el mapeo cae
// acá en vez de romper la obra social. Los valores en sí espejan los CHECK/DEFAULT de la migración
// real (verificados con `supabase db query --linked`), no se inventan.
// -------------------------------------------------------------------------------------------

const MODALIDADES_VALIDAS = new Set<ModalidadFacturacion>(['por-prestacion', 'general']);
const DEFAULT_MODALIDAD_FACTURACION: ModalidadFacturacion = 'por-prestacion';

const IDENTIFICADORES_ORIGEN_VALIDOS = new Set<IdentificadorOrigenFactura>(['paciente.dni', 'paciente.numeroAfiliado']);
const DEFAULT_IDENTIFICADOR_ORIGEN: IdentificadorOrigenFactura = 'paciente.numeroAfiliado';

// RF-106/RN-ID-02 (integracion-obra-social, columna agregada 20260731140000): mismos 3 valores
// que el enum real `obra_social.formato_afiliado`.
const FORMATOS_AFILIADO_VALIDOS = new Set<FormatoAfiliado>(['numero-documento', 'alfanumerico', 'cuil-con-sufijo']);
const DEFAULT_FORMATO_AFILIADO: FormatoAfiliado = 'numero-documento';

const ORIGENES_CAMPO_VALIDOS = new Set<OrigenCampoPlantilla>([
  'paciente.nombre',
  'paciente.dni',
  'paciente.numeroAfiliado',
  'paciente.domicilio',
  'traslado.prestacion',
  'traslado.mesYAnio',
  'traslado.cantidadDias',
  'traslado.dependenciaYRetorno',
  'traslado.valorKm',
  'traslado.cantidadKm',
  'traslado.total',
  'valor-manual',
]);

function parseModalidadFacturacion(value: unknown): ModalidadFacturacion {
  return typeof value === 'string' && MODALIDADES_VALIDAS.has(value as ModalidadFacturacion)
    ? (value as ModalidadFacturacion)
    : DEFAULT_MODALIDAD_FACTURACION;
}

function parseIdentificadorOrigen(value: unknown): IdentificadorOrigenFactura {
  return typeof value === 'string' && IDENTIFICADORES_ORIGEN_VALIDOS.has(value as IdentificadorOrigenFactura)
    ? (value as IdentificadorOrigenFactura)
    : DEFAULT_IDENTIFICADOR_ORIGEN;
}

function parseFormatoAfiliado(value: unknown): FormatoAfiliado {
  return typeof value === 'string' && FORMATOS_AFILIADO_VALIDOS.has(value as FormatoAfiliado)
    ? (value as FormatoAfiliado)
    : DEFAULT_FORMATO_AFILIADO;
}

// -------------------------------------------------------------------------------------------
// 3.1 — parseObraSocialRow
// -------------------------------------------------------------------------------------------

export interface ObraSocialCamposBase {
  id: string;
  nombre: string;
  cuit: string;
  codigo?: string;
  direccion?: string;
  telefono?: string;
  condicionIva?: string;
  modalidadFacturacion: ModalidadFacturacion;
  admitePagosParciales: boolean;
  identificadorOrigen: IdentificadorOrigenFactura;
  formatoAfiliado: FormatoAfiliado;
}

/** Fila plana de `obra_social.obra_social` -> campos base del dominio (discrepancia #1 de la
 * tabla D11: `razon_social`->`nombre`). `tipo_comprobante`/`plazo_cobro_dias` de esta tabla no se
 * mapean acá: son columnas vestigiales anteriores al módulo `Prestador` (ya removido, change
 * `sacar-prestadores`), sin uso desde el frontend — fuera de scope. */
export function parseObraSocialRow(row: unknown): ObraSocialCamposBase {
  const record = isRecord(row) ? row : {};

  return {
    id: typeof record.id === 'string' ? record.id : '',
    nombre: typeof record.razon_social === 'string' ? record.razon_social : '',
    cuit: typeof record.cuit === 'string' ? record.cuit : '',
    codigo: readOptionalString(record, 'codigo'),
    direccion: readOptionalString(record, 'direccion'),
    telefono: readOptionalString(record, 'telefono'),
    condicionIva: readOptionalString(record, 'condicion_iva'),
    modalidadFacturacion: parseModalidadFacturacion(record.modalidad_facturacion),
    admitePagosParciales: typeof record.admite_pagos_parciales === 'boolean' ? record.admite_pagos_parciales : false,
    identificadorOrigen: parseIdentificadorOrigen(record.identificador_origen),
    formatoAfiliado: parseFormatoAfiliado(record.formato_afiliado),
  };
}

// -------------------------------------------------------------------------------------------
// 3.2 — parseRequisitoRow (checklist relacional, D2)
// -------------------------------------------------------------------------------------------

/** `requisitos_os` con su `tipos_documento` embebido -> `ChecklistItem`. `ChecklistItem.id` es el
 * de `tipos_documento`, NUNCA el de `requisitos_os` (D2 — decisión de clave menos obvia del
 * change: `DocumentoAdjunto.itemId` referencia `pacientes.documentos.id_tipo_documento`, que
 * apunta a `tipos_documento`, y la fila de vínculo es identidad-libre). Fila sin el embed ->
 * `null` (se descarta, no rompe la colección). */
export function parseRequisitoRow(row: unknown): ChecklistItem | null {
  if (!isRecord(row)) return null;
  const tipoDocumento = row.tipos_documento;
  if (!isRecord(tipoDocumento)) return null;

  const id = tipoDocumento.id;
  const nombre = tipoDocumento.tipo;
  if (typeof id !== 'string' || typeof nombre !== 'string') return null;

  return {
    id,
    nombre,
    requerido: typeof row.requerido === 'boolean' ? row.requerido : true,
  };
}

interface FilaConOrdenYId {
  orden: number;
}

/** Ordena por `orden` asc, desempatando por `id` (D2/RN-FA-08): determinista entre llamadas, no
 * depende del orden físico en que Postgres devuelva las filas. */
function ordenarPorOrdenYId<T extends FilaConOrdenYId & { id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.orden !== b.orden ? a.orden - b.orden : a.id.localeCompare(b.id)));
}

function readOrden(row: Record<string, unknown>): number {
  return typeof row.orden === 'number' ? row.orden : 0;
}

/** Colección `requisitos_os` (con embed) -> `ChecklistItem[]` ordenado (D2/3.3). Filas
 * malformadas se descartan sin romper el resto. */
function parseChecklist(rows: unknown): ChecklistItem[] {
  if (!Array.isArray(rows)) return [];

  const conOrden = rows
    .map((row) => {
      const item = parseRequisitoRow(row);
      if (item === null) return null;
      return { ...item, orden: isRecord(row) ? readOrden(row) : 0 };
    })
    .filter((item): item is ChecklistItem & { orden: number } => item !== null);

  return ordenarPorOrdenYId(conOrden).map(({ orden: _orden, ...item }) => item);
}

// -------------------------------------------------------------------------------------------
// 3.4 — parseCampoPlantillaRow + orden de la plantilla
// -------------------------------------------------------------------------------------------

/** Fila de `plantilla_campo` -> `PlantillaCampo`. Un `origen` fuera de la unión cerrada
 * `OrigenCampoPlantilla` (12 literales) se descarta (fila entera -> `null`), conservando el resto
 * de la colección. */
export function parseCampoPlantillaRow(row: unknown): PlantillaCampo | null {
  if (!isRecord(row)) return null;

  const id = row.id;
  const etiqueta = row.etiqueta;
  const origen = row.origen;
  if (typeof id !== 'string' || typeof etiqueta !== 'string') return null;
  if (typeof origen !== 'string' || !ORIGENES_CAMPO_VALIDOS.has(origen as OrigenCampoPlantilla)) return null;

  return { id, etiqueta, origen: origen as OrigenCampoPlantilla, orden: readOrden(row) };
}

/** Colección `plantilla_campo` -> `PlantillaCampo[]` ordenada (mismo criterio que el checklist). */
function parsePlantillaCampos(rows: unknown): PlantillaCampo[] {
  if (!Array.isArray(rows)) return [];

  const validos = rows
    .map((row) => parseCampoPlantillaRow(row))
    .filter((campo): campo is PlantillaCampo => campo !== null);

  return ordenarPorOrdenYId(validos);
}

// -------------------------------------------------------------------------------------------
// 3.5 — ensamblarObraSocial
// -------------------------------------------------------------------------------------------

/** Combina la fila de `obra_social.obra_social` con sus dos colecciones embebidas
 * (`requisitos_os`/`tipos_documento` y `plantilla_campo`) en una `ObraSocial` completa. Filas
 * hijas malformadas se descartan en silencio sin romper el resto (mismo criterio que
 * `pacienteMapping.ensamblarPaciente`). */
export function ensamblarObraSocial(row: unknown): ObraSocial {
  const base = parseObraSocialRow(row);
  const record = isRecord(row) ? row : {};

  return {
    id: base.id,
    nombre: base.nombre,
    cuit: base.cuit,
    codigo: base.codigo,
    direccion: base.direccion,
    telefono: base.telefono,
    condicionIva: base.condicionIva,
    modalidadFacturacion: base.modalidadFacturacion,
    admitePagosParciales: base.admitePagosParciales,
    formatoAfiliado: base.formatoAfiliado,
    checklist: parseChecklist(record.requisitos_os),
    plantillaFactura: {
      identificadorOrigen: base.identificadorOrigen,
      campos: parsePlantillaCampos(record.plantilla_campo),
    },
  };
}

// -------------------------------------------------------------------------------------------
// 3.6 — toCrearObraSocialPayload (alta atómica, D6)
// -------------------------------------------------------------------------------------------

interface ChecklistItemPayload {
  nombre: string;
  requerido: boolean;
  orden: number;
}

interface PlantillaCampoPayload {
  etiqueta: string;
  origen: OrigenCampoPlantilla;
  orden: number;
}

interface PlantillaFacturaPayload {
  identificador_origen: IdentificadorOrigenFactura;
  campos: PlantillaCampoPayload[];
}

export interface CrearObraSocialPayload {
  razon_social: string;
  cuit: string;
  codigo: string | null;
  direccion: string | null;
  telefono: string | null;
  condicion_iva: string | null;
  modalidad_facturacion: ModalidadFacturacion;
  admite_pagos_parciales: boolean;
  formato_afiliado: FormatoAfiliado;
  // El orden se deriva SIEMPRE del índice del array — nunca de una columna que el frontend no
  // conoce todavía. El id de un ChecklistItem NO viaja: lo resuelve el get-or-create del servidor
  // sobre `tipos_documento` (D3), normalizando por nombre.
  checklist: ChecklistItemPayload[];
  plantilla_factura: PlantillaFacturaPayload;
}

function vacioANull(value: string | undefined): string | null {
  return value === undefined || value === '' ? null : value;
}

function checklistAPayload(checklist: ChecklistItem[]): ChecklistItemPayload[] {
  return checklist.map((item, index) => ({ nombre: item.nombre, requerido: item.requerido, orden: index }));
}

function camposAPayload(campos: PlantillaCampo[]): PlantillaCampoPayload[] {
  return campos.map((campo, index) => ({ etiqueta: campo.etiqueta, origen: campo.origen, orden: index }));
}

/** Arma el único argumento `jsonb` de `obra_social.crear_obra_social_completa` (D6). Claves en
 * snake_case, espejando `20260731120001_obra_social_rpc.sql`. */
export function toCrearObraSocialPayload(nueva: NuevaObraSocial): CrearObraSocialPayload {
  return {
    razon_social: nueva.nombre,
    cuit: nueva.cuit,
    codigo: vacioANull(nueva.codigo),
    direccion: vacioANull(nueva.direccion),
    telefono: vacioANull(nueva.telefono),
    condicion_iva: vacioANull(nueva.condicionIva),
    modalidad_facturacion: nueva.modalidadFacturacion,
    admite_pagos_parciales: nueva.admitePagosParciales,
    formato_afiliado: nueva.formatoAfiliado,
    checklist: checklistAPayload(nueva.checklist),
    plantilla_factura: {
      identificador_origen: nueva.plantillaFactura.identificadorOrigen,
      campos: camposAPayload(nueva.plantillaFactura.campos),
    },
  };
}

// -------------------------------------------------------------------------------------------
// 3.7 — toActualizarObraSocialPayload (semántica parcial, D6 — la trampa más fácil del change)
// -------------------------------------------------------------------------------------------

/** Payload parcial: clave ausente en `ActualizacionObraSocial` -> la clave NO aparece en el
 * objeto devuelto (nunca `undefined` explícito, que en JS serializado a JSON desaparece igual,
 * pero acá se omite la clave desde el origen para que quede explícito en el propio objeto de TS,
 * no solo tras `JSON.stringify`). Clave presente con colección vacía (`checklist: []`) SÍ viaja:
 * significa "vaciar", no "no tocar" — es la trampa de jsonb que D6 documenta. */
export function toActualizarObraSocialPayload(cambios: ActualizacionObraSocial): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (cambios.nombre !== undefined) payload.razon_social = cambios.nombre;
  if (cambios.cuit !== undefined) payload.cuit = cambios.cuit;
  if (cambios.codigo !== undefined) payload.codigo = vacioANull(cambios.codigo);
  if (cambios.direccion !== undefined) payload.direccion = vacioANull(cambios.direccion);
  if (cambios.telefono !== undefined) payload.telefono = vacioANull(cambios.telefono);
  if (cambios.condicionIva !== undefined) payload.condicion_iva = vacioANull(cambios.condicionIva);
  if (cambios.modalidadFacturacion !== undefined) payload.modalidad_facturacion = cambios.modalidadFacturacion;
  if (cambios.admitePagosParciales !== undefined) payload.admite_pagos_parciales = cambios.admitePagosParciales;
  if (cambios.formatoAfiliado !== undefined) payload.formato_afiliado = cambios.formatoAfiliado;
  if (cambios.checklist !== undefined) payload.checklist = checklistAPayload(cambios.checklist);
  if (cambios.plantillaFactura !== undefined) {
    payload.plantilla_factura = {
      identificador_origen: cambios.plantillaFactura.identificadorOrigen,
      campos: camposAPayload(cambios.plantillaFactura.campos),
    };
  }

  return payload;
}
