import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';

// `PresupuestosRoute` inyecta supabasePresupuestoRepository/supabaseAutorizacionRepository/
// supabasePacienteRepository/supabaseObraSocialRepository (reales, tasks.md 4.1) — este test
// mockea `shared/lib/supabaseClient` (mismo criterio que `ObraSocialesRoute.test.tsx`) para no
// depender de red ni de `SUPABASE_URL`/`SUPABASE_ANON_KEY` en el entorno de test, y para que el
// smoke test siga corriendo contra un doble, nunca contra Supabase real (tasks.md 4.2): los tests
// de comportamiento de la feature nunca pegan contra Supabase real, solo este composition root
// necesita un doble a nivel de cliente porque ya no hay un mock de repository que inyectar.
// `functions.invoke` (presupuesto/autorizacion, Edge Functions) y `schema().from().select()`
// (paciente/obraSocial, PostgREST) resuelven `{ data: [], error: null }`, así que las cuatro
// listas quedan vacías — no hay más fixture precargado que verificar acá (`Gómez, Martina` /
// `OSECAC` eran del mock, que ya no se inyecta en este composition root, D9); lo que este test
// confirma es que el cableado real monta sin colgarse en "cargando", no el contenido de un
// fixture.
vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: () => Promise.resolve({ data: [], error: null }) },
    schema: () => ({ from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

const { PresupuestosRoute } = await import('./PresupuestosRoute');

describe('PresupuestosRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con los repositories reales (mockeados) y muestra el encabezado', async () => {
    renderConQuery(<PresupuestosRoute />);

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Presupuestos' })).toBeInTheDocument();
  });
});
