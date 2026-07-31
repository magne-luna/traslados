import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// `PacientesRoute` inyecta `supabasePacienteRepository` (real, tasks.md 4.1) — este test mockea
// `shared/lib/supabaseClient` (mismo criterio que `router.cuentas.test.tsx`/
// `SupabaseCuentaRepository.test.ts`) para no depender de red ni de `SUPABASE_URL`/
// `SUPABASE_ANON_KEY` en el entorno de test, y para que el smoke test siga corriendo contra un
// doble, nunca contra Supabase real (tasks.md 4.2). `obraSocialRepository`/`documentoRepository`
// siguen en mock (sus backends todavía no existen). El `select()` mockeado resuelve `{ data: [],
// error: null }`, así que `list()` devuelve un listado vacío y `leerCoberturasBatch` (que
// encadenaría `.order()` sobre el resultado) nunca llega a ejecutarse — no hay más pacientes que
// verificar acá que el cableado, no el contenido de un fixture precargado (eso quedó en
// `PacientesPage.test.tsx`, que inyecta un mock de verdad directo).
vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({ from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
    functions: { invoke: vi.fn() },
  },
}));

const { PacientesRoute } = await import('./PacientesRoute');

describe('PacientesRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con supabasePacienteRepository (mockeado) y los mocks de obra social/documentos inyectados', async () => {
    render(<PacientesRoute />);

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
  });
});
