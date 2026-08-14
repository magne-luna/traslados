import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import type { ParadaRecorrido, Tramo } from '../../shared/types/hojaDeRuta';

// Respuesta programable del DirectionsService fake: status y, si sale bien, el `overview_path`
// del primer route. Los puntos pueden ser objetos con métodos `.lat()`/`.lng()` (lo que devuelve
// la librería real, LatLng de Google) o literales `{lat, lng}` — la normalización del componente
// soporta ambos.
interface RespuestaDirectionsFake {
  status: string;
  overview_path?: Array<{ lat: number | (() => number); lng: number | (() => number) }>;
}

// Harness del DirectionsService fake: los tests programan `responder` (la respuesta de la
// request) y leen `requests` (todas las llamadas a route()) o `ultimoRequest` (la última). Vive
// en vi.hoisted porque el factory de vi.mock corre antes que el resto del archivo.
//
// `routesLib` ES LA MISMA referencia en cada llamada a useMapsLibrary: el componente usa
// `routesLib` como dependencia del efecto de requests, y la librería REAL cachea la referencia
// (solo cambia cuando carga, de null al objeto). Si el mock devolviera un objeto nuevo por
// render, el efecto se re-dispararía en cada render → loop infinito de requests + setState que
// cuelga el worker de vitest.
const directionsHarness = vi.hoisted(() => {
  const DirectionsService = class {
    constructor() {}
    route(request: unknown, callback: (result: unknown, status: string) => void) {
      directionsHarnessRef.requests.push(request);
      directionsHarnessRef.ultimoRequest = request;
      const responder = directionsHarnessRef.responder;
      if (responder === null) return;
      const respuesta = responder(request);
      if (respuesta.status === 'OK' && respuesta.overview_path !== undefined) {
        callback({ routes: [{ overview_path: respuesta.overview_path }] }, 'OK');
      } else {
        callback(null, respuesta.status);
      }
    }
  };
  const directionsHarnessRef = {
    requests: [] as Array<unknown>,
    ultimoRequest: null as unknown,
    responder: null as null | ((request: unknown) => RespuestaDirectionsFake),
    routesLib: { DirectionsService },
  };
  return directionsHarnessRef;
});

// Mock de @vis.gl/react-google-maps (google-maps-platform: framework React obligatorio, nunca
// @react-google-maps/api/google-map-react). Se mockea el módulo para no depender de la red ni de
// una API key real en tests — solo se verifica que el componente use APIProvider/Map/AdvancedMarker/
// Polyline con las props correctas (mapId="DEMO_MAP_ID", altura, markers por parada) y que la ruta
// por calles salga del DirectionsService de la librería `routes` (nunca de un fetch a la REST API,
// que fallaría por CORS en el navegador real).
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children, apiKey }: { children: React.ReactNode; apiKey: string }) => (
    <div data-testid="api-provider" data-api-key={apiKey}>
      {children}
    </div>
  ),
  Map: ({ children, mapId, className }: { children: React.ReactNode; mapId: string; className: string }) => (
    <div data-testid="map" data-map-id={mapId} className={className}>
      {children}
    </div>
  ),
  AdvancedMarker: ({ position, title }: { position: { lat: number; lng: number }; title?: string }) => (
    <div data-testid="advanced-marker" data-lat={position.lat} data-lng={position.lng}>
      {title}
    </div>
  ),
  // Polyline del tramo del recorrido. La API real del paquete (@vis.gl/react-google-maps@1.9) no
  // expone el tramo como prop (PolylineProps = Omit<google.maps.PolylineOptions, 'map'|'path'> +
  // eventos), así que el mock lo expone en data-tramo derivándolo del strokeColor que el
  // componente asigna por tramo (teal de marca --color-primary para ida, ámbar de --color-warning
  // para vuelta — hexes de @theme en index.css): de paso fija el mapeo tramo→color del diseño.
  // `path` es el path que el componente pasa al API: la ruta NORMALIZADA de directions cuando la
  // request salió bien, o el path recto de las paradas cuando la request falló (fallback).
  Polyline: ({ path, strokeColor }: { path: { lat: number; lng: number }[]; strokeColor?: string }) => {
    const tramoDeColor: Record<string, Tramo> = {
      '#3F7D73': 'ida',
      '#B9791F': 'vuelta',
    };
    return (
      <div data-testid="polyline" data-tramo={tramoDeColor[strokeColor ?? '']} data-path={JSON.stringify(path)} />
    );
  },
  // La librería `routes` del Maps JS API: `useMapsLibrary('routes')` devuelve
  // `{ DirectionsService }` (la request la hace la librería internamente, sin CORS — la REST API
  // de Google Maps no responde Access-Control-Allow-Origin al navegador). El fake registra cada
  // request y, si el test programó un `responder`, llama al callback con esa respuesta; si no,
  // no responde (el tramo queda cargando, sin polyline).
  useMapsLibrary: (nombre: string) => (nombre === 'routes' ? directionsHarness.routesLib : null),
}));

