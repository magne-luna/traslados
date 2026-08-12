import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { renderConSesion } from '../../shared/test/renderConSesion';

// `PacientesRoute` inyecta `supabasePacienteRepository` (real, tasks.md 4.1), `supabaseObraSocialRepository`
// (real, `integracion-obra-social`), `supabaseDocumentoRepository` (real, `integracion-documentos`
// tasks.md 5.2) y, desde `documentos-checklist-items-por-actividad` tasks.md §6,
// `supabaseRequisitosActividadRepository` también real — este test mockea `shared/lib/supabaseClient`
// (mismo criterio que `router.cuentas.test.tsx`/`SupabaseCuentaRepository.test.ts`) para no depender
// de red ni de `SUPABASE_URL`/`SUPABASE_ANON_KEY` en el entorno de test, y para que el smoke test
// siga corriendo contra un doble, nunca contra Supabase real. El `select()` mockeado resuelve
// `{ data: [], error: null }` para cualquier tabla, así que los cuatro repositories devuelven
// listados vacíos y ninguna cadena adicional (`.eq()`, `.order()`, etc.) llega a ejecutarse — esto
// alcanza porque `documentoRepository.listByEntity` y `requisitosActividadRepository.listAll` no se
// invocan en el mount de la lista (recién se usan al entrar al detalle de un paciente,
// `PacienteDetail.tsx`), no hay más que verificar acá que el cableado, no el contenido de un
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

  it('monta la feature con supabasePacienteRepository/supabaseObraSocialRepository/supabaseDocumentoRepository/supabaseRequisitosActividadRepository (mockeados)', async () => {
    // pacientes-docs-actividad-tabs: `PacientesRoute` ahora monta `PacientesDocumentacionTabs`
    // (useLocation/useNavigate/usePermiso), que exige Router + AuthProvider — de ahí el
    // MemoryRouter y renderConSesion (admin por defecto) que antes no hacían falta acá.
    renderConSesion(
      <MemoryRouter>
        <PacientesRoute />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Pacientes' })).toBeInTheDocument();
  });
});
