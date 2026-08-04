import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HojaDeRutaRoute } from './HojaDeRutaRoute';

// Smoke test de integración tras el swap parcial (tasks.md 4.2/4.3, design.md Checkpoint 0
// opción A): `HojaDeRutaRoute` inyecta `supabaseHojaDeRutaRepository` y
// `supabasePacienteRepository` (ambos reales, sobre el cliente `supabaseClient`) y mantiene
// `mockVehiculoRepository`/`mockConductorRepository`. El doble del cliente cuenta cada `select()`
// emitido en el montaje: si el composition root siguiera inyectando los mocks viejos, el contador
// quedaría en cero y este test caería (RED) — afirma el cableado a Supabase, no el contenido de un
// fixture precargado (eso quedó en `HojaDeRutaPage.test.tsx`). `vi.hoisted` mantiene el contador
// visible para el test y compartido con la fábrica del mock (nada de `any`).
const estadoSupabase = vi.hoisted(() => ({ selects: 0 }));

vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({
      from: () => ({
        select: () => {
          estadoSupabase.selects += 1;
          return {
            order: () => Promise.resolve({ data: [], error: null }),
            eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
          };
        },
      }),
    }),
    functions: { invoke: vi.fn() },
  },
}));

vi.mock('@vis.gl/react-google-maps', () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Map: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AdvancedMarker: () => <div />,
}));

describe('HojaDeRutaRoute', () => {
  beforeEach(() => {
    estadoSupabase.selects = 0;
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'demo-key');
  });

  it('monta la feature con el swap parcial inyectado: Hoja de Ruta y Paciente reales (doble de Supabase), Vehículo/Conductor mock', async () => {
    render(<HojaDeRutaRoute />);

    await waitFor(() => expect(estadoSupabase.selects).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryAllByText(/cargando hoja de ruta/i)).toHaveLength(0));

    expect(screen.getByRole('heading', { name: 'Hoja de ruta del día' })).toBeInTheDocument();
    expect(screen.getByText(/no hay hoja de ruta cargada para el/i)).toBeInTheDocument();
  });
});