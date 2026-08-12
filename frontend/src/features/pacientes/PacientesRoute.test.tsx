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
// siga corriendo contra un doble, nunca contra Supabase real.
//
// paginacion-listados, Fase 2: `PacientesPage` ahora llama `listPage()`, que encadena
// `.order().order().order().range()` (y opcionalmente `.or()`) sobre el resultado de `.select()` —
// el `select()` plano de antes (que devolvía directo un `Promise`, sin esos métodos) rompía esa
// cadena. El fake pasa a ser un builder encadenable mínimo (mismo criterio que el harness de
// `SupabasePacienteRepository.test.ts`): cada método de la cadena devuelve `this` y solo al
// awaitearlo (`then`) resuelve `{ data: [], error: null, count: 0 }` — así los repositories
// devuelven listados vacíos sin importar cuántos eslabones tenga la cadena real.
class ChainableFakeQuery implements PromiseLike<{ data: unknown[]; error: null; count: number }> {
  select(): this {
    return this;
  }
  order(): this {
    return this;
  }
  range(): this {
    return this;
  }
  or(): this {
    return this;
  }
  in(): this {
    return this;
  }
  eq(): this {
    return this;
  }
  maybeSingle(): Promise<{ data: null; error: null }> {
    return Promise.resolve({ data: null, error: null });
  }
  then<TResult1 = { data: unknown[]; error: null; count: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown[]; error: null; count: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: [], error: null, count: 0 }).then(onfulfilled, onrejected);
  }
}

vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    schema: () => ({ from: () => new ChainableFakeQuery() }),
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
