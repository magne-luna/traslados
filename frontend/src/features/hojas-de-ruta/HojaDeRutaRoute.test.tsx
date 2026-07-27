import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HojaDeRutaRoute } from './HojaDeRutaRoute';

// Smoke test de integración (patrón PresupuestosRoute.test.tsx): confirma que el composition
// root real (mockHojaDeRutaRepository + mockPacienteRepository + mockVehiculoRepository +
// mockConductorRepository, no fakes de test) queda inyectado end-to-end y que el fixture de la
// hoja de ruta de hoy aparece precargado en el primer arranque.
vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: () => <div />,
}));

describe('HojaDeRutaRoute', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key');
  });

  it('monta la feature con los mocks reales inyectados y muestra el fixture de hoy precargado', async () => {
    render(<HojaDeRutaRoute />);

    expect((await screen.findAllByText(/toyota etios/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/gómez, martina/i).length).toBeGreaterThan(0);
  });
});
