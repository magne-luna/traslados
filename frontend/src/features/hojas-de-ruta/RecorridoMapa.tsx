import { APIProvider, AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import type { ParadaRecorrido } from '../../shared/types/hojaDeRuta';

interface RecorridoMapaProps {
  paradas: ParadaRecorrido[];
  nombrePaciente: (pacienteId: string) => string;
}

// Mapa de un recorrido (tasks.md 6.1/6.2, design.md Decisión 6, skill google-maps-platform):
// @vis.gl/react-google-maps obligatorio (nunca @react-google-maps/api/google-map-react),
// AdvancedMarker (nunca google.maps.Marker), mapId="DEMO_MAP_ID" y altura CSS explícita por
// clase Tailwind (si no, el <Map> renderiza 0×0). La API key sale de la env var
// VITE_GOOGLE_MAPS_API_KEY (Maps Demo Key en este prototipo), nunca hardcodeada. Las
// coordenadas de las paradas son FIXTURES razonables, no geocoding real (design.md Decisión 6).
export function RecorridoMapa({ paradas, nombrePaciente }: RecorridoMapaProps) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  const claveValida = typeof apiKey === 'string' && apiKey.length > 0;

  if (!claveValida) {
    return (
      <div role="status" className="rounded-sm border border-warning-soft bg-warning-soft px-md py-sm font-body text-[12px] text-warning">
        Falta configurar VITE_GOOGLE_MAPS_API_KEY para ver el mapa (Maps Demo Key en este prototipo).
      </div>
    );
  }

  const paradasConCoordenada = paradas.filter(
    (parada): parada is ParadaRecorrido & { coordenadaOrigen: NonNullable<ParadaRecorrido['coordenadaOrigen']> } =>
      parada.coordenadaOrigen !== undefined,
  );

  if (paradasConCoordenada.length === 0) {
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
        {paradasConCoordenada.map((parada) => (
          <AdvancedMarker key={parada.id} position={parada.coordenadaOrigen} title={nombrePaciente(parada.pacienteId)} />
        ))}
      </Map>
    </APIProvider>
  );
}
