import { supabase } from '../supabaseClient';
import type { AccesorioMovilidad } from '../../types/vehiculo';
import type { ActualizacionPaciente, Direccion, NuevoPaciente, Paciente } from '../../types/paciente';
import type { Coordenada } from '../../types/hojaDeRuta';
import type { PacienteRepository } from './PacienteRepository';
import {
  direccionesACambiar,
  ensamblarPaciente,
  parsePacienteRow,
  toCrearPacientePayload,
  toDireccionRows,
  toPersonaACargoRows,
} from './pacienteMapping';
import { geocodificarDireccion } from '../googleMapsClient';
import { DEFAULT_FORMATO_AFILIADO } from '../../../features/pacientes/formatoAfiliadoOptions';

// Implementación real de PacienteRepository (design.md del change integracion-pacientes,
// decisiones D1-D9). Toda la traducción fila<->dominio vive en `pacienteMapping.ts` (D1); acá solo
// hay I/O: armar consultas, chequear `error`, y orquestar el diff de `update()` (D5) y el alta
// atómica de `create()` (D4). Igual que SupabaseAuthRepository/SupabaseCuentaRepository: los datos
// que llegan de supabase-js sin un generic de esquema son `unknown` en la práctica — se narrowean
// con type guards explícitos, siempre narrowing manual, nunca `as`.

// ---------------------------------------------------------------------------------------------
// Lectura (D2/D3)
// ---------------------------------------------------------------------------------------------

// Un único `select` con embeds anidados (D2) — nunca N+1. `domicilio` se lee para no perderla
// (discrepancia #6 de D9) aunque `pacienteMapping.ts` no la mapea a ningún campo del dominio.
const SELECT_PACIENTE_COMPLETO = `
  id, nombre_a, nombre_b, apellido_a, apellido_b, fecha_nacimiento, dni, cuil_titular,
  domicilio, obra_social_id, amparo_judicial,
  cud ( numero_cud, emision, vencimiento ),
  clinicos ( diagnostico, condicion ),
  personas_a_cargo ( id, nombre, apellido, dni, parentesco, telefono, telefono_alternativo ),
  direcciones ( id, calle, numero, tipo_lugar, localidad, descripcion ),
  accesorios_pacientes ( accesorios ( tipo ) )
`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface CoberturaRowCruda {
  paciente_id: string;
  obra_social_id: string;
  num_afiliado: string | null;
}

function esCoberturaRowCruda(value: unknown): value is CoberturaRowCruda {
  if (!isRecord(value)) return false;
  return typeof value.paciente_id === 'string' && typeof value.obra_social_id === 'string';
}

/** Segunda consulta de D3 para un único paciente (usada por `getById`): filtra por
 * `paciente_id`/`obra_social_id` y ordena por `fecha_desde` desc. Error, 0 filas o paciente sin
 * obra social asignada → `null` (degradación de D3, nunca lanza). */
async function leerCoberturaParaPaciente(pacienteId: string, obraSocialId: string | null): Promise<unknown> {
  if (obraSocialId === null) return null;

  const { data, error } = await supabase
    .schema('obra_social')
    .from('coberturas_paciente')
    .select('num_afiliado')
    .eq('paciente_id', pacienteId)
    .eq('obra_social_id', obraSocialId)
    .order('fecha_desde', { ascending: false });

  if (error) return null;
  const rows: unknown = data;
  return Array.isArray(rows) ? (rows[0] ?? null) : null;
}

/** Versión en lote de la lectura de cobertura para `list()`: UNA sola consulta (sin filtrar por
 * paciente) ordenada por `fecha_desde` desc, agrupada client-side por `paciente_id` — evita volver
 * a introducir N+1 con una consulta de cobertura por fila del listado. Cada paciente se resuelve
 * después contra la fila más reciente cuyo `obra_social_id` coincida con el propio. */
