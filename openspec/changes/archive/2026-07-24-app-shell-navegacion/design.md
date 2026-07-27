## Context

Parte de FE-0 que quedó sin hacer (`ROADMAP-FRONTEND.md` línea 27). El frontend hoy es una SPA React 19 + TypeScript strict + Tailwind v4 (Vite) cuyo `App.tsx` solo renderiza `<DesignSystem />`. No hay router instalado (`package.json` no tiene ninguna dependencia de routing) ni archivos de shell/nav/layout/guard en `frontend/src/`.

Lo que sí existe y se reutiliza:
- Design system: primitivos en `frontend/src/design-system/components.tsx` (`Section`, `Swatch`, `Button`, `Chip`, `NavIcon`) con estilo inline vía `tokens.ts`. La vitrina `DesignSystem.tsx` los cataloga.
- Patrón FE-1 **contrato → mock → hook → componente**: `DocumentoRepository` + `mockDocumentoRepository` + `useDocumentChecklist` + `DocumentChecklist`. `useAuth()` sigue el mismo espíritu de "mock hoy, adaptador real después".

Este change va **antes** de `obras-sociales-ui` (ya propuesto), que necesita un shell donde montarse y una ruta a la que apuntar.

Restricciones duras del proyecto (CLAUDE.md, no negociables): TypeScript strict, prohibido `any` (usar `unknown` + narrowing); todo mock, sin Supabase real todavía; Conventional Commits. Auth con **permisos flexibles por módulo, sin roles fijos** (`03_actores_y_roles.md`) — importante para NO sobre-diseñar el guard. Estructura de carpetas por feature (`src/features/*`) según `08_arquitectura_propuesta.md`.

## Goals / Non-Goals

**Goals:**
- Instalar y configurar routing (`react-router` v7) y dejar `App.tsx` como punto de composición (auth provider + router).
- Shell con navegación lateral reutilizando el design system, con marca de ítem activo y responsive (RNF-08).
- Rutas placeholder para los ocho módulos del roadmap, más `/design-system` y `/login`.
- `useAuth()` mock en memoria (logueado por default, con `signIn`/`signOut`) que se reemplace por Supabase Auth en FE-8 sin tocar consumidores.
- Guard de solo-autenticación que redirige a login mock cuando no hay sesión.

**Non-Goals:**
- Supabase Auth real, sesiones persistentes, tokens (es `C-02` backend, FE-8).
- Roles y permisos por módulo (el modelo del proyecto es permiso flexible por cuenta, lo resuelve el backend; acá NO se diseña).
- Contenido funcional de cada módulo (cada FE-N reemplaza su placeholder).
- Librería de estado global (no hace falta para este alcance; el auth mock usa Context).

## Decisions

### Decisión 1 — Routing con `react-router` v7 (`createBrowserRouter`, data router)
Se adopta `react-router` v7 (el paquete unificado sucesor de `react-router-dom`) con la API de data router (`createBrowserRouter` + `<RouterProvider>`). Motivos: es la opción estándar y con mayor soporte para una SPA React; el data router expone rutas anidadas con `<Outlet>` (ideal para shell + hijas) y `loader`/`redirect` que servirán cuando FE-8 traiga auth real (redirecciones de guard como `loader` en vez de solo en render). Se define la config en `frontend/src/app/router.tsx` y la lista declarativa de módulos (path, etiqueta, ícono) en `frontend/src/app/routes.ts`, para que cada FE-N solo cambie el `element` de su ruta.
- **Alternativas descartadas:** `@tanstack/router` (type-safety superior pero otra curva y dependencia menos ubicua para un equipo que ya asume react-router en el ROADMAP); routing casero con `useState`+`history` (frágil, reinventa anidamiento y guards). El ROADMAP menciona explícitamente "react-router o similar".

### Decisión 2 — Navegación lateral (sidebar), no topbar
Se elige **sidebar** para la navegación principal. Motivo: es un sistema interno de gestión con **ocho módulos** de primer nivel; una barra lateral escala mejor a muchos ítems, deja el ancho para tablas densas (varios módulos son CRUD/listados) y es el patrón convencional de back-office. El design system ya expone `NavIcon`, pensado para ítems de navegación con ícono.
- **Alternativa descartada:** topbar horizontal — se queda corta con ocho ítems + estados; obliga a menús desplegables. **Nota (Open Question):** el prototipo de referencia (`prototype.html`) que la tarea cita como validado visualmente con el usuario **no se encontró en el repo** (referenciado en un comentario de `DesignSystem.tsx` como `../../prototype.html`, pero el archivo no existe en disco). La elección de sidebar se toma por criterio de back-office multi-módulo; **confirmar contra el prototipo** cuando esté disponible antes de invertir en estética del shell.

