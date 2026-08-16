import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

// `VehiculosRoute` inyecta `supabaseVehiculoRepository` (real, integracion-conductores-vehiculos
// §5.9 "CORTE REAL 1"). Mismo criterio que `PacientesRoute.test.tsx`: mockea
// `shared/lib/supabaseClient` para que el smoke test corra contra un doble, nunca contra Supabase
// real, sin depender de red ni de `SUPABASE_URL`/`SUPABASE_ANON_KEY` en el entorno de test.
// `functions.invoke` resuelve una lista vacía — alcanza para verificar el cableado (que la
// pantalla monta y termina de cargar), no el contenido de un fixture (eso ya no existe: Vehículo
// dejó de ser mock, no hay más `localStorage` que limpiar entre tests).
vi.mock('../../shared/lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: [], error: null }) },
  },
}));

const { VehiculosRoute } = await import('./VehiculosRoute');
const fuenteVehiculosRoute = await import('./VehiculosRoute.tsx?raw').then((m) => m.default as string);

describe('VehiculosRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('monta la feature con supabaseVehiculoRepository (mockeado) y termina de cargar', async () => {
    render(<VehiculosRoute />);

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));
    expect(screen.getByRole('heading', { name: 'Vehículos' })).toBeInTheDocument();
  });

  // documentos-vehiculos-conductores-facturacion: Documentos deja de ser el último mock del root
  // — swap a supabaseDocumentoRepository, ya soportado por SupabaseDocumentoRepository.ts sin
  // cambios (CONFIG_ENTIDAD ya tenía la fila de 'vehiculo').
  it('inyecta supabaseDocumentoRepository, no mockDocumentoRepository', () => {
    expect(fuenteVehiculosRoute).toMatch(/from ['"].*SupabaseDocumentoRepository['"]/);
    expect(fuenteVehiculosRoute).not.toMatch(/mockDocumentoRepository/);
  });
});