async function leerCoberturasBatch(
  pacientes: Array<{ id: string; obraSocialId: string | null }>,
): Promise<Map<string, CoberturaRowCruda[]>> {
  const mapa = new Map<string, CoberturaRowCruda[]>();
  if (pacientes.length === 0) return mapa;

  const { data, error } = await supabase
    .schema('obra_social')
    .from('coberturas_paciente')
    .select('paciente_id, obra_social_id, num_afiliado')
    .order('fecha_desde', { ascending: false });

  if (error) return mapa;
  const rows: unknown = data;
  if (!Array.isArray(rows)) return mapa;

  for (const raw of rows) {
    if (!esCoberturaRowCruda(raw)) continue;
    const lista = mapa.get(raw.paciente_id) ?? [];
    lista.push(raw);
    mapa.set(raw.paciente_id, lista);
  }
  return mapa;
}

async function listarPacientes(): Promise<Paciente[]> {
  const { data, error } = await supabase.schema('pacientes').from('paciente').select(SELECT_PACIENTE_COMPLETO);
  if (error) throw mapearErrorPaciente(error, { operacion: 'listar' });

  const rows: unknown = data;
  if (!Array.isArray(rows)) return [];

  const filas = rows.map((row) => ({ row, base: parsePacienteRow(row) }));
  const coberturas = await leerCoberturasBatch(filas.map(({ base }) => ({ id: base.id, obraSocialId: base.obraSocialId })));

  return filas.map(({ row, base }) => {
    const candidatos = coberturas.get(base.id) ?? [];
    const coberturaRow = candidatos.find((c) => c.obra_social_id === base.obraSocialId) ?? null;
    return ensamblarPaciente(row, coberturaRow);
  });
}

async function getPacienteById(id: string): Promise<Paciente | null> {
  const { data, error } = await supabase
    .schema('pacientes')
    .from('paciente')
    .select(SELECT_PACIENTE_COMPLETO)
    .eq('id', id)
    .maybeSingle();

  if (error) throw mapearErrorPaciente(error, { operacion: 'listar' });
  // `data === null` cubre tanto "no existe" como "RLS filtró la fila" (mismo contrato, nunca lanza).
  if (data === null || data === undefined) return null;

  const base = parsePacienteRow(data);
  const coberturaRow = await leerCoberturaParaPaciente(base.id, base.obraSocialId);
  return ensamblarPaciente(data, coberturaRow);
}

// ---------------------------------------------------------------------------------------------
// Traducción de errores (D7) — siempre `Error` con mensaje en castellano, nunca texto crudo.
// ---------------------------------------------------------------------------------------------

interface FakeErrorLike {
  code?: string;
  message: string;
}

type OperacionError =
  | 'listar'
  | 'crear'
  | 'actualizar'
  | 'eliminar-direccion'
  | 'guardar-cobertura-alta'
  | 'guardar-cobertura-edicion';

interface ContextoError {
  operacion: OperacionError;
  dni?: string;
}

const MSG_SIN_PERMISO_ESCRITURA = 'No tenés permiso para modificar pacientes.';
const MSG_MODULO_NO_HABILITADO = 'El módulo de Pacientes no está habilitado en el servidor.';
const MSG_ALTA_NO_HABILITADA = 'El alta de pacientes no está habilitada en el servidor todavía.';
const MSG_PAYLOAD_INVALIDO = 'No se pudo guardar el paciente.';
const MSG_OBRA_SOCIAL_INEXISTENTE = 'La obra social seleccionada ya no existe.';
const MSG_DIRECCION_CON_RECORRIDOS = 'No se puede eliminar la dirección: hay recorridos que la usan.';
const MSG_SIN_PERMISO_OBRA_SOCIAL_ALTA =
  'No tenés permiso sobre Obras Sociales para guardar el número de afiliado. El paciente no se creó.';
const MSG_SIN_PERMISO_OBRA_SOCIAL_EDICION = 'No tenés permiso sobre Obras Sociales para editar el número de afiliado.';
const MSG_ERROR_GENERICO_CARGA = 'No se pudo cargar el paciente.';
const MSG_ERROR_GENERICO_GUARDADO = 'No se pudo guardar el paciente.';

function msgDniDuplicado(dni: string): string {
  return `Ya existe un paciente con el DNI «${dni}».`;
}

