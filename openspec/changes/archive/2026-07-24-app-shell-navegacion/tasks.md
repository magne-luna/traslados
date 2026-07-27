## 0. Setup de testing (Strict TDD)

- [x] 0.1 Instalar devDependencies en `frontend/`: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`.
- [x] 0.2 Configurar `vitest.config.ts` (o extender `vite.config.ts` con bloque `test`): `environment: 'jsdom'`, `setupFiles` apuntando a `src/test/setup.ts` que importe `@testing-library/jest-dom`.
- [x] 0.3 Agregar script `"test": "vitest run"` (y `"test:watch": "vitest"`) a `frontend/package.json`.
- [x] 0.4 Confirmar que `npm run test` corre (aunque sea 0 tests) antes de escribir el primer test real — esto es el runner que habilita RED/GREEN del resto de las tasks.

## 1. Dependencia de routing

- [x] 1.1 Instalar `react-router` v7 en `frontend/` (`npm install react-router`) y verificar que quede en `dependencies` de `frontend/package.json`.

## 2. Auth mock (capability `auth-mock`)

- [x] 2.1 RED: escribir test de `useAuth()`/`AuthProvider` en `frontend/src/shared/auth/AuthContext.test.tsx` — arranca con sesión falsa (logueado), `signOut()` deja `session: null`, `signIn()` restaura sesión, y `useAuth()` fuera de `AuthProvider` lanza error. Debe fallar (no existe el módulo aún).
- [x] 2.2 GREEN: crear `frontend/src/shared/auth/AuthContext.tsx`: definir `interface Session { user: { id: string; nombre: string; email: string } }` (sin `any`) y un `AuthProvider` que mantenga `session: Session | null` en estado, arrancando con una sesión falsa (logueado por default), exponiendo `signIn()` y `signOut()`.
- [x] 2.3 GREEN: crear `frontend/src/shared/auth/useAuth.ts`: hook que lee el context y **lanza error explícito** si se usa fuera de `AuthProvider`; retorna `{ session, signIn, signOut }` tipado. Correr el test de 2.1 hasta que pase.
- [x] 2.4 Confirmar que el estado NO modela roles ni permisos por módulo (solo presencia de sesión + usuario falso), según `03_actores_y_roles.md`.

## 3. Rutas y placeholders (capability `app-routing`)

- [x] 3.1 Crear `frontend/src/app/routes.ts`: lista declarativa tipada de los ocho módulos (`path`, `label`, `icon`): Dashboard (`/`), Obras Sociales (`/obras-sociales`), Vehículos (`/vehiculos`), Pacientes (`/pacientes`), Conductores (`/conductores`), Presupuestos (`/presupuestos`), Hojas de Ruta (`/hojas-de-ruta`), Facturación (`/facturacion`).
- [x] 3.2 RED: test de `PlaceholderPage` (`frontend/src/shared/components/PlaceholderPage.test.tsx`) — renderiza el título del módulo recibido por prop y un indicador de "próximamente". Debe fallar.
- [x] 3.3 GREEN: crear `frontend/src/shared/components/PlaceholderPage.tsx`: componente genérico parametrizado por nombre de módulo, reutilizando primitivos del design system (`Section`, tokens). Correr el test hasta que pase.
- [x] 3.4 Definir el manejo de ruta desconocida (pantalla "no encontrado" mínima o redirección al Dashboard), sin dejar la app en blanco.

## 4. Shell de navegación (capability `app-shell`)

- [x] 4.1 RED: test de `AppShell` — renderiza los ítems de navegación de `routes.ts` y resalta el correspondiente a la ruta activa (montar con `MemoryRouter`/`createMemoryRouter` en un path dado). Debe fallar.
- [x] 4.2 GREEN: crear `frontend/src/app/AppShell.tsx`: layout raíz con navegación lateral (sidebar) construida sobre `NavIcon` y `tokens` del design system (sin recrear primitivos) y un `<Outlet>` para las pantallas hijas.
- [x] 4.3 GREEN: resaltar el ítem de navegación correspondiente a la ruta activa (usar `NavLink`/`useLocation` de react-router), leyendo los ítems desde `routes.ts`. Correr el test de 4.1 hasta que pase.
- [x] 4.4 Hacer la navegación responsive (RNF-08): colapsable o compacta en pantallas angostas sin tapar el contenido de forma permanente.

## 5. Guard y login mock (capability `route-guard`)

- [x] 5.1 RED: test de `RequireAuth` — sin sesión redirige a `/login`; con sesión renderiza el `<Outlet>` (mockear `useAuth`). Debe fallar.
- [x] 5.2 GREEN: crear `frontend/src/shared/auth/RequireAuth.tsx`: si `useAuth().session` es `null`, `<Navigate to="/login" replace />`; si hay sesión, renderiza `<Outlet>`. Verifica solo autenticación, no roles. Correr el test de 5.1 hasta que pase.
- [x] 5.3 RED: test de `LoginPage` — al confirmar el login invoca `signIn()` y navega al Dashboard. Debe fallar.
- [x] 5.4 GREEN: crear `frontend/src/features/auth/LoginPage.tsx`: pantalla de login mock que al confirmar invoca `signIn()` y navega al Dashboard; NO valida credenciales reales ni contacta Supabase. Correr el test de 5.3 hasta que pase.
- [x] 5.5 En `/login`, redirigir al Dashboard si ya hay sesión activa.

## 6. Composición del router y App.tsx

- [x] 6.1 Crear `frontend/src/app/router.tsx`: `createBrowserRouter` con `/login` público, y el resto de rutas anidadas bajo `RequireAuth` → `AppShell` (con las rutas de módulo desde `routes.ts` usando `PlaceholderPage`), más la ruta `/design-system` que monta la vitrina `DesignSystem` existente, y la ruta comodín (404).
- [x] 6.2 Modificar `frontend/src/App.tsx`: montar `<AuthProvider>` envolviendo `<RouterProvider router={router} />`, en lugar de renderizar `<DesignSystem />` directamente.
- [x] 6.3 Confirmar que `DesignSystem` ya no es el home y que sigue accesible en `/design-system` sin cambios en su contenido.

## 7. Sidebar colapsable en desktop (capability `app-shell`, requirement adicional)

- [x] 7.1 RED: test de `AppShell` — al hacer click en el botón de colapsar, los ítems de nav dejan de mostrar el `label` de texto (solo íconos); al hacer click en expandir, vuelve a mostrarlo. Debe fallar.
- [x] 7.2 GREEN: agregar estado `collapsed` (`useState`, inicializado leyendo `localStorage`) a `frontend/src/app/AppShell.tsx`; botón toggle en el sidebar (junto al título) que alterna el estado; en colapsado, ancho del `aside` pasa de 272px a ~72px y se ocultan las etiquetas de texto de `NavLink`. Correr el test de 7.1 hasta que pase.
- [x] 7.3 RED: test — cada `NavLink` en modo colapsado expone el nombre del módulo vía `aria-label` o `title` (accesible aunque no se vea el texto). Debe fallar.
- [x] 7.4 GREEN: agregar `aria-label={route.label}` (o `title`) a cada `NavLink` cuando `collapsed` es `true`. Correr el test de 7.3 hasta que pase.
- [x] 7.5 RED: test — el estado colapsado se persiste en `localStorage` bajo una clave propia (ej. `sidebar-collapsed`) y se lee al montar. Debe fallar.
- [x] 7.6 GREEN: leer/escribir esa clave de `localStorage` al togglear y al inicializar el estado. Correr el test de 7.5 hasta que pase.
- [x] 7.7 Confirmar que el toggle de colapso NO se renderiza (o no tiene efecto visual) en el drawer mobile (`className="md:hidden"` ya existente para el botón hamburguesa) — el colapso es un comportamiento de desktop, no reemplaza el drawer off-canvas.

## 9. Verificación

- [x] 9.1 Correr `npm run test` — toda la suite (2.1, 3.2, 4.1, 5.1, 5.3, 7.1, 7.3, 7.5) en verde.
- [x] 9.2 Verificar `tsc --noEmit` (o `npm run build`) sin errores y `oxlint` limpio (sin `any`, imports usados).
- [x] 9.3 Verificar manualmente el flujo autenticado: arranca logueado → Dashboard es el home → navegar entre módulos muestra placeholders dentro del shell → ítem activo se resalta → `/design-system` muestra la vitrina.
- [ ] 9.4 Verificar el flujo del guard: `signOut()` → cualquier ruta protegida redirige a `/login` → confirmar login (`signIn()`) → vuelve a la app; y que visitar `/login` ya logueado redirige al Dashboard.
- [ ] 9.5 Verificar manualmente el colapso: togglear a colapsado, recargar la página, confirmar que se mantiene colapsado; togglear a expandido de nuevo.
