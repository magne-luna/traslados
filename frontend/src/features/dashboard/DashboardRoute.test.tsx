import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';
import { MemoryRouter } from 'react-router';

// `DashboardRoute` inyecta los seis `Supabase*Repository` reales (Factura, Cobro, Paciente,
// Vehiculo, HojaDeRuta, Conductor). Mismo criterio que `PacientesRoute.test.tsx` /
// `HojaDeRutaRoute.test.tsx`: se mockea `shared/lib/supabaseClient` para que el smoke test corra
// contra un doble, nunca contra Supabase real, sin depender de red ni de `SUPABASE_URL` en el
// entorno de test.
//
// El dashboard es de solo lectura: los repos llaman `schema().from().select()` (+ `.order()` /
// `.eq().maybeSingle()`) para los cinco que van por PostgREST y `functions.invoke('vehiculos')`
// para Vehiculo. El doble cuenta cada `select()` y cada `invoke()`: si el composition root
// siguiera inyectando algún mock, alguno de los contadores quedaría corto y el test caería (RED)
// — afirma el cableado a Supabase, no el contenido de un fixture (eso queda en
// `DashboardPage.test.tsx`, que sigue inyectando dobles a nivel de repository).
//
// Las pantallas se montan con `renderConQuery` porque los hooks del dashboard ya consultan vía
// React Query (`migracion-react-query`) y exigen un `QueryClientProvider`.
const estadoSupabase = vi.hoisted(() => ({ selects: 0, invokes: 0 }));

class ChainableFakeQuery implements PromiseLike<{ data: unknown[]; error: null; count: number }> {
  select(): this {
    estadoSupabase.selects += 1;
    return this;
  }
  order(): this {
    return this;
  }
  eq(): this {
    return this;
  }
  maybeSingle(): Promise<{ data: null; error: null }> {
    return Promise.resolve({ data: null, error: null });
  }
  then<TResult1 = { data: unknown[]; error: null; count: number }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: [], error: null, count: 0 }).then(onfulfilled, onrejected);
  }
}

vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({ from: () => new ChainableFakeQuery() }),
    functions: {
      invoke: vi.fn(() => {
        estadoSupabase.invokes += 1;
        return Promise.resolve({ data: [], error: null });
      }),
    },
  },
}));

const { DashboardRoute } = await import('./DashboardRoute');

describe('DashboardRoute', () => {
  beforeEach(() => {
    estadoSupabase.selects = 0;
    estadoSupabase.invokes = 0;
    localStorage.clear();
  });

  it('monta el dashboard con los seis Supabase*Repository (mockeados) y termina de cargar', async () => {
    renderConQuery(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/recorridos de hoy/i)).toBeInTheDocument(), { timeout: 5000 });
  });

  it('cablea las lecturas contra Supabase (PostgREST + Edge Function de vehículos), no contra mocks', async () => {
    renderConQuery(
      <MemoryRouter>
        <DashboardRoute />
      </MemoryRouter>,
    );

    // Factura, Cobro, Paciente, Conductor y HojaDeRuta van por PostgREST (`select`); Vehiculo por
    // la Edge Function (`functions.invoke`). Si el composition root inyectara un mock, faltaría
    // al menos una de estas llamadas.
    await waitFor(() => expect(estadoSupabase.selects).toBeGreaterThanOrEqual(5), { timeout: 5000 });
    await waitFor(() => expect(estadoSupabase.invokes).toBeGreaterThanOrEqual(1), { timeout: 5000 });
  });
});
