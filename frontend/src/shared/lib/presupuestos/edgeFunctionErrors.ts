// Traducción HTTP -> Error de UI para las Edge Functions `presupuestos` y `autorizaciones`
// (design.md D7). Mismo patrón que `SupabaseCuentaRepository.mapearErrorEdgeFunction`: lee
// `error.context` cuando es un `Response` y despacha por `status`. A diferencia de ese módulo (que
// propaga el `error` del body en los 400 porque `create-user` ya redacta mensajes de validación
// para humanos), acá TODOS los 400 se traducen a mensajes fijos: el texto crudo del motor/Postgres
// nunca debe llegar a la UI — RN-PA-01 es el caso testigo (tasks.md 3.2/3.3).
//
// `usePresupuestos`/`useAutorizaciones` pintan `err.message` directamente (D7), así que esta
// función siempre devuelve un `Error` con `.message` en castellano listo para mostrar.

export type EntidadEdgeFunction = 'presupuesto' | 'autorizacion';
export type OperacionEdgeFunction = 'listar' | 'obtener' | 'crear' | 'actualizar';

export interface ContextoErrorEdgeFunction {
  entidad: EntidadEdgeFunction;
  operacion: OperacionEdgeFunction;
  /** Solo lo usa el 404 de `actualizar`: arma el mensaje "No existe un/una <entidad> con id
   * "<id>"." — idéntico al que ya lanza `mockPresupuestoRepository`/`mockAutorizacionRepository`
   * (contrato que las features ya asumen). */
  id?: string;
}

interface Etiqueta {
  plural: string;
  singular: string;
  articuloIndefinido: 'un' | 'una';
  articuloDefinido: 'el' | 'la';
  contraccionDe: 'del' | 'de la';
}

const ETIQUETAS: Record<EntidadEdgeFunction, Etiqueta> = {
  presupuesto: {
    plural: 'presupuestos',
    singular: 'presupuesto',
    articuloIndefinido: 'un',
    articuloDefinido: 'el',
    contraccionDe: 'del',
  },
  autorizacion: {
    plural: 'autorizaciones',
    singular: 'autorización',
    articuloIndefinido: 'una',
    articuloDefinido: 'la',
    contraccionDe: 'de la',
  },
};

const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró. Volvé a iniciar sesión.';
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor.';
export const MENSAJE_RN_PA_01 = 'La autorización no puede superar el monto del presupuesto.';
/** Violación del índice único parcial `(presupuesto_id, periodo_mes) WHERE periodo_mes IS NOT
 * NULL` (design.md D1/D5 de `autorizacion-mensual`, tasks.md Fase 4). Mismo criterio que
 * RN-PA-01: el código crudo de Postgres (`23505`) nunca llega a la UI. */
export const MENSAJE_AUTORIZACION_DUPLICADA = 'Ya existe una autorización para ese mes en este presupuesto.';

/** Mensaje de violación de FK (23503): distinto según la entidad porque las columnas involucradas
 * son distintas — `presupuesto` referencia paciente/obra social, `autorizacion` referencia el
 * presupuesto que responde. `design.md` D7 solo da el texto de `presupuesto`; el de `autorizacion`
 * es una extensión simétrica hecha en esta tarea (3.6/3.8), no un texto ya aprobado. */
const MENSAJE_FK: Record<EntidadEdgeFunction, string> = {
  presupuesto: 'El paciente o la obra social del presupuesto ya no existen.',
  autorizacion: 'El presupuesto asociado a la autorización ya no existe.',
};

function esOperacionDeEscritura(operacion: OperacionEdgeFunction): boolean {
  return operacion === 'crear' || operacion === 'actualizar';
}

function mensajeSinPermiso(contexto: ContextoErrorEdgeFunction): string {
  const { plural } = ETIQUETAS[contexto.entidad];
  return esOperacionDeEscritura(contexto.operacion)
    ? `No tenés permiso para modificar ${plural}.`
    : `No tenés permiso para ver ${plural}.`;
}

function mensajeNoExiste(contexto: ContextoErrorEdgeFunction): string {
  const { articuloIndefinido, singular } = ETIQUETAS[contexto.entidad];
  return `No existe ${articuloIndefinido} ${singular} con id "${contexto.id ?? ''}".`;
}

function mensajeCamposFaltantes(contexto: ContextoErrorEdgeFunction): string {
  const { contraccionDe, singular } = ETIQUETAS[contexto.entidad];
  return `Faltan datos obligatorios ${contraccionDe} ${singular}.`;
}

