// Traducción del error de la Edge Function `facturar` -> `Error` con `.message` en castellano listo
// para pintar en la UI (facturacion-electronica-arca, design.md D9). Mismo molde que
// `presupuestos/edgeFunctionErrors.ts`: lee `error.context` cuando es un `Response` y despacha por
// `status` + `codigo` del body. NUNCA propaga el texto crudo del miniserver / Postgres / motor: la
// única info del backend que llega a la UI son las `observaciones` de ARCA en un rechazo 422 (son
// para la operadora, no son internals).

const MSG_NO_CONFIGURADA = 'La emisión electrónica todavía no está configurada. Avisá a administración.';
const MSG_SESION_EXPIRADA = 'Tu sesión expiró. Volvé a iniciar sesión.';
const MSG_SIN_PERMISO = 'No tenés permiso para emitir facturas.';
const MSG_FACTURA_INEXISTENTE = 'La factura ya no existe.';
const MSG_ESTADO_INVALIDO = 'Solo se pueden emitir facturas en estado "a facturar".';
const MSG_TIPO_NO_SOPORTADO = 'La facturación electrónica solo admite comprobantes A y B por ahora.';
const MSG_SIN_CONDICION_IVA = 'Falta la condición frente al IVA de la obra social para emitir Factura A.';
const MSG_ARCA_IDENTIDAD = 'Hay un problema con el certificado fiscal. Avisá a administración.';
const MSG_ARCA_SIN_RESPUESTA = 'El servicio de facturación de ARCA no respondió. Probá de nuevo en unos minutos.';
const MSG_SIN_CONEXION = 'No se pudo conectar con el servidor.';
const MSG_GENERICO = 'No se pudo emitir la factura.';

interface CuerpoErrorEmision {
  error?: string;
  codigo?: string;
  cae?: string;
  observaciones?: string;
  cbteNro?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function leerCuerpo(context: Response): Promise<CuerpoErrorEmision> {
  try {
    const body: unknown = await context.json();
    if (!isRecord(body)) return {};
    return {
      error: typeof body.error === 'string' ? body.error : undefined,
      codigo: typeof body.codigo === 'string' ? body.codigo : undefined,
      cae: typeof body.cae === 'string' ? body.cae : undefined,
      observaciones: typeof body.observaciones === 'string' ? body.observaciones : undefined,
      cbteNro: typeof body.cbteNro === 'number' ? body.cbteNro : undefined,
    };
  } catch {
    return {};
  }
}

function mensajeYaEmitida(cae: string | undefined): string {
  return cae ? `Esta factura ya fue emitida (CAE ${cae}).` : 'Esta factura ya fue emitida.';
}

function mensaje409(cuerpo: CuerpoErrorEmision): string {
  return cuerpo.codigo === 'YA_EMITIDA' ? mensajeYaEmitida(cuerpo.cae) : MSG_ESTADO_INVALIDO;
}

function mensaje422(cuerpo: CuerpoErrorEmision): string {
  if (cuerpo.codigo === 'EMISION_TIPO_NO_SOPORTADO') return MSG_TIPO_NO_SOPORTADO;
  if (cuerpo.codigo === 'EMISION_SIN_CONDICION_IVA') return MSG_SIN_CONDICION_IVA;
  // ARCA_RECHAZO (y cualquier otro 422): incluir las observaciones de ARCA si vinieron.
  return cuerpo.observaciones
    ? `ARCA rechazó el comprobante: ${cuerpo.observaciones}`
    : 'ARCA rechazó el comprobante.';
}

function mensaje502(cuerpo: CuerpoErrorEmision): string {
  return cuerpo.codigo === 'ARCA_IDENTIDAD' ? MSG_ARCA_IDENTIDAD : MSG_ARCA_SIN_RESPUESTA;
}

function mensaje500(cuerpo: CuerpoErrorEmision): string {
  return cuerpo.cbteNro !== undefined
    ? `La factura se emitió en ARCA pero no se pudo guardar acá. Avisá a administración con el número ${cuerpo.cbteNro}.`
    : MSG_GENERICO;
}

/** Traduce el error de `supabase.functions.invoke('facturar', ...)` a un `Error` de UI (D9).
 *
 * Si `error.context` no es un `Response` (falla de red antes de la respuesta HTTP —
 * `FunctionsFetchError` / `FunctionsRelayError` de supabase-js), se traduce a "no se pudo conectar".
 * Un `status` fuera de las ramas conocidas cae al genérico. */
export async function traducirErrorEmision(error: unknown): Promise<Error> {
  const context = isRecord(error) ? error.context : undefined;
  if (!(context instanceof Response)) return new Error(MSG_SIN_CONEXION);

  const cuerpo = await leerCuerpo(context);

  switch (context.status) {
    case 401:
      return new Error(MSG_SESION_EXPIRADA);
    case 403:
      return new Error(MSG_SIN_PERMISO);
    case 404:
      return new Error(MSG_FACTURA_INEXISTENTE);
    case 409:
      return new Error(mensaje409(cuerpo));
    case 422:
      return new Error(mensaje422(cuerpo));
    case 502:
      return new Error(mensaje502(cuerpo));
    case 503:
      return new Error(MSG_NO_CONFIGURADA);
    case 500:
      return new Error(mensaje500(cuerpo));
    default:
      return new Error(MSG_GENERICO);
  }
}
