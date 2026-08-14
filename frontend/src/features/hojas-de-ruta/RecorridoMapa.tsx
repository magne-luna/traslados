import { APIProvider, AdvancedMarker, Map, Polyline, useMapsLibrary } from '@vis.gl/react-google-maps';
import { useEffect, useRef, useState } from 'react';
import { AvisoModeloDatos } from '../../design-system/components';
import type { Coordenada, ParadaRecorrido, Tramo } from '../../shared/types/hojaDeRuta';

interface RecorridoMapaProps {
  paradas: ParadaRecorrido[];
  nombrePaciente: (pacienteId: string) => string;
  /** Hoja proveniente del repository real: si ninguna parada tiene `coordenadaOrigen` acá, la
   * causa más probable es que la dirección del paciente se cargó antes de que existiera el
   * geocoding automático (change hojas-de-ruta-geocoding, RF-701) o que el geocoding falló al
   * guardarla — el geocoding real YA está implementado (ver
   * `SupabasePacienteRepository.geocodificarDirecciones`), no es una limitación de diseño. Se
   * explica distinto del estado vacío genérico para que el operador sepa que editar la dirección
   * lo resuelve. Lo propaga el composition root. */
  desdeRepositoryReal?: boolean;
}

// Un tramo listo para trazar: 2+ paradas con coordenada, ordenadas por `orden` (RN-HR-01: el
// orden es dato editable de la parada, nunca impuesto).
interface TramoConRuta {
  tramo: Tramo;
  puntos: Coordenada[];
}

// Tipo del DirectionsService de la librería `routes` del Maps JS API. Se deriva del hook en vez
// de nombrar el namespace global `google.maps` (tsconfig.app solo incluye los types de
// vite/client, así que ese namespace no se resuelve en el código de la app — los typings llegan
// por el paquete de @vis.gl, que sí los referencia).
type ServicioRutas = NonNullable<ReturnType<typeof useMapsLibrary<'routes'>>>['DirectionsService'];

// Normaliza un punto del `overview_path` de Directions — los LatLng reales de la librería son
// objetos con métodos `.lat()`/`.lng()` — o un literal `{lat, lng}` (mocks/fixtures) — a
// `Coordenada`. Devuelve `undefined` si el punto no tiene forma conocida: el call site lo trata
// como fallo y cae al fallback.
function aCoordenada(punto: unknown): Coordenada | undefined {
  if (typeof punto !== 'object' || punto === null) return undefined;
  const candidato = punto as { lat?: unknown; lng?: unknown };
  if (typeof candidato.lat === 'function' && typeof candidato.lng === 'function') {
    const lat = (candidato.lat as () => number)();
    const lng = (candidato.lng as () => number)();
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
  }
  if (typeof candidato.lat === 'number' && typeof candidato.lng === 'number') {
    return Number.isFinite(candidato.lat) && Number.isFinite(candidato.lng)
      ? { lat: candidato.lat, lng: candidato.lng }
      : undefined;
  }
  return undefined;
}

interface TrazoRecorridoProps {
  tramosConRuta: TramoConRuta[];
  colores: Record<Tramo, string>;
}

// Respuesta del callback de `DirectionsService.route` — solo la parte que consume este
// componente (overview_path, array de LatLng de la librería). El namespace global
// `google.maps` no está disponible en tsconfig.app (solo vite/client), así que la firma del
// callback se tipa contra esta interfaz local en vez de contra los tipos del paquete.
interface ResultadoDirections {
  routes?: Array<{ overview_path?: unknown[] }>;
}

