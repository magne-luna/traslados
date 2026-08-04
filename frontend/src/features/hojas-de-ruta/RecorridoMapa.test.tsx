import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ParadaRecorrido } from '../../shared/types/hojaDeRuta';

// Mock de @vis.gl/react-google-maps (google-maps-platform: framework React obligatorio, nunca
// @react-google-maps/api/google-map-react). Se mockea el módulo para no depender de la red ni de
// una API key real en tests — solo se verifica que el componente use APIProvider/Map/AdvancedMarker
// con las props correctas (mapId="DEMO_MAP_ID", altura, markers por parada).
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
}));

const { RecorridoMapa } = await import('./RecorridoMapa');

function parada(id: string, coordenadaOrigen?: { lat: number; lng: number }): ParadaRecorrido {
  return {
    id,
    pacienteId: `paciente-${id}`,
    tramo: 'ida',
    direccionOrigenId: 'dir-1',
    direccionDestinoId: 'dir-2',
    orden: 0,
    coordenadaOrigen,
  };
}

describe('RecorridoMapa', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key-de-test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renderiza un AdvancedMarker por cada parada con coordenadaOrigen', () => {
    const paradas = [parada('a', { lat: 1, lng: 2 }), parada('b', { lat: 3, lng: 4 })];

    render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);

    expect(screen.getAllByTestId('advanced-marker')).toHaveLength(2);
  });

  it('usa mapId="DEMO_MAP_ID" y el <Map> tiene una clase de altura explícita', () => {
    render(<RecorridoMapa paradas={[parada('a', { lat: 1, lng: 2 })]} nombrePaciente={() => 'Nombre'} />);

    const map = screen.getByTestId('map');
    expect(map).toHaveAttribute('data-map-id', 'DEMO_MAP_ID');
    expect(map.className).toMatch(/h-/);
  });

  it('la key del provider se lee de la env var, nunca hardcodeada', () => {
    render(<RecorridoMapa paradas={[parada('a', { lat: 1, lng: 2 })]} nombrePaciente={() => 'Nombre'} />);

    expect(screen.getByTestId('api-provider')).toHaveAttribute('data-api-key', 'demo-key-de-test');
  });

  it('ignora las paradas sin coordenadaOrigen sin romper (triangulación/borde)', () => {
    const paradas = [parada('a', { lat: 1, lng: 2 }), parada('b', undefined)];

    render(<RecorridoMapa paradas={paradas} nombrePaciente={() => 'Nombre'} />);

    expect(screen.getAllByTestId('advanced-marker')).toHaveLength(1);
  });

  it('muestra un mensaje explícito (no pantalla en blanco) si no hay paradas con coordenadas', () => {
    render(<RecorridoMapa paradas={[parada('a', undefined)]} nombrePaciente={() => 'Nombre'} />);

    expect(screen.getByText(/no hay paradas con coordenadas/i)).toBeInTheDocument();
  });

  // Checkpoint 2 (design.md, spec hoja-de-ruta-avisos-modelo-datos): el mapeo del repository real
  // siempre resuelve `coordenadaOrigen` como `undefined`, así que el mapa de una hoja real queda
  // vacío. Con `desdeRepositoryReal` eso se explica como decisión (geocoding fuera de scope), no
  // como el estado vacío genérico — para que no se lea como un bug.
  it('explica por diseño el mapa vacío cuando la hoja viene del repository real (Checkpoint 2)', () => {
    render(<RecorridoMapa paradas={[parada('a', undefined)]} nombrePaciente={() => 'Nombre'} desdeRepositoryReal />);

    expect(screen.getByText(/por diseño/i)).toBeInTheDocument();
    expect(screen.getByText(/geocoding/i)).toBeInTheDocument();
    expect(screen.queryByText(/no hay paradas con coordenadas/i)).not.toBeInTheDocument();
  });

  it('mantiene el estado vacío genérico (sin aviso de diseño) para hojas que no vienen del repository real', () => {
    render(<RecorridoMapa paradas={[parada('a', undefined)]} nombrePaciente={() => 'Nombre'} />);

    expect(screen.getByText(/no hay paradas con coordenadas/i)).toBeInTheDocument();
    expect(screen.queryByText(/geocoding/i)).not.toBeInTheDocument();
  });

  it('con coordenadas presentes, la flag del repository real no cambia el mapa (sigue mostrando markers)', () => {
    render(<RecorridoMapa paradas={[parada('a', { lat: 1, lng: 2 })]} nombrePaciente={() => 'Nombre'} desdeRepositoryReal />);

    expect(screen.getAllByTestId('advanced-marker')).toHaveLength(1);
    expect(screen.queryByText(/geocoding/i)).not.toBeInTheDocument();
  });

  it('muestra un mensaje explícito (no pantalla en blanco) si falta la API key', () => {
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '');

    render(<RecorridoMapa paradas={[parada('a', { lat: 1, lng: 2 })]} nombrePaciente={() => 'Nombre'} />);

    expect(screen.getByText(/falta configurar/i)).toBeInTheDocument();
  });
});
