// Traducción HTTP -> Error de UI para la Edge Function `vehiculos` (supabase/functions/vehiculos/index.ts).
// Mismo patrón que `presupuestos/edgeFunctionErrors.ts`: lee `error.context` cuando es un
// `Response` y despacha por `status`; todos los 400 se traducen a mensajes fijos, el texto crudo
// del motor/Postgres nunca llega a la UI.
//
// NOTA sobre design.md D12 de `integracion-conductores-vehiculos`: esa tabla fue escrita contra
// el plan original de RPCs `SECURITY INVOKER` (`crear_vehiculo_completo`/etc., códigos 45201-45204,
// PGRST202/204/106) — plan SUPERSEDED (ver vehiculoMapping.ts, cabecera y 4B.1). El backend real
// (`vehiculos/index.ts`) es una Edge Function que responde 401/403/404/400 con `{ error: string }`
// (mismo formato que `presupuestos`/`autorizaciones`, ver `_shared/auth.ts::requirePermiso` +
// `jsonResponse`), nunca códigos Postgres (`23505` etc.) — el `error.message` de `supabase-js` no
// viaja, solo el texto; la única señal reconocible para "patente duplicada" es el nombre del
// constraint (`vehiculo_patente_key`) dentro de ese texto. Este archivo traduce la realidad del
// backend, no el plan de D12.

export type OperacionVehiculo = 'listar' | 'obtener' | 'crear' | 'actualizar';

export interface ContextoErrorVehiculo {
  operacion: OperacionVehiculo;
  /** Solo lo usa el 404 de `actualizar` (`getById` intercepta el 404 antes de llegar acá y
   * devuelve `null`, ver `esErrorNotFound`). */
  id?: string;
}

const MENSAJE_SESION_EXPIRADA = 'Tu sesión expiró. Volvé a iniciar sesión.';
const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor.';
const MENSAJE_PATENTE_DUPLICADA = 'Ya existe un vehículo con esa patente.';
const MENSAJE_CAMPOS_FALTANTES = 'Faltan datos obligatorios del vehículo.';

function esOperacionDeEscritura(operacion: OperacionVehiculo): boolean {
  return operacion === 'crear' || operacion === 'actualizar';
}

function mensajeSinPermiso(operacion: OperacionVehiculo): string {
  return esOperacionDeEscritura(operacion) ? 'No tenés permiso para modificar vehículos.' : 'No tenés permiso para ver vehículos.';
}

function mensajeGenerico(operacion: OperacionVehiculo): string {
  if (operacion === 'listar') return 'No se pudo cargar el listado de vehículos.';
  if (operacion === 'obtener') return 'No se pudo cargar el vehículo.';
  return 'No se pudo guardar el vehículo.';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** `vehiculo.patente` es la única columna `UNIQUE` de `conductores.vehiculo` — Postgres nombra el
 * constraint `vehiculo_patente_key` por default (tabla `vehiculo`, columna `patente`, sin nombre
 * explícito en la migración). Coincide exactamente con lo que propaga `error.message` de
 * supabase-js en el insert/update de `vehiculos/index.ts`. */
function esPatenteDuplicada(mensajeCrudo: string): boolean {
  return mensajeCrudo.includes('vehiculo_patente_key');
}

/** Mensaje literal que emite `vehiculos/index.ts` en POST sin `patente` — único caso de "falta un
 * campo requerido" que ese backend valida a mano (el resto de los campos son opcionales). */
function esCampoRequeridoFaltante(mensajeCrudo: string): boolean {
  return mensajeCrudo.startsWith('falta el campo requerido');
}

async function mapear400(context: Response, operacion: OperacionVehiculo): Promise<Error> {
  try {
    const body: unknown = await context.json();
    if (isRecord(body) && typeof body.error === 'string') {
      const crudo = body.error;
      if (esPatenteDuplicada(crudo)) return new Error(MENSAJE_PATENTE_DUPLICADA);
      if (esCampoRequeridoFaltante(crudo)) return new Error(MENSAJE_CAMPOS_FALTANTES);
    }
  } catch {
    // Body no parseable como JSON: cae al mensaje genérico (nunca se propaga texto crudo).
  }
  return new Error(mensajeGenerico(operacion));
}

/** Traduce el error de `supabase.functions.invoke('vehiculos', …)` a un `Error` con `.message` en
 * castellano listo para pintar en la UI. El 404 de `getById` no pasa por acá — el repository lo
 * intercepta antes con `esErrorNotFound` y devuelve `null` (contrato explícito de la interfaz). */
export async function mapearErrorVehiculo(error: unknown, contexto: ContextoErrorVehiculo): Promise<Error> {
  const context = isRecord(error) ? error.context : undefined;
  if (!(context instanceof Response)) return new Error(MENSAJE_SIN_CONEXION);

  if (context.status === 401) return new Error(MENSAJE_SESION_EXPIRADA);
  if (context.status === 403) return new Error(mensajeSinPermiso(contexto.operacion));
  if (context.status === 404) return new Error(`No existe un vehículo con id "${contexto.id ?? ''}".`);
  if (context.status === 400) return mapear400(context, contexto.operacion);
  return new Error(mensajeGenerico(contexto.operacion));
}

/** `true` cuando el error de `functions.invoke` es un 404 real. Lo usa `getById` del repository
 * para devolver `null` en vez de lanzar — "no existe" es un resultado válido de esa operación, no
 * una excepción (mismo criterio que `presupuestos`/`autorizaciones`). */
export function esErrorNotFound(error: unknown): boolean {
  const context = isRecord(error) ? error.context : undefined;
  return context instanceof Response && context.status === 404;
}