### Decisión 3 — `useAuth()` como Context en memoria, solo autenticación
El auth mock se implementa con React Context: `AuthProvider` mantiene `session: Session | null` en `useState` (arranca con una sesión falsa → logueado por default) y expone `{ session, signIn, signOut }`. `useAuth()` lanza error si se usa fuera del provider (falla explícita, no estado ambiguo). El estado es **solo presencia/ausencia de sesión + usuario falso**, sin roles ni permisos: el proyecto usa permiso flexible por cuenta que resuelve el backend (`03_actores_y_roles.md`), así que modelar roles ahora sería sobre-diseño que habría que rehacer.
- **Tipos:** `interface Session { user: { id: string; nombre: string; email: string } }` (forma mínima, tipada; sin `any`). El día de Supabase Auth (FE-8), `AuthProvider` se reimplementa sobre el cliente real cumpliendo el mismo `useAuth()`; los consumidores (guard, shell) no cambian.
- **Alternativa descartada:** persistir la sesión en `localStorage` — innecesario para un mock cuyo default es "logueado"; se puede sumar después si molesta re-loguear en pruebas. Se deja como Open Question menor.

### Decisión 4 — Guard como wrapper de ruta (`RequireAuth`) que redirige a `/login`
El guard es un componente `RequireAuth` que envuelve el árbol de rutas protegidas: si `useAuth().session` es `null`, hace `<Navigate to="/login" replace />`; si hay sesión, renderiza `<Outlet>`. Simétricamente, `/login` redirige al Dashboard si ya hay sesión. Solo chequea autenticación (coherente con Decisión 3). Las rutas públicas del proyecto son nulas (`03_actores_y_roles.md`: sistema interno, sin acceso público), así que **todo** cuelga del guard salvo `/login`.
- **Alternativa descartada:** guard por `loader`+`redirect` del data router — más idiomático para auth real (FE-8), pero con el mock en Context es más simple un wrapper de render; migrable a `loader` cuando la sesión venga de un origen asíncrono real. Se deja anotado.

### Decisión 5 — Placeholders vía un componente genérico `PlaceholderPage`
Los ocho módulos comparten una única `PlaceholderPage` parametrizada por nombre de módulo ("Obras Sociales — próximamente"), en vez de ocho archivos casi idénticos. Cada FE-N reemplaza el `element` de su ruta por su pantalla real. La `DesignSystem` existente se monta tal cual bajo `/design-system` (sin tocar su contenido).
- **Alternativa descartada:** ocho componentes vacíos desde ya — repetición sin valor; el placeholder único reduce ruido y deja el punto de reemplazo obvio en `routes.ts`.

### Decisión 6 — Estructura de carpetas
Siguiendo `08_arquitectura_propuesta.md` (por feature) y separando lo transversal: infraestructura de app en `frontend/src/app/` (`router.tsx`, `AppShell.tsx`, `routes.ts`), auth transversal en `frontend/src/shared/auth/` (`AuthContext.tsx`, `useAuth.ts`, `RequireAuth.tsx`), y las pantallas propias en `frontend/src/features/<modulo>/` (login mock en `features/auth/LoginPage.tsx`, placeholder genérico en `shared/components/PlaceholderPage.tsx`).

## Risks / Trade-offs

- **Sidebar elegida sin poder cotejar el prototipo** (no está en el repo) → Mitigación: la decisión es reversible (el shell aísla la navegación en `AppShell.tsx`); confirmar con el usuario / prototipo antes de pulir estética. Marcado como Open Question y a surfacear.
- **Divergencia futura entre el `useAuth()` mock y Supabase Auth real** → Mitigación: el contrato del hook (`session | null`, `signIn`, `signOut`) es mínimo y estable; el swap de FE-8 reimplementa el provider sin tocar consumidores. Guard migrable a `loader` cuando la sesión sea asíncrona.
- **`createBrowserRouter` requiere que el server sirva `index.html` en cualquier ruta (SPA fallback)** → En dev Vite ya lo hace; anotar para el deploy (RNF-01) que el hosting necesita rewrite a `index.html`. No bloquea este change (todo mock/dev).
- **Sesión no persistida: recargar con `signOut` previo vuelve a logueado** → Aceptable para un mock cuyo default es logueado; si estorba en pruebas del guard, se agrega persistencia (Open Question).

## Migration Plan

No hay migración de datos (frontend + mock). Secuencia de implementación: (1) instalar `react-router`; (2) `useAuth`/`AuthProvider`; (3) `routes.ts` + `PlaceholderPage`; (4) `AppShell` con navegación; (5) `RequireAuth` + `LoginPage`; (6) `router.tsx` componiendo todo; (7) `App.tsx` monta `AuthProvider` + `RouterProvider`, y `DesignSystem` pasa a `/design-system`.

Reemplazo futuro (FE-8, al archivarse `C-02` backend): reimplementar `AuthProvider` sobre Supabase Auth cumpliendo el mismo `useAuth()`, y extender el guard de solo-autenticación a permisos por módulo. Componentes de shell y pantallas no cambian.

## Open Questions

- **Sidebar vs. topbar**: confirmar contra `prototype.html` (no hallado en el repo) o con el usuario antes de pulir la estética del shell. La estructura funcional (nav + outlet + activo) no cambia con la respuesta.
- ¿Persistir la sesión mock en `localStorage` para no re-loguear entre recargas al probar el guard? (menor, no bloquea).
- ¿Migrar el guard a `loader`/`redirect` del data router ya, o recién en FE-8 cuando la sesión sea asíncrona? (se propone: recién en FE-8).
- Confirmar el set y orden final de módulos en la navegación y cuál es el home real (se asume Dashboard como inicio, según FE-7 del roadmap).
