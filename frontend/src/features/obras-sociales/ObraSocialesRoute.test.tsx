import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';

// `ObraSocialesRoute` inyecta `supabaseObraSocialRepository` (real, tasks.md 5.1) — este test
// mockea `shared/lib/supabaseClient` (mismo criterio que `PacientesRoute.test.tsx`/
// `router.cuentas.test.tsx`) para no depender de red ni de `SUPABASE_URL`/`SUPABASE_ANON_KEY` en
// el entorno de test, y para que el smoke test siga corriendo contra un doble, nunca contra
// Supabase real (tasks.md 5.2). El `select()` mockeado resuelve `{ data: [], error: null }`, así
// que `list()` devuelve un listado vacío — no hay más fixture precargado que verificar acá
// (OSECAC era del mock, que ya no se inyecta en este composition root); lo que este test confirma
// es que el cableado real monta sin colgarse en "cargando", no el contenido de un fixture.
vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({ from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

const { ObraSocialesRoute } = await import('./ObraSocialesRoute');

describe('ObraSocialesRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con supabaseObraSocialRepository (mockeado) y muestra el heading', async () => {
    renderConQuery(<ObraSocialesRoute />);

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Obras Sociales' })).toBeInTheDocument();
  });
});
