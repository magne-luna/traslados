import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderConQuery } from '../../shared/test/queryWrapper';

// `FacturacionRoute` inyecta `supabaseFacturaRepository`/`supabaseCobroRepository`
// (`integracion-facturacion`, 2026-08-12), `supabasePacienteRepository`/
// `supabaseObraSocialRepository` (2026-08-05) y `supabasePresupuestoRepository`/
// `supabaseAutorizacionRepository` (fix directo 2026-08-15 — antes en mock, ver comentario del
// composition root) — todos reales. Mismo criterio que `PacientesRoute.test.tsx`/
// `PresupuestosRoute.test.tsx`: mockear `shared/lib/supabaseClient` para no depender de red ni de
// `SUPABASE_URL`/`SUPABASE_ANON_KEY` en el entorno de test. `functions.invoke`
// (factura/cobro/presupuesto/autorizacion, Edge Functions) y `schema().from().select()`
// (paciente/obraSocial, PostgREST) resuelven `{ data: [], error: null }` para cualquier tabla.
vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({ from: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: [], error: null }) },
  },
}));

const { FacturacionRoute } = await import('./FacturacionRoute');

describe('FacturacionRoute', () => {
  it('monta la feature completa con los mocks reales y muestra el listado tras cargar', async () => {
    localStorage.clear();
    renderConQuery(<FacturacionRoute />);

    expect(await screen.findByRole('heading', { name: /facturaci[óo]n/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /nueva factura/i })).toBeInTheDocument();
  });
});
