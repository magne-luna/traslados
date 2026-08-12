import { APIProvider, AdvancedMarker, Map } from '@vis.gl/react-google-maps';
import { AvisoModeloDatos } from '../../design-system/components';
import type { ParadaRecorrido } from '../../shared/types/hojaDeRuta';

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

// Mapa de un recorrido (tasks.md 6.1/6.2, design.md Decisión 6, skill google-maps-platform):
// @vis.gl/react-google-maps obligatorio (nunca @react-google-maps/api/google-map-react),
// AdvancedMarker (nunca google.maps.Marker), mapId="DEMO_MAP_ID" y altura CSS explícita por
// clase Tailwind (si no, el <Map> renderiza 0×0). La API key sale de la env var
// VITE_GOOGLE_MAPS_API_KEY (Maps Demo Key en este prototipo), nunca hardcodeada. Las
// coordenadas de las paradas son FIXTURES razonables, no geocoding real (design.md Decisión 6).
export function RecorridoMapa({ paradas, nombrePaciente, desdeRepositoryReal = false }: RecorridoMapaProps) {
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
        {paradasConCoordenada.map((parada) => (
          <AdvancedMarker key={parada.id} position={parada.coordenadaOrigen} title={nombrePaciente(parada.pacienteId)} />
        ))}
      </Map>
    </APIProvider>
  );
}
