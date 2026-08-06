/**
 * Google Maps Geocoding — cliente real (change `hojas-de-ruta-geocoding`, RF-701).
 *
 * Reemplaza el placeholder anterior (`googleMapsClient = {} as const`, "Initialize the real
 * client... once the API key is available"): la key ya está disponible como env var, aunque
 * Enzo todavía no cargó un valor real en `frontend/.env.local` (queda en `undefined` hasta que lo
 * haga — este módulo lo tolera, ver más abajo).
 *
 * Por qué `fetch` directo a la REST API y no `@vis.gl/react-google-maps` (`importLibrary`,
 * `useMapsLibrary`): esa librería (usada por `RecorridoMapa.tsx` para el mapa) solo expone hooks
 * de React que dependen de un `<APIProvider>` montado en el árbol de componentes — no hay forma de
 * pedir una geocodificación puntual desde una capa de I/O sin componentes (el flujo de guardado de
 * `SupabasePacienteRepository.ts`, fuera de cualquier render). Verificado contra
 * `node_modules/@vis.gl/react-google-maps/dist/index.d.ts`: no exporta ningún helper standalone de
 * geocoding. La REST API (`maps.googleapis.com/maps/api/geocode/json`) es el fallback correcto acá
 * — mismo criterio que el resto del repo (nunca golpear la red real en un test; siempre degradar
 * sin romper el flujo que la llama).
 *
 * Contrato de degradación (RF-701, mismo criterio que `sugerirOrdenPorCercania.ts` con paradas sin
 * `coordenadaOrigen`): CUALQUIER falla — falta la API key, dirección vacía/malformada, error de red,
 * respuesta HTTP no-ok, `status` distinto de `OK`, cuerpo con forma inesperada — resuelve
 * `undefined`, nunca lanza. Quien llama (el guardado de una `Direccion`) nunca debe bloquearse por
 * un geocoding fallido.
 */

import type { Coordenada } from '../types/hojaDeRuta';

const GEOCODING_ENDPOINT = 'https://maps.googleapis.com/maps/api/geocode/json';

/** Subconjunto de `Direccion` que alcanza para armar la consulta de geocoding — nunca depende del
 *  resto de los campos (`id`, `tipo`, `dias`, `horario`). */
export interface DireccionGeocodificable {
  calle: string;
  localidad: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Traduce el JSON crudo de la Geocoding API a `Coordenada | undefined`. Pura y exportada para
 *  testear cada rama de forma sin depender de `fetch`: `status !== 'OK'` (incluye
 *  `ZERO_RESULTS`/`REQUEST_DENIED`/`OVER_QUERY_LIMIT`/etc.), `results` vacío o con forma
 *  inesperada, y el happy path. Nunca lanza — una forma inesperada degrada a `undefined`. */
export function parseGeocodingResponse(json: unknown): Coordenada | undefined {
  if (!isRecord(json)) return undefined;
  if (json.status !== 'OK') return undefined;

  const results = json.results;
  if (!Array.isArray(results) || results.length === 0) return undefined;

  const primero = results[0];
  if (!isRecord(primero)) return undefined;

  const geometry = primero.geometry;
  if (!isRecord(geometry)) return undefined;

  const location = geometry.location;
  if (!isRecord(location)) return undefined;

  const { lat, lng } = location;
  if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;

  return { lat, lng };
}

function construirUrl(direccion: DireccionGeocodificable, apiKey: string): string {
  const direccionCompleta = `${direccion.calle}, ${direccion.localidad}`;
  const params = new URLSearchParams({ address: direccionCompleta, key: apiKey });
  return `${GEOCODING_ENDPOINT}?${params.toString()}`;
}

/**
 * Geocodifica una dirección (`calle` + `localidad`) contra la Geocoding API real de Google.
 *
 * Se llama SOLO al guardar/enviar el formulario de direcciones de un paciente (alta o edición con
 * `calle`/`localidad` cambiadas) — nunca en cada tecleo, nunca en cada render de una hoja de ruta.
 * Ver `SupabasePacienteRepository.ts` (`geocodificarDirecciones`) y
 * `pacienteMapping.ts` (`direccionesACambiar`).
 *
 * Nunca lanza (ver contrato de degradación en la cabecera del archivo): toda falla resuelve
 * `undefined`.
 */
export async function geocodificarDireccion(direccion: DireccionGeocodificable): Promise<Coordenada | undefined> {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (typeof apiKey !== 'string' || apiKey.length === 0) return undefined;

  const calle = direccion.calle.trim();
  const localidad = direccion.localidad.trim();
  if (calle === '' || localidad === '') return undefined;

  try {
    const respuesta = await fetch(construirUrl({ calle, localidad }, apiKey));
    if (!respuesta.ok) return undefined;

    const json: unknown = await respuesta.json();
    return parseGeocodingResponse(json);
  } catch {
    // Error de red, JSON malformado, `fetch` no disponible, etc. — degrada, nunca lanza.
    return undefined;
  }
}
