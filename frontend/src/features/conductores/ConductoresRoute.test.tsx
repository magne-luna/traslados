import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// `ConductoresRoute` inyecta `supabaseConductorRepository` (real, integracion-conductores-vehiculos
// §7.8 "CORTE REAL 2") y `supabaseVehiculoRepository` (real desde §5.9 "CORTE REAL 1"). Mismo
// criterio que `VehiculosRoute.test.tsx`: mockea `shared/lib/supabaseClient` para que el smoke
// test corra contra un doble, nunca contra Supabase real. `schema().from().select()` resuelve el
// conductor (vía PostgREST + RPC); `functions.invoke` resuelve una lista vacía de vehículos —
// alcanza para verificar el cableado, no el contenido de un fixture (eso ya no existe: Conductor
// dejó de ser mock, no hay más `localStorage` que limpiar entre tests).
vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
          then: (resolve: (value: { data: unknown[]; error: null }) => void) =>
            Promise.resolve({ data: [], error: null }).then(resolve),
        }),
      }),
      rpc: () => Promise.resolve({ data: null, error: null }),
    }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: [], error: null }) },
  },
}));

const { ConductoresRoute } = await import('./ConductoresRoute');

describe('ConductoresRoute', () => {
  it('monta la feature con supabaseConductorRepository y supabaseVehiculoRepository (mockeados) y termina de cargar', async () => {
    render(<ConductoresRoute />);

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Conductores' })).toBeInTheDocument();
  });
});
