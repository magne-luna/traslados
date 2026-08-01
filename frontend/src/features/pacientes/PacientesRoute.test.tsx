import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// `PacientesRoute` inyecta `supabasePacienteRepository` (real, tasks.md 4.1) y, desde
// `integracion-obra-social`, `supabaseObraSocialRepository` también real — este test mockea
// `shared/lib/supabaseClient` (mismo criterio que `router.cuentas.test.tsx`/
// `SupabaseCuentaRepository.test.ts`) para no depender de red ni de `SUPABASE_URL`/
// `SUPABASE_ANON_KEY` en el entorno de test, y para que el smoke test siga corriendo contra un
// doble, nunca contra Supabase real. `documentoRepository` sigue en mock (su backend todavía no
// existe). El `select()` mockeado resuelve `{ data: [], error: null }` para cualquier tabla, así
// que ambos repositories devuelven listados vacíos y ninguna cadena adicional (`.order()`, etc.)
// llega a ejecutarse — no hay más que verificar acá que el cableado, no el contenido de un
// fixture precargado (eso quedó en `PacientesPage.test.tsx`, que inyecta un mock de verdad directo).
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

  it('monta la feature con supabasePacienteRepository/supabaseObraSocialRepository (mockeados) y el mock de documentos inyectado', async () => {
    render(<PacientesRoute />);

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
  });
});