const { RecorridoMapa } = await import('./RecorridoMapa');

// PUNTOS_OFICIALES: vector de la documentación de Google Maps (Polyline Algorithm) como lo
// devuelve la librería real — LatLng con métodos `.lat()`/`.lng()` — que decodifica a:
//   { lat: 38.5, lng: -120.2 } { lat: 40.7, lng: -120.95 } { lat: 43.252, lng: -126.453 }
// (los mismos 3 puntos de la doc original). Se usa para afirmar que el path renderizado es el
// NORMALIZADO (coordenadas literales) y no el path recto de las paradas (que en estos tests
// tienen coordenadas pequeñas bien distintas de los 3 puntos oficiales).
const PUNTOS_OFICIALES = [
  { lat: () => 38.5, lng: () => -120.2 },
  { lat: () => 40.7, lng: () => -120.95 },
  { lat: () => 43.252, lng: () => -126.453 },
];
const PUNTOS_ESPERADOS = [
  { lat: 38.5, lng: -120.2 },
  { lat: 40.7, lng: -120.95 },
  { lat: 43.252, lng: -126.453 },
];

// Programa el harness para que el DirectionsService fake responda con un status de error.
function responderError(status = 'REQUEST_DENIED') {
  directionsHarness.responder = () => ({ status });
}

function parada(
  id: string,
  coordenadaOrigen?: { lat: number; lng: number },
  opciones: { tramo?: Tramo; orden?: number } = {},
): ParadaRecorrido {
  return {
    id,
    pacienteId: `paciente-${id}`,
    tramo: opciones.tramo ?? 'ida',
    direccionOrigenId: 'dir-1',
    direccionDestinoId: 'dir-2',
    orden: opciones.orden ?? 0,
    coordenadaOrigen,
  };
}