// Trazo de la ruta REAL por calles de cada tramo. Vive DENTRO del árbol del <APIProvider> (y del
// <Map>): `useMapsLibrary` solo funciona en un componente bajo el provider — por eso el fetch a
// la Directions REST API no podía vivir en `RecorridoMapa` (que renderiza el provider en su
// propio return): la REST API no responde CORS al navegador y el Maps JS API resuelve la request
// internamente, sin CORS.
//
// Por tramo con 2+ paradas se pide la ruta con el `DirectionsService` de la librería `routes`
// (misma librería de Maps que APIProvider/Map/AdvancedMarker/Polyline). Mientras la request está
// en vuelo no se dibuja nada (evita el parpadeo de una línea recta que después cambia de forma);
// si falla (status != OK/sin route/path vacío), se cae al fallback de la polyline recta de las
// paradas para nunca dejar el mapa mudo. Colores del design system (@theme en index.css): ida con
// el teal de marca (--color-primary) y vuelta con el ámbar del eje warning (--color-warning).
function TrazoRecorrido({ tramosConRuta, colores }: TrazoRecorridoProps) {
  const routesLib = useMapsLibrary('routes');

  // El service se instancia UNA vez por identidad de la librería (memoización por ref): las
  // requests de directions son independientes entre sí, no hay estado que preservar en él.
  const directionsServiceRef = useRef<ServicioRutas | null>(null);

  // ruta por tramo: `undefined` = todavía cargando (no dibujar); [Coordenada] = ruta real
  // normalizada. `tramosConError[tramo] = true` = la request falló → polyline recta de fallback.
  const [rutasPorTramo, setRutasPorTramo] = useState<Partial<Record<Tramo, Coordenada[]>>>({});
  const [tramosConError, setTramosConError] = useState<Partial<Record<Tramo, boolean>>>({});

  // Firma estable de los tramos: solo cambia cuando cambian las coordenadas/orden/abundancia de
  // paradas — un re-render cualquiera del padre produce el mismo string y NO re-dispara las
  // requests (si la dependencia fuera la identidad del array, cada render pediría de nuevo).
  const firmaTramos = JSON.stringify(tramosConRuta);

  // `tramosConRuta` viaja por ref, actualizada en cada render pero SIN ser dependencia del efecto
  // de requests (mismo patrón que usePaginaListado): su identidad cambia en cada render del padre,
  // y si el efecto dependiera de ella, cada render dispararía de nuevo las requests — el efecto
  // solo debe reaccionar a que cambie la FIRMA serializada de los tramos (o a que cargue la
  // librería de rutas, que es async: useMapsLibrary devuelve null hasta que carga y re-renderiza
  // con la librería — por eso `routesLib` sí es dependencia).
  const tramosConRutaRef = useRef(tramosConRuta);
  useEffect(() => {
    tramosConRutaRef.current = tramosConRuta;
  });

  useEffect(() => {
    if (routesLib === null) return;
    if (directionsServiceRef.current === null) {
      directionsServiceRef.current = new routesLib.DirectionsService();
    }
    const service = directionsServiceRef.current;
    const tramos = tramosConRutaRef.current;

    // Re-arma el estado desde cero por tramo: sin rutas viejas (la firma cambió) y sin errores
    // heredados. Mientras resuelven las requests, no se dibuja ninguna polyline (evitar
    // parpadeo de línea recta, ver comentario del componente).
    setRutasPorTramo({});
    setTramosConError(Object.fromEntries(tramos.map(({ tramo }) => [tramo, false])));

    let activo = true;
    for (const { tramo, puntos } of tramos) {
      // Precondición del caller: TramoConRuta solo arma tramos con >= 2 puntos, así que primer y
      // último punto existen siempre acá.
      service.route(
        {
          origin: puntos[0]!,
          destination: puntos[puntos.length - 1]!,
          waypoints: puntos.slice(1, -1).map((punto) => ({
            location: { lat: punto.lat, lng: punto.lng },
            stopover: true,
          })),
          travelMode: 'DRIVING',
        },
        (result: ResultadoDirections | null, status: string) => {
          if (!activo) return;
          // overview_path ya viene decodificado por la librería (array de LatLng); se normaliza
          // a Coordenada. `undefined` si no hay route: se trata como fallo.
          const ruta = result?.routes?.[0]?.overview_path
            ?.map(aCoordenada)
            .filter((punto): punto is Coordenada => punto !== undefined);
          if (status === 'OK' && ruta !== undefined && ruta.length > 0) {
            setRutasPorTramo((anterior) => ({ ...anterior, [tramo]: ruta }));
            return;
          }
          setTramosConError((anterior) => ({ ...anterior, [tramo]: true }));
        },
      );
    }
    return () => {
      activo = false;
    };
  }, [firmaTramos, routesLib]);

  return (
    <>
      {tramosConRuta.map(({ tramo, puntos }) => {
        const rutaCargada = rutasPorTramo[tramo];
        const fallo = tramosConError[tramo] === true;
        // Cargando: no dibujar nada (evita el parpadeo de la línea recta que después cambia de
        // forma). Fallo: polyline recta de las paradas originales (nunca mapa mudo).
        if (rutaCargada === undefined && !fallo) return null;
        return (
          <Polyline
            key={tramo}
            path={rutaCargada ?? puntos}
            strokeColor={colores[tramo]}
            strokeWeight={3}
            strokeOpacity={1}
          />
        );
      })}
    </>
  );
}