function msgAccesorioAusente(tipo: string): string {
  return `El accesorio de movilidad «${tipo}» no está cargado en el sistema. Pedí que lo agreguen al catálogo.`;
}

export function msgPacienteInexistente(id: string): string {
  return `No existe un paciente con id "${id}".`;
}

/** Extrae el texto entre `«»` de un mensaje propio de la RPC de alta (D4) — nunca se usa sobre
 * mensajes genéricos de Postgres, solo sobre los códigos `45001`/`45002` que la migración redacta
 * a mano en castellano. No se propaga el resto del mensaje crudo (D7). */
function extraerEntreComillas(mensaje: string): string {
  const match = /«([^»]*)»/.exec(mensaje);
  return match?.[1] ?? '';
}

/** Traduce un error de PostgREST/Postgres a un `Error` con mensaje en castellano listo para la UI
 * (D7). Nunca propaga `error.message` crudo, salvo la extracción puntual de `extraerEntreComillas`
 * sobre los códigos `45001`/`45002` (mensajes propios de la migración, ya en castellano). */
function mapearErrorPaciente(error: FakeErrorLike, contexto: ContextoError): Error {
  const codigo = error.code;

  if (codigo === '23505') {
    return new Error(msgDniDuplicado(contexto.dni ?? ''));
  }
  if (codigo === '23503') {
    if (contexto.operacion === 'eliminar-direccion') return new Error(MSG_DIRECCION_CON_RECORRIDOS);
    return new Error(MSG_OBRA_SOCIAL_INEXISTENTE);
  }
  if (codigo === '45001') {
    return new Error(msgAccesorioAusente(extraerEntreComillas(error.message)));
  }
  if (codigo === '45002') {
    return new Error(MSG_PAYLOAD_INVALIDO);
  }
  if (codigo === 'PGRST202') {
    return new Error(MSG_ALTA_NO_HABILITADA);
  }
  if (codigo === 'PGRST106') {
    return new Error(MSG_MODULO_NO_HABILITADO);
  }
  if (codigo === '42501' || codigo === 'PGRST301') {
    if (contexto.operacion === 'guardar-cobertura-alta') return new Error(MSG_SIN_PERMISO_OBRA_SOCIAL_ALTA);
    if (contexto.operacion === 'guardar-cobertura-edicion') return new Error(MSG_SIN_PERMISO_OBRA_SOCIAL_EDICION);
    return new Error(MSG_SIN_PERMISO_ESCRITURA);
  }

  return new Error(contexto.operacion === 'listar' ? MSG_ERROR_GENERICO_CARGA : MSG_ERROR_GENERICO_GUARDADO);
}

// ---------------------------------------------------------------------------------------------
// Geocoding de direcciones (change hojas-de-ruta-geocoding, RF-701)
// ---------------------------------------------------------------------------------------------

/** Geocodifica en paralelo un lote de direcciones y arma el mapa `id -> Coordenada | null` que
 *  consume `toDireccionRows`/`toCrearPacientePayload`. Se llama SOLO con las direcciones que hace
 *  falta (re)geocodificar en este guardado — todas en `create()` (todas son nuevas), o el
 *  subconjunto de `direccionesACambiar()` en `update()`. `geocodificarDireccion` nunca lanza (ver
 *  `googleMapsClient.ts`): una falla puntual por dirección se traduce a `null` en su entrada del
 *  mapa, nunca aborta el resto del lote ni el guardado del paciente. */
async function geocodificarDirecciones(direcciones: Direccion[]): Promise<Map<string, Coordenada | null>> {
  const entradas = await Promise.all(
    direcciones.map(async (direccion): Promise<[string, Coordenada | null]> => {
      const coordenada = await geocodificarDireccion(direccion);
      return [direccion.id, coordenada ?? null];
    }),
  );
  return new Map(entradas);
}

// ---------------------------------------------------------------------------------------------
// Alta atómica (D4)
// ---------------------------------------------------------------------------------------------

