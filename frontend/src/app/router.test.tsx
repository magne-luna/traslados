import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { RouterProvider } from 'react-router';
import { renderConSesion } from '../shared/test/renderConSesion';
import { router } from './router';

// tasks.md 8.3, design.md de dashboard-ui (Migration Plan paso 4): acceder a `/` autenticada
// renderiza el DashboardRoute dentro del AppShell — ya no PlaceholderPage. renderConSesion()
// (auth-frontend-real, tasks.md 5.1/5.8) monta un AuthProvider con sesión admin de todos los
// permisos por defecto, así que no hace falta simular login explícitamente; el router real
// (createBrowserRouter) usa la URL por defecto de jsdom, que es `/`.
describe('router: la ruta / monta el dashboard (tasks.md 8.3)', () => {
  it('renderiza el dashboard dentro del shell autenticado, no el placeholder de "Próximamente"', async () => {
    renderConSesion(<RouterProvider router={router} />);

    // Dos fases async ENCADENADAS, cada una con su propia espera. Meterlas en un solo `waitFor` de
    // 1 s dejaba el test al borde del presupuesto y lo volvía flaky bajo la suite completa (falla
    // al azar, pasa aislado — el peor tipo de fallo):
    //   1. `code-splitting-rutas`: baja el chunk de la ruta (hasta acá se ve `CargandoPantalla`).
    //   2. `migracion-react-query`: el dashboard consulta sus datos (sus tarjetas muestran sus
    //      propios "Cargando …" mientras tanto).
    // Esperar el encabezado primero es además lo que el test realmente afirma: que `/` monta el
    // dashboard. La ausencia de "cargando" se verifica después, ya sin competir por el mismo reloj.
    expect(await screen.findByRole('heading', { level: 1, name: /dashboard/i })).toBeInTheDocument();

    await waitFor(() => expect(screen.queryAllByText(/cargando/i)).toHaveLength(0));

    expect(screen.getByText(/recorridos de hoy/i)).toBeInTheDocument();
    expect(screen.queryByText(/próximamente/i)).not.toBeInTheDocument();
  });
});
