import type { ReactElement } from 'react';
import { createBrowserRouter } from 'react-router';
import { AppShell } from './AppShell';
import { APP_ROUTES } from './routes';
import { RequireAuth } from '../shared/auth/RequireAuth';
import { LoginPage } from '../features/auth/LoginPage';
import { ConductoresRoute } from '../features/conductores/ConductoresRoute';
import { DashboardRoute } from '../features/dashboard/DashboardRoute';
import { FacturacionRoute } from '../features/facturacion/FacturacionRoute';
import { HojaDeRutaRoute } from '../features/hojas-de-ruta/HojaDeRutaRoute';
import { ObraSocialesRoute } from '../features/obras-sociales/ObraSocialesRoute';
import { PacientesRoute } from '../features/pacientes/PacientesRoute';
import { PrestadoresRoute } from '../features/prestadores/PrestadoresRoute';
import { PresupuestosRoute } from '../features/presupuestos/PresupuestosRoute';
import { VehiculosRoute } from '../features/vehiculos/VehiculosRoute';
import { PlaceholderPage } from '../shared/components/PlaceholderPage';
import { NotFoundPage } from '../shared/components/NotFoundPage';
import DesignSystem from '../design-system/DesignSystem';

// Composición del router (Decisión 1 de design.md): data router con createBrowserRouter.
// /login es la única ruta pública (Decisión 4: "sistema interno, sin acceso público" —
// 03_actores_y_roles.md); todo lo demás cuelga de RequireAuth. Los ocho módulos se generan
// desde routes.ts con PlaceholderPage; cada FE-N reemplaza su `element` más adelante — FE-2
// (obras-sociales-ui) reemplazó /obras-sociales con ObraSocialesRoute (inyecta
// mockObraSocialRepository en su composition root, ver design.md Decisión 6); vehiculos-ui
// (fase FE-2, rama Vehículos y mantenimiento) reemplaza /vehiculos con VehiculosRoute (inyecta
// mockVehiculoRepository y mockDocumentoRepository, ver design.md Decisión 7 y 8); conductores-ui
// (fase FE-3, rama Conductores) reemplaza /conductores con ConductoresRoute (inyecta
// mockConductorRepository y también mockVehiculoRepository de solo lectura para el selector de
// asignación semanal, ver design.md de conductores-ui Decisión 7 y 9); pacientes-ui (fase FE-3,
// rama Pacientes y fichas clínicas) reemplaza /pacientes con PacientesRoute (inyecta
// mockPacienteRepository, y también mockObraSocialRepository/mockDocumentoRepository de FE-1/FE-2
// para el checklist documental por obra social, ver design.md de pacientes-ui Decisión 6/7);
// presupuestos-ui (fase FE-4, rama Presupuestos y autorizaciones) reemplaza /presupuestos con
// PresupuestosRoute (inyecta mockPresupuestoRepository y mockAutorizacionRepository, y también
// mockPacienteRepository/mockObraSocialRepository de FE-1/FE-3 de solo lectura para los
// selectores, ver design.md de presupuestos-ui Decisión 10); hojas-de-ruta-ui (fase FE-5, rama
// Hojas de ruta y recorridos) reemplaza /hojas-de-ruta con HojaDeRutaRoute (inyecta
// mockHojaDeRutaRepository, y también mockPacienteRepository/mockVehiculoRepository/
// mockConductorRepository de FE-1/FE-2/FE-3 de solo lectura para los selectores, ver design.md
// de hojas-de-ruta-ui Decisión 9); facturacion-ui (fase FE-6, rama Facturación, asistencias y
// cobros — governance CRITICO, C-07) reemplaza /facturacion con FacturacionRoute (inyecta
// mockFacturaRepository y mockCobroRepository, y también mockPacienteRepository/
// mockObraSocialRepository/mockPresupuestoRepository/mockAutorizacionRepository/
// mockDocumentoRepository de FE-1 a FE-4 de solo lectura para los selectores, la resolución del
// cupo autorizado y el checklist documental por factura, ver design.md de facturacion-ui
// Decisión 15); dashboard-ui (fase FE-7, rama Panel principal y reportes — governance BAJO,
// C-11) reemplaza `/` con DashboardRoute (inyecta mockFacturaRepository, mockCobroRepository,
// mockPacienteRepository, mockVehiculoRepository, mockHojaDeRutaRepository y
// mockConductorRepository de FE-1/FE-3/FE-5/FE-6, todos de solo lectura — el dashboard no crea,
// edita ni borra nada, ver design.md de dashboard-ui Decisión 9 y Non-Goals); prestadores-crud
// (rama de demo, D1/D5) reemplaza /prestadores con PrestadoresRoute (inyecta
// supabasePrestadorRepository — Prestador ya tiene backend real, sin mock, a diferencia de la
// mayoría de las features de arriba — ver design.md de prestadores-crud).
const ROUTE_ELEMENTS: Partial<Record<string, () => ReactElement>> = {
  '/': () => <DashboardRoute />,
  '/obras-sociales': () => <ObraSocialesRoute />,
  '/prestadores': () => <PrestadoresRoute />,
  '/vehiculos': () => <VehiculosRoute />,
  '/pacientes': () => <PacientesRoute />,
  '/conductores': () => <ConductoresRoute />,
  '/presupuestos': () => <PresupuestosRoute />,
  '/hojas-de-ruta': () => <HojaDeRutaRoute />,
  '/facturacion': () => <FacturacionRoute />,
};

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppShell />,
        children: [
          ...APP_ROUTES.map((route) => ({
            index: route.path === '/',
            path: route.path === '/' ? undefined : route.path.slice(1),
            element: ROUTE_ELEMENTS[route.path]?.() ?? <PlaceholderPage moduleName={route.label} />,
          })),
          // /cuentas (auth-frontend-real, tasks.md 7.9, design.md D4): admin-only, `modulo: null`
          // — no forma parte de APP_ROUTES/la navegación de módulos (se gobierna por rol, no por
          // módulo), pero SÍ vive dentro de AppShell (a diferencia de /design-system, que es una
          // vitrina fuera del shell). RequireAuth ya exige rol admin vía `requiereRolAdmin('/cuentas')`
          // (routes.ts, sección 5 de este tasks.md). Filtrar la entrada del sidebar es tarea de la
          // sección 8 (AppShell), fuera de alcance de este batch.
          //
          // `lazy` (no `element` estático): a diferencia del resto de los módulos, CuentasRoute
          // importa `SupabaseCuentaRepository` (y transitivamente `supabaseClient`, que valida
          // `SUPABASE_URL`/`SUPABASE_ANON_KEY` al importarse — tasks.md 1.2/1.3) a nivel de
          // módulo. Un `element: <CuentasRoute />` estático forzaría esa validación en TODOS los
          // tests que importan `router.tsx` (ej. `router.test.tsx`, que nunca visita `/cuentas`),
          // rompiéndolos si esas env vars no están definidas en el entorno de test. `lazy` difiere
          // la importación hasta que la ruta efectivamente se visita.
          {
            path: 'cuentas',
            lazy: async () => {
              const { CuentasRoute } = await import('../features/cuentas/CuentasRoute');
              return { Component: CuentasRoute };
            },
          },
        ],
      },
      { path: '/design-system', element: <DesignSystem /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
