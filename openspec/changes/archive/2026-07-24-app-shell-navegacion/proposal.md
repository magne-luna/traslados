## Why

FE-0 (setup) se dio por completado pero quedó incompleto: `frontend/src/App.tsx` solo renderiza la vitrina del design system (`<DesignSystem />`), no hay librería de routing instalada y no existe ningún archivo de shell, navegación, layout o guard de rutas en `frontend/src/`. Sin un shell donde montar pantallas ni rutas a las que navegar, ningún módulo del roadmap puede integrarse: el change ya propuesto `obras-sociales-ui` (y todos los FE-N siguientes) necesitan un layout donde vivir y una ruta a la que apuntar. Este change entrega la parte de FE-0 que faltó (`ROADMAP-FRONTEND.md` línea 27: "Layout base: nav, shell, routing, guard de rutas protegidas apuntando a un `useAuth()` mockeado"), y por eso va **antes** de `obras-sociales-ui`.

## What Changes

- Se instala y configura **`react-router` v7** (data router, `createBrowserRouter`) como librería de routing — hoy no hay ninguna (`package.json` no tiene dependencia de router).
- Se construye el **shell de la app**: un layout con navegación lateral (sidebar) que reutiliza los primitivos ya existentes del design system (`NavIcon`, tokens, `components.tsx`) — NO se recrean primitivos.
- Se definen **rutas placeholder** para los ocho módulos del roadmap (Dashboard, Obras Sociales, Vehículos, Pacientes, Conductores, Presupuestos, Hojas de Ruta, Facturación), cada una como página "próximamente" vacía. El contenido real de cada módulo lo entrega su propio FE-N, no este change.
- Se agrega un **`useAuth()` mockeado**: hook + provider con una sesión falsa en memoria (usuario logueado por default para no bloquear el desarrollo), con capacidad de togglear a "no autenticado" para probar el guard.
- Se agrega un **guard de rutas protegidas** que redirige a una pantalla de **login mock** cuando `useAuth()` no tiene sesión. El guard solo verifica autenticación (sesión presente), **no** roles ni permisos por módulo — los permisos flexibles por cuenta llegan con el backend real (`C-02`, FE-8), no se sobre-diseñan acá.
- La vitrina `DesignSystem` deja de ser el home: se mueve a una ruta propia `/design-system` (documentación viva del sistema de diseño, no una pantalla de producto) y sigue accesible.
- `App.tsx` pasa a ser el **punto de composición**: importa la config del router y monta el provider de auth mock, en vez de renderizar `DesignSystem` directamente.
- **Fuera de alcance (NO se toca):** Supabase real (auth, DB, storage), permisos por módulo reales, y el contenido funcional de cada módulo (eso es cada FE-N). Todo es mock.

## Capabilities

### New Capabilities
- `app-routing`: configuración del router (`react-router` v7 con `createBrowserRouter`), definición de las rutas de los ocho módulos como páginas placeholder, la ruta `/design-system` para la vitrina, la ruta `/login` para el login mock y el manejo de ruta desconocida (404 → redirección o pantalla mínima).
- `app-shell`: layout raíz de la aplicación con navegación lateral (sidebar) construida sobre los primitivos del design system (`NavIcon`, `tokens`), marca del ítem activo según la ruta actual, y un `<Outlet>` donde se renderizan las pantallas hijas.
- `auth-mock`: hook `useAuth()` y `AuthProvider` con sesión falsa en memoria (logueado por default), acciones `signIn`/`signOut` para togglear el estado de autenticación, todo tipado estricto (sin `any`), pensado para reemplazarse por Supabase Auth real en FE-8 sin tocar consumidores.
- `route-guard`: componente/elemento de guardia que envuelve las rutas protegidas, redirige a `/login` cuando no hay sesión y una pantalla de login mock que dispara `signIn()` para volver a la app.

### Modified Capabilities
<!-- Ninguna: openspec/specs/ está vacío; no hay capacidades previas cuyos requisitos cambien. -->

## Impact

- **Dependencia nueva:** `react-router` (v7) en `frontend/package.json` — primera dependencia de routing del proyecto.
- **Código nuevo (frontend):**
  - `frontend/src/app/router.tsx` (config de `createBrowserRouter`).
  - `frontend/src/app/AppShell.tsx` (layout + sidebar de navegación).
  - `frontend/src/app/routes.ts` (definición declarativa de los módulos: path, etiqueta, ícono).
  - `frontend/src/shared/auth/AuthContext.tsx` + `useAuth.ts` (provider + hook mock).
  - `frontend/src/shared/auth/RequireAuth.tsx` (guard).
  - `frontend/src/features/<modulo>/<Modulo>Page.tsx` (ocho placeholders "próximamente") o un componente `PlaceholderPage` genérico parametrizado.
  - `frontend/src/features/auth/LoginPage.tsx` (login mock).
- **Código modificado:** `frontend/src/App.tsx` pasa a montar `<AuthProvider>` + `<RouterProvider>`; `DesignSystem` se re-monta bajo la ruta `/design-system` (no se modifica su contenido, solo su punto de montaje).
- **Reutiliza:** primitivos del design system (`NavIcon`, `Section`, `Button`, `Chip`) y `tokens.ts` — no se recrean.
- **Habilita (aguas abajo):** `obras-sociales-ui` (que espera un shell/ruta donde montarse) y el resto de los FE-N (cada uno reemplaza su placeholder por la pantalla real).
- **Reemplazo futuro (FE-8, cuando `C-02` backend se archive):** `useAuth()` mock → Supabase Auth real, y el guard de solo-autenticación se extiende a permisos por módulo. Como los consumidores hablan con `useAuth()` y no con Supabase directo, el swap queda contenido.
- **Sin impacto backend:** no crea tablas, RLS ni cliente Supabase.
