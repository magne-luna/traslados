import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// `FacturacionRoute` inyecta `supabasePacienteRepository`/`supabaseObraSocialRepository`
// (reales, 2026-08-05: swap parcial pedido por Enzo — Factura/Cobro siguen en mock) — mismo
// criterio que `PacientesRoute.test.tsx`: mockear `shared/lib/
// supabaseClient` para no depender de red ni de `SUPABASE_URL`/`SUPABASE_ANON_KEY` en el entorno
// de test. El `select()` mockeado resuelve `{ data: [], error: null }` para cualquier tabla.
vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({ from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
    functions: { invoke: vi.fn() },
  },
}));

const { FacturacionRoute } = await import('./FacturacionRoute');

describe('FacturacionRoute', () => {
  it('monta la feature completa con los mocks reales y muestra el listado tras cargar', async () => {
    localStorage.clear();
    render(<FacturacionRoute />);

    expect(await screen.findByRole('heading', { name: /facturaci[óo]n/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /nueva factura/i })).toBeInTheDocument();
  });
});