async function crearPaciente(data: NuevoPaciente): Promise<Paciente> {
  // Todas las direcciones del alta son nuevas — se geocodifican todas (RF-701). Un fallo puntual
  // de geocoding nunca bloquea el alta del paciente (contrato de degradación de `googleMapsClient`).
  const coordenadas = await geocodificarDirecciones(data.direcciones);

  const { data: nuevoId, error } = await supabase
    .schema('pacientes')
    .rpc('crear_paciente_completo', { p_paciente: toCrearPacientePayload(data, coordenadas) });

  if (error) {
    const numeroAfiliadoCargado = data.numeroAfiliado.valor !== '' && data.obraSocialId !== null;
    throw mapearErrorPaciente(error, {
      operacion: numeroAfiliadoCargado ? 'guardar-cobertura-alta' : 'crear',
      dni: data.dni,
    });
  }

  if (typeof nuevoId !== 'string') {
    throw new Error(MSG_ERROR_GENERICO_GUARDADO);
  }

  // Simétrico con `update()` (D5): lo devuelto siempre es lo que quedó realmente en la base.
  const paciente = await getPacienteById(nuevoId);
  if (!paciente) {
    throw new Error('No se pudo recuperar el paciente recién creado.');
  }
  return paciente;
}

// ---------------------------------------------------------------------------------------------
// Actualización parcial (D5)
// ---------------------------------------------------------------------------------------------

function construirCamposPaciente(data: ActualizacionPaciente): Record<string, unknown> {
  const campos: Record<string, unknown> = {};
  if (data.nombre !== undefined) campos.nombre_a = data.nombre;
  if (data.segundoNombre !== undefined) campos.nombre_b = data.segundoNombre || null;
  if (data.apellido !== undefined) campos.apellido_a = data.apellido;
  if (data.segundoApellido !== undefined) campos.apellido_b = data.segundoApellido || null;
  if (data.fechaNacimiento !== undefined) campos.fecha_nacimiento = data.fechaNacimiento || null;
  if (data.dni !== undefined) campos.dni = data.dni;
  if (data.cuilTitular !== undefined) campos.cuil_titular = data.cuilTitular || null;
  if (data.obraSocialId !== undefined) campos.obra_social_id = data.obraSocialId;
  if (data.amparoJudicial !== undefined) campos.amparo_judicial = data.amparoJudicial;
  return campos;
}

interface FilaConIdOpcional {
  id?: string;
}

/** Diff de una colección con `id` estable (direcciones, personas a cargo — D5): un único `upsert`
 * con TODAS las filas entrantes (inserta las nuevas, actualiza por `id` las existentes — nunca
 * borra e inserta) más un `delete` por cada `id` que ya no está en la colección entrante. */
async function aplicarDiffColeccion(opts: {
  tabla: 'direcciones' | 'personas_a_cargo';
  idsExistentes: string[];
  idsEntrantes: string[];
  filasAEscribir: FilaConIdOpcional[];
  pacienteId: string;
}): Promise<void> {
  const entrantesSet = new Set(opts.idsEntrantes);
  const idsABorrar = opts.idsExistentes.filter((id) => !entrantesSet.has(id));

  if (opts.filasAEscribir.length > 0) {
    const filas = opts.filasAEscribir.map((fila) => ({ ...fila, paciente_id: opts.pacienteId }));
    const { error } = await supabase.schema('pacientes').from(opts.tabla).upsert(filas);
    if (error) throw mapearErrorPaciente(error, { operacion: 'actualizar' });
  }

  for (const idABorrar of idsABorrar) {
    const contexto: ContextoError = { operacion: opts.tabla === 'direcciones' ? 'eliminar-direccion' : 'actualizar' };
    const { error } = await supabase.schema('pacientes').from(opts.tabla).delete().eq('id', idABorrar);
    if (error) throw mapearErrorPaciente(error, contexto);
  }
}

function esFilaAccesorioMaestro(value: unknown): value is { id: string; tipo: string } {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.tipo === 'string';
}

/** Resuelve `tipo -> accesorio_id` contra el maestro `pacientes.accesorios`, igual que la RPC de
 * alta (D4) lo hace server-side. Un `tipo` que no aparece en el maestro se ignora en silencio acá
 * (a diferencia del alta, que aborta con `45001`): no hay tarea que exija ese caso para `update`, y
 * degradar en vez de romper toda la edición es consistente con el resto de D9. */