describe('RecorridoMapa', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key-de-test');
    // El harness arranca limpio por test, con la respuesta por defecto de directions: OK con el
    // vector oficial; cada test la sobreescribe (responderError, responderOk con otros paths)
    // según lo que quiera afirmar.
    directionsHarness.requests = [];
    directionsHarness.ultimoRequest = null;
    directionsHarness.responder = () => ({ status: 'OK', overview_path: PUNTOS_OFICIALES });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // Renderiza y drena las microtareas (los tests que afirman polylines esperan con findBy*; el
  // resto solo necesita que el estado del componente se asiente sin warnings de act por updates
  // fuera de test).
  async function renderMapa(paradas: ParadaRecorrido[], props: { desdeRepositoryReal?: boolean } = {}) {
    const resultado = render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} {...props} />);
    await act(async () => {});
    return resultado;
  }

  it('renderiza un AdvancedMarker por cada parada con coordenadaOrigen', async () => {
    const paradas = [parada('a', { lat: 1, lng: 2 }), parada('b', { lat: 3, lng: 4 })];

    await renderMapa(paradas);

    expect(screen.getAllByTestId('advanced-marker')).toHaveLength(2);
  });

  it('usa mapId="DEMO_MAP_ID" y el <Map> tiene una clase de altura explícita', async () => {
    await renderMapa([parada('a', { lat: 1, lng: 2 })]);

    const map = screen.getByTestId('map');
    expect(map).toHaveAttribute('data-map-id', 'DEMO_MAP_ID');
    expect(map.className).toMatch(/h-/);
  });

  it('la key del provider se lee de la env var, nunca hardcodeada', async () => {
    await renderMapa([parada('a', { lat: 1, lng: 2 })]);

    expect(screen.getByTestId('api-provider')).toHaveAttribute('data-api-key', 'demo-key-de-test');
  });

  it('ignora las paradas sin coordenadaOrigen sin romper (triangulación/borde)', async () => {
    const paradas = [parada('a', { lat: 1, lng: 2 }), parada('b', undefined)];

    await renderMapa(paradas);

    expect(screen.getAllByTestId('advanced-marker')).toHaveLength(1);
  });

  it('muestra un mensaje explícito (no pantalla en blanco) si no hay paradas con coordenadas', async () => {
    await renderMapa([parada('a', undefined)]);

    expect(screen.getByText(/no hay paradas con coordenadas/i)).toBeInTheDocument();
  });

  describe('ruta real por calles (DirectionsService de la librería routes, una request por tramo con 2+ paradas)', () => {
    it('pide la ruta con origin/destination/waypoints en orden por `orden` y travelMode DRIVING', async () => {
      const paradas = [
        parada('b', { lat: 3, lng: 4 }, { tramo: 'ida', orden: 1 }),
        parada('a', { lat: 1, lng: 2 }, { tramo: 'ida', orden: 0 }),
        parada('c', { lat: 5, lng: 6 }, { tramo: 'ida', orden: 2 }),
      ];

      await renderMapa(paradas);

      expect(directionsHarness.requests).toHaveLength(1);
      expect(directionsHarness.ultimoRequest).toEqual({
        origin: { lat: 1, lng: 2 },
        destination: { lat: 5, lng: 6 },
        waypoints: [{ location: { lat: 3, lng: 4 }, stopover: true }],
        travelMode: 'DRIVING',
      });
    });

    it('con la ruta cargada, dibuja la polyline con el overview_path NORMALIZADO (no el path recto)', async () => {
      const paradas = [
        parada('a', { lat: 1, lng: 2 }, { orden: 0 }),
        parada('b', { lat: 3, lng: 4 }, { orden: 1 }),
      ];

      render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);

      // El overview_path del fake llega con LatLng que tienen métodos `.lat()`/`.lng()` (como la
      // librería real) y el mock de Polyline recibe el path ya normalizado a literales.
      const polyline = await screen.findByTestId('polyline');
      const path = JSON.parse(polyline.getAttribute('data-path') ?? '[]') as { lat: number; lng: number }[];
      expect(path).toEqual(PUNTOS_ESPERADOS);
      expect(path).not.toEqual([
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
      ]);
    });

    it('si la request a directions sale con status != OK, dibuja la polyline recta de fallback (nunca deja el mapa mudo)', async () => {
      responderError('ZERO_RESULTS');
      const paradas = [
        parada('a', { lat: 1, lng: 2 }, { orden: 0 }),
        parada('b', { lat: 3, lng: 4 }, { orden: 1 }),
      ];

      render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);

      const polyline = await screen.findByTestId('polyline');
      expect(JSON.parse(polyline.getAttribute('data-path') ?? '[]')).toEqual([
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
      ]);
    });

    it('el path recto del fallback respeta el orden ascendente aunque las paradas vengan desordenadas', async () => {
      responderError('REQUEST_DENIED');
      const paradas = [
        parada('c', { lat: 5, lng: 6 }, { orden: 2 }),
        parada('a', { lat: 1, lng: 2 }, { orden: 0 }),
        parada('b', { lat: 3, lng: 4 }, { orden: 1 }),
      ];

      render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);

      const polyline = await screen.findByTestId('polyline');
      expect(JSON.parse(polyline.getAttribute('data-path') ?? '[]')).toEqual([
        { lat: 1, lng: 2 },
        { lat: 3, lng: 4 },
        { lat: 5, lng: 6 },
      ]);
    });

    it('las paradas sin coordenada no generan request (ni aparecen como waypoint en la del tramo)', async () => {
      const paradas = [
        parada('a', { lat: 1, lng: 2 }, { orden: 0 }),
        parada('sin-coord', undefined, { orden: 1 }),
        parada('b', { lat: 3, lng: 4 }, { orden: 2 }),
        parada('d', { lat: 5, lng: 6 }, { tramo: 'vuelta', orden: 0 }),
        parada('e', { lat: 7, lng: 8 }, { tramo: 'vuelta', orden: 1 }),
      ];

      await renderMapa(paradas);

      expect(directionsHarness.requests).toHaveLength(2);
      // La primera request es la del tramo ida (orden de `tramosConRuta`): la parada sin
      // coordenada no aparece ni como waypoint — la parada con `orden` 1 directo no existe.
      expect(directionsHarness.requests[0]).toEqual({
        origin: { lat: 1, lng: 2 },
        destination: { lat: 3, lng: 4 },
        waypoints: [],
        travelMode: 'DRIVING',
      });
    });

    it('no pide la ruta (ni dibuja polyline) para el tramo con una sola parada con coordenada', async () => {
      const paradas = [
        parada('a', { lat: 1, lng: 2 }, { orden: 0 }),
        parada('b', { lat: 3, lng: 4 }, { orden: 1 }),
        parada('c', { lat: 5, lng: 6 }, { tramo: 'vuelta' }),
      ];

      await renderMapa(paradas);

      expect(directionsHarness.requests).toHaveLength(1);
      const polylines = screen.getAllByTestId('polyline');
      expect(polylines).toHaveLength(1);
      expect(polylines[0]).toHaveAttribute('data-tramo', 'ida');
    });

    it('no vuelve a pedir la ruta si los tramos no cambiaron (misma firma en rerender)', async () => {
      const paradas = [
        parada('a', { lat: 1, lng: 2 }, { orden: 0 }),
        parada('b', { lat: 3, lng: 4 }, { orden: 1 }),
      ];
      const { rerender } = render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);
      await screen.findByTestId('polyline');

      rerender(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);
      await act(async () => {});

      expect(directionsHarness.requests).toHaveLength(1);
    });
  });

  describe('polyline del recorrido (una por tramo)', () => {
    it('renderiza UNA polyline por tramo con coordenadas, con su data-tramo correcto', async () => {
      const paradas = [
        parada('a', { lat: 1, lng: 2 }),
        parada('b', { lat: 3, lng: 4 }),
        parada('c', { lat: 5, lng: 6 }, { tramo: 'vuelta', orden: 0 }),
        parada('d', { lat: 7, lng: 8 }, { tramo: 'vuelta', orden: 1 }),
      ];

      render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);

      const polylines = await screen.findAllByTestId('polyline');
      expect(polylines).toHaveLength(2);
      expect(polylines.some((p) => p.getAttribute('data-tramo') === 'ida')).toBe(true);
      expect(polylines.some((p) => p.getAttribute('data-tramo') === 'vuelta')).toBe(true);
    });
  });

  // El geocoding real ya está implementado (RF-701): si una hoja del repository real no tiene
  // coordenadas, es porque la dirección no se geocodificó todavía (o falló), no una limitación de
  // diseño — el cartel debe guiar a editar la dirección, distinto del estado vacío genérico.
  it('explica que falta geocodificar la dirección cuando la hoja viene del repository real', async () => {
    await renderMapa([parada('a', undefined)], { desdeRepositoryReal: true });

    expect(screen.getByText(/geocoding/i)).toBeInTheDocument();
    expect(screen.getByText(/editá la dirección/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay paradas con coordenadas/i)).not.toBeInTheDocument();
  });

  it('mantiene el estado vacío genérico (sin aviso de diseño) para hojas que no vienen del repository real', async () => {
    await renderMapa([parada('a', undefined)]);

    expect(screen.getByText(/no hay paradas con coordenadas/i)).toBeInTheDocument();
    expect(screen.queryByText(/geocoding/i)).not.toBeInTheDocument();
  });

  it('con coordenadas presentes, la flag del repository real no cambia el mapa (sigue mostrando markers)', async () => {
    await renderMapa([parada('a', { lat: 1, lng: 2 })], { desdeRepositoryReal: true });

    expect(screen.getAllByTestId('advanced-marker')).toHaveLength(1);
    expect(screen.queryByText(/geocoding/i)).not.toBeInTheDocument();
  });

  it('muestra un mensaje explícito (no pantalla en blanco) si falta la API key, sin pedir la ruta', async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');

    render(<RecorridoMapa paradas={[parada('a', { lat: 1, lng: 2 })]} nombrePaciente={() => 'Nombre'} />);

    expect(screen.getByText(/falta configurar/i)).toBeInTheDocument();
    expect(directionsHarness.requests).toHaveLength(0);
  });

  it('nunca usa fetch global: la ruta sale del DirectionsService de la librería (sin CORS)', async () => {
    const fetchGlobal = vi.fn();
    vi.stubGlobal('fetch', fetchGlobal);
    const paradas = [
      parada('a', { lat: 1, lng: 2 }, { orden: 0 }),
      parada('b', { lat: 3, lng: 4 }, { orden: 1 }),
    ];

    render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);
    await screen.findByTestId('polyline');

    expect(fetchGlobal).not.toHaveBeenCalled();
  });
});