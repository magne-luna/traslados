import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// `PacientesRoute` inyecta `supabasePacienteRepository` (real, tasks.md 4.1), `supabaseObraSocialRepository`
// (real, `integracion-obra-social`) y, desde `integracion-documentos` tasks.md 5.2,
// `supabaseDocumentoRepository` también real — este test mockea `shared/lib/supabaseClient` (mismo
// criterio que `router.cuentas.test.tsx`/`SupabaseCuentaRepository.test.ts`) para no depender de red
// ni de `SUPABASE_URL`/`SUPABASE_ANON_KEY` en el entorno de test, y para que el smoke test siga
// corriendo contra un doble, nunca contra Supabase real. El `select()` mockeado resuelve
// `{ data: [], error: null }` para cualquier tabla, así que los tres repositories devuelven listados
// vacíos y ninguna cadena adicional (`.eq()`, `.order()`, etc.) llega a ejecutarse — esto alcanza
// porque `documentoRepository.listByEntity` no se invoca en el mount de la lista (recién se usa al
// entrar al detalle de un paciente, `PacienteDetail.tsx`), no hay más que verificar acá que el
// cableado, no el contenido de un fixture precargado (eso quedó en `PacientesPage.test.tsx`, que
// inyecta un mock de verdad directo).
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

  it('monta la feature con supabasePacienteRepository/supabaseObraSocialRepository/supabaseDocumentoRepository (mockeados)', async () => {
    render(<PacientesRoute />);

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
  });
});