async function resolverAccesorioIds(tipos: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (tipos.length === 0) return mapa;

  const { data, error } = await supabase.schema('pacientes').from('accesorios').select('id, tipo');
  if (error) return mapa;
  const rows: unknown = data;
  if (!Array.isArray(rows)) return mapa;

  for (const raw of rows) {
    if (!esFilaAccesorioMaestro(raw)) continue;
    mapa.set(raw.tipo, raw.id);
  }
  return mapa;
}

async function aplicarDiffAccesorios(
  pacienteId: string,
  existentes: AccesorioMovilidad[],
  entrantes: AccesorioMovilidad[],
): Promise<void> {
  const existentesSet = new Set(existentes);
  const entrantesSet = new Set(entrantes);
  const aAgregar = entrantes.filter((tipo) => !existentesSet.has(tipo));
  const aQuitar = existentes.filter((tipo) => !entrantesSet.has(tipo));
  if (aAgregar.length === 0 && aQuitar.length === 0) return;

  const idsPorTipo = await resolverAccesorioIds([...aAgregar, ...aQuitar]);

  for (const tipo of aAgregar) {
    const accesorioId = idsPorTipo.get(tipo);
    if (!accesorioId) continue;
    // Mismo riesgo que `clinicos` (ver más abajo): `accesorios_pacientes_pkey` es `id`, no el par
    // (paciente_id, accesorio_id) — sin `onConflict` explícito el upsert intenta un INSERT.
    const { error } = await supabase
      .schema('pacientes')
      .from('accesorios_pacientes')
      .upsert({ paciente_id: pacienteId, accesorio_id: accesorioId }, { onConflict: 'paciente_id,accesorio_id' });
    if (error) throw mapearErrorPaciente(error, { operacion: 'actualizar' });
  }

  for (const tipo of aQuitar) {
    const accesorioId = idsPorTipo.get(tipo);
    if (!accesorioId) continue;
    const { error } = await supabase
      .schema('pacientes')
      .from('accesorios_pacientes')
      .delete()
      .eq('paciente_id', pacienteId)
      .eq('accesorio_id', accesorioId);
    if (error) throw mapearErrorPaciente(error, { operacion: 'actualizar' });
  }
}

async function actualizarPaciente(id: string, data: ActualizacionPaciente): Promise<Paciente> {
  const existente = await getPacienteById(id);
  if (!existente) {
    throw new Error(msgPacienteInexistente(id));
  }

  const camposPaciente = construirCamposPaciente(data);
  if (Object.keys(camposPaciente).length > 0) {
    const { error } = await supabase.schema('pacientes').from('paciente').update(camposPaciente).eq('id', id);
    if (error) throw mapearErrorPaciente(error, { operacion: 'actualizar', dni: data.dni });
  }

  if (data.diagnostico !== undefined || data.condicion !== undefined) {
    // `clinicos_pkey` es `id` (no `paciente_id`) — sin `onConflict: 'paciente_id'` el upsert no
    // tiene con qué matchear la fila existente e intenta un INSERT, que choca contra
    // `clinicos_paciente_id_key` (UNIQUE) en cualquier edición posterior a la primera.
    const { error } = await supabase
      .schema('pacientes')
      .from('clinicos')
      .upsert({ paciente_id: id, diagnostico: data.diagnostico, condicion: data.condicion ?? null }, { onConflict: 'paciente_id' });
    if (error) throw mapearErrorPaciente(error, { operacion: 'actualizar' });
  }

  if (data.cud === null) {
    const { error } = await supabase.schema('pacientes').from('cud').delete().eq('paciente_id', id);
    if (error) throw mapearErrorPaciente(error, { operacion: 'actualizar' });
  } else if (data.cud !== undefined) {
    const cudNuevo = data.cud;
    // Sin `id` propio en el dominio (`Cud` no lo modela): se reemplaza borrando y volviendo a
    // escribir con `upsert` (nunca `.insert()`, D-hard-rule del change).
    const { error: errorBorrado } = await supabase.schema('pacientes').from('cud').delete().eq('paciente_id', id);
    if (errorBorrado) throw mapearErrorPaciente(errorBorrado, { operacion: 'actualizar' });
    const { error: errorAlta } = await supabase
      .schema('pacientes')
      .from('cud')
      .upsert({
        paciente_id: id,
        numero_cud: cudNuevo.numero,
        emision: cudNuevo.fechaEmision || null,
        vencimiento: cudNuevo.fechaVencimiento || null,
      });
    if (errorAlta) throw mapearErrorPaciente(errorAlta, { operacion: 'actualizar' });
  }

  if (data.direcciones !== undefined) {
    // RF-701: solo se (re)geocodifican las direcciones nuevas o con calle/localidad cambiada
    // (`direccionesACambiar`) — nunca todo el lote en cada edición. Las que no cambiaron quedan
    // fuera del mapa `coordenadas`, así que `toDireccionRows` omite `lat`/`lng` para ellas y el
    // upsert preserva la coordenada ya guardada en vez de pisarla con `null`.
    const aRegeocodificar = direccionesACambiar(existente.direcciones, data.direcciones);
    const coordenadas = await geocodificarDirecciones(aRegeocodificar);

    await aplicarDiffColeccion({
      tabla: 'direcciones',
      idsExistentes: existente.direcciones.map((d) => d.id),
      idsEntrantes: data.direcciones.map((d) => d.id),
      filasAEscribir: toDireccionRows(data.direcciones, coordenadas),
      pacienteId: id,
    });
  }

  if (data.personasACargo !== undefined) {
    await aplicarDiffColeccion({
      tabla: 'personas_a_cargo',
      idsExistentes: existente.personasACargo.map((p) => p.id),
      idsEntrantes: data.personasACargo.map((p) => p.id),
      filasAEscribir: toPersonaACargoRows(data.personasACargo),
      pacienteId: id,
    });
  }

  if (data.accesorioMovilidad !== undefined) {
    await aplicarDiffAccesorios(id, existente.accesorioMovilidad, data.accesorioMovilidad);
  }

  // Cobertura (D3): se escribe si `numeroAfiliado.valor` cambió respecto de lo leído. Sigue
  // requiriendo que haya una obra social a la cual asociarla (la del payload si se está cambiando,
  // si no la ya leída), y que `valor` no quede vacío: vaciar el campo no borra la cobertura
  // histórica — no hay tarea que lo exija y hacerlo adivinando iría contra la convención del change
  // de no resolver discrepancias sin confirmar. `formato_afiliado` viaja como el default fijo: la
  // columna es `NOT NULL` sin default propio, pero desde RF-106 el formato real vive en
  // `ObraSocial.formatoAfiliado`, no acá — esta columna queda sin uso (no se dropea).
  const obraSocialEfectivo = data.obraSocialId !== undefined ? data.obraSocialId : existente.obraSocialId;
  if (
    data.numeroAfiliado !== undefined &&
    data.numeroAfiliado.valor !== existente.numeroAfiliado.valor &&
    data.numeroAfiliado.valor !== '' &&
    obraSocialEfectivo !== null
  ) {
    const { error } = await supabase
      .schema('obra_social')
      .from('coberturas_paciente')
      .upsert({
        paciente_id: id,
        obra_social_id: obraSocialEfectivo,
        num_afiliado: data.numeroAfiliado.valor,
        formato_afiliado: DEFAULT_FORMATO_AFILIADO,
        fecha_desde: new Date().toISOString().slice(0, 10),
      });
    if (error) throw mapearErrorPaciente(error, { operacion: 'guardar-cobertura-edicion' });
  }

  const actualizado = await getPacienteById(id);
  if (!actualizado) {
    throw new Error('No se pudo recuperar el paciente actualizado.');
  }
  return actualizado;
}

// ---------------------------------------------------------------------------------------------

export const supabasePacienteRepository: PacienteRepository = {
  list: listarPacientes,
  getById: getPacienteById,
  create: crearPaciente,
  update: actualizarPaciente,
};