// Mapa de un recorrido (tasks.md 6.1/6.2, design.md Decisión 6, skill google-maps-platform):
// @vis.gl/react-google-maps obligatorio (nunca @react-google-maps/api/google-map-react),
// AdvancedMarker (nunca google.maps.Marker), mapId="DEMO_MAP_ID" y altura CSS explícita por
// clase Tailwind (si no, el <Map> renderiza 0×0). La API key sale de la env var
// VITE_GOOGLE_MAPS_API_KEY (Maps Demo Key en este prototipo), nunca hardcodeada. Las
// coordenadas de las paradas son FIXTURES razonables, no geocoding real (design.md Decisión 6).
//
// El trazo de la ruta real por calles lo resuelve <TrazoRecorrido>, un subcomponente que vive
// dentro del <APIProvider> (useMapsLibrary lo requiere): pedir la Directions REST API con fetch
// desde el navegador falla por CORS (la API no responde Access-Control-Allow-Origin), así que la
// request la hace internamente el Maps JS API (DirectionsService de la librería `routes`).
export function RecorridoMapa({ paradas, nombrePaciente, desdeRepositoryReal = false }: RecorridoMapaProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const claveValida = typeof apiKey === 'string' && apiKey.length > 0;

  const paradasConCoordenada = paradas.filter(
    (parada): parada is ParadaRecorrido & { coordenadaOrigen: NonNullable<ParadaRecorrido['coordenadaOrigen']> } =>
      parada.coordenadaOrigen !== undefined,
  );

  // Una línea necesita al menos 2 puntos: un tramo con una sola parada (o ninguna) no dibuja
  // trazo (ni pide ruta).
  const tramosConRuta: TramoConRuta[] = (['ida', 'vuelta'] as const).flatMap((tramo) => {
    const puntos = paradasConCoordenada
      .filter((parada) => parada.tramo === tramo)
      .sort((a, b) => a.orden - b.orden)
      .map((parada) => parada.coordenadaOrigen);
    return puntos.length >= 2 ? [{ tramo, puntos }] : [];
  });

  const COLOR_POLYLINE_POR_TRAMO: Record<Tramo, string> = {
    ida: '#3F7D73',
    vuelta: '#B9791F',
  };

  if (!claveValida) {
    return (
      <div role="status" className="rounded-sm border border-warning-soft bg-warning-soft px-md py-sm font-body text-[12px] text-warning">
        Falta configurar VITE_GOOGLE_MAPS_API_KEY para ver el mapa (Maps Demo Key en este prototipo).
      </div>
    );
  }

  if (paradasConCoordenada.length === 0) {
    if (desdeRepositoryReal) {
      // El geocoding real ya está implementado (change hojas-de-ruta-geocoding, RF-701) — si acá
      // no hay coordenadas, es porque la dirección todavía no se geocodificó (se cargó antes de
      // este change) o el geocoding falló al guardarla, nunca porque esté fuera de scope. Se
      // explica distinto del estado vacío genérico para que el operador sepa que editar la
      // dirección del paciente lo resuelve.
      return (
        <AvisoModeloDatos>
          El mapa está vacío: ninguna parada tiene coordenadas geocodificadas todavía. Puede ser
          que la dirección del paciente se haya cargado antes de que existiera el geocoding
          automático, o que el geocoding haya fallado al guardarla. Editá la dirección (cambiando
          calle o localidad) y volvé a guardar para que se geocodifique.
        </AvisoModeloDatos>
      );
    }
    return (
      <div role="status" className="rounded-sm border border-border bg-surface-soft px-md py-sm font-body text-[12px] text-muted">
        No hay paradas con coordenadas para mostrar en el mapa todavía.
      </div>
    );
  }

  const centro = paradasConCoordenada[0]?.coordenadaOrigen;

  return (
    <APIProvider apiKey={apiKey}>
      <Map mapId="DEMO_MAP_ID" defaultCenter={centro} defaultZoom={12} className="h-64 w-full rounded-sm">
        <TrazoRecorrido tramosConRuta={tramosConRuta} colores={COLOR_POLYLINE_POR_TRAMO} />
        {paradasConCoordenada.map((parada) => (
          <AdvancedMarker key={parada.id} position={parada.coordenadaOrigen} title={nombrePaciente(parada.pacienteId)} />
        ))}
      </Map>
    </APIProvider>
  );
}