function mensajeGenerico(contexto: ContextoErrorEdgeFunction): string {
  const { plural, singular, articuloDefinido } = ETIQUETAS[contexto.entidad];
  if (contexto.operacion === 'listar') return `No se pudo cargar el listado de ${plural}.`;
  if (contexto.operacion === 'obtener') return `No se pudo cargar ${articuloDefinido} ${singular}.`;
  return `No se pudo guardar ${articuloDefinido} ${singular}.`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function esViolacionDeForeignKey(mensajeCrudo: string): boolean {
  return mensajeCrudo.includes('23503') || mensajeCrudo.toLowerCase().includes('foreign key');
}

/** `23505` = violación de índice/constraint único. Acá solo lo produce el índice parcial de
 * `periodo_mes` (D1) — no hay otro `UNIQUE` en `facturacion.autorizacion` (tasks.md 0.5). */
function esViolacionDeUnicidadPeriodo(mensajeCrudo: string): boolean {
  return mensajeCrudo.includes('23505');
}

function esCamposFaltantes(mensajeCrudo: string): boolean {
  return mensajeCrudo.toLowerCase().startsWith('faltan campos requeridos');
}

/** Despacha un 400 ya confirmado como `Response`. Nunca propaga `body.error` (el texto crudo del
 * motor/Postgres) hacia la UI: cada rama reconocida devuelve un mensaje fijo, y la rama por
 * default también (tasks.md 3.2 — "el texto crudo nunca llega a la UI"). */
async function mapear400(context: Response, contexto: ContextoErrorEdgeFunction): Promise<Error> {
  try {
    const body: unknown = await context.json();
    if (isRecord(body) && typeof body.error === 'string') {
      const crudo = body.error;
      if (crudo.startsWith('RN-PA-01')) return new Error(MENSAJE_RN_PA_01);
      if (esViolacionDeUnicidadPeriodo(crudo)) return new Error(MENSAJE_AUTORIZACION_DUPLICADA);
      if (esViolacionDeForeignKey(crudo)) return new Error(MENSAJE_FK[contexto.entidad]);
      if (esCamposFaltantes(crudo)) return new Error(mensajeCamposFaltantes(contexto));
    }
  } catch {
    // Body no parseable como JSON: cae al mensaje genérico de abajo (nunca se propaga texto crudo).
  }
  return new Error(mensajeGenerico(contexto));
}

/** Traduce el error de `supabase.functions.invoke` (Edge Functions `presupuestos`/`autorizaciones`)
 * a un `Error` con `.message` en castellano listo para pintar en la UI (design.md D7).
 *
 * El 404 de `getById` NO pasa por acá: el repository lo intercepta antes de llamar a esta función
 * y devuelve `null` (contrato explícito de la interfaz) — esta función solo entra en la rama 404
 * cuando la llama `update()` (`contexto.operacion === 'actualizar'`). `listByPresupuestoId`
 * (`autorizacion-mensual` design.md D5, tasks.md Fase 4) YA NO intercepta el 404: la Edge Function
 * devuelve `200 []` cuando el presupuesto no tiene autorizaciones asociadas, nunca `404` — cualquier
 * error de esa consulta pasa por acá como cualquier otra lectura.
 *
 * Distinción red vs. status no reconocido: si `error.context` no es un `Response` (falla de red
 * antes de llegar a una respuesta HTTP — el caso de `FunctionsFetchError`/`FunctionsRelayError` de
 * supabase-js, o cualquier objeto sin esa forma) se traduce a "no se pudo conectar con el
 * servidor". Si sí es un `Response` pero con un status fuera de {401,403,404,400} (ej. 500), cae al
 * mensaje genérico de la operación — es la fila "cualquier otro" de la tabla D7. */
export async function mapearErrorEdgeFunction(error: unknown, contexto: ContextoErrorEdgeFunction): Promise<Error> {
  const context = isRecord(error) ? error.context : undefined;
  if (!(context instanceof Response)) return new Error(MENSAJE_SIN_CONEXION);

  if (context.status === 401) return new Error(MENSAJE_SESION_EXPIRADA);
  if (context.status === 403) return new Error(mensajeSinPermiso(contexto));
  if (context.status === 404) return new Error(mensajeNoExiste(contexto));
  if (context.status === 400) return mapear400(context, contexto);
  return new Error(mensajeGenerico(contexto));
}

/** `true` cuando el error de `functions.invoke` es un 404 real (`error.context` es un `Response`
 * con `status === 404`). Lo usa `getById` de los dos repositories para devolver `null` en vez de
 * llamar a `mapearErrorEdgeFunction` — el 404 en ese caso **no es un error para la interfaz** (D7):
 * "no existe" es un resultado válido, no una excepción. `listByPresupuestoId` (`autorizacion-mensual`
 * design.md D5, tasks.md Fase 4) YA NO usa este helper: con la Edge Function devolviendo `200 []`
 * para "sin autorizaciones", un 404 real en esa consulta pasaría a ser un error de verdad. */
export function esErrorNotFound(error: unknown): boolean {
  const context = isRecord(error) ? error.context : undefined;
  return context instanceof Response && context.status === 404;
}
