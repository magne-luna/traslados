# Proposal: auth-frontend-real — Supabase Auth real + gestión de cuentas y permisos

> Contraparte frontend (fase **FE-8**) del change backend `C-02-usuarios-permisos-auditoria`, que
> explícitamente dejó el frontend fuera de su alcance. **Governance: CRÍTICO** (auth/permisos) —
> este documento es análisis y propuesta; la implementación requiere aprobación humana explícita.

## Why

Hoy el frontend **no tiene autenticación**. `AuthContext.tsx` mantiene un `FAKE_SESSION` en memoria
y, salvo que se defina `VITE_DEMO_MODE=true` (variable no versionada, sin `.env` en el repo), la app
**arranca ya logueada**: cualquiera que abra la URL entra sin ninguna barrera. `LoginPage.tsx` tiene
las credenciales precargadas como `defaultValue` y su `handleSubmit` **ni siquiera lee los campos**
— llama `signIn()` incondicionalmente. `RequireAuth.tsx` solo comprueba presencia de sesión, sin
noción de módulos ni niveles. Y `signOut()` no está cableado a ningún control de la interfaz: **no
existe forma de cerrar sesión**.

El backend que resuelve todo esto ya está implementado y desplegado en el proyecto Supabase real
(`pkryfoljypuzfifofdwp`): schemas `usuarios`/`modulos`/`auditoria`, RLS, `modulos.tiene_permiso()`,
y las Edge Functions `create-user` y `update-permisos`. El contrato está congelado y documentado en
`openspec/changes/C-02-usuarios-permisos-auditoria/design.md`. Falta consumirlo.

Mientras esto no se haga, **todas las pantallas ya construidas (8 módulos, ~190 tests) son
públicas de facto**, y la administradora no tiene ninguna manera de dar de alta cuentas ni de
decidir quién ve qué. Es el único bloqueante real entre el frontend actual y algo desplegable.

## What Changes

### Sesión real (reemplazo del mock)

- **BREAKING** — `AuthContext` deja de ser un mock en memoria y pasa a envolver Supabase Auth:
  `signInWithPassword`, `signOut`, restauración de sesión al montar y suscripción a
  `onAuthStateChange` (refresh de token, logout en otra pestaña, expiración).
- **BREAKING** — la firma de `useAuth()` cambia: `signIn()` (sin argumentos, síncrono) pasa a
  `signIn(email, password): Promise<Result>`, y el valor del contexto incorpora un estado
  `'loading' | 'authenticated' | 'anonymous'`, el perfil (`usuarios.usuarios`) y el mapa de
  permisos por módulo. Todos los consumidores y sus tests se actualizan.
- Se introduce un **estado de carga explícito**: hoy la restauración de sesión es síncrona porque
  es falsa; con Supabase es asíncrona, y sin este estado un refresh de página expulsaría al usuario
  a `/login` antes de que la sesión se rehidrate.
- El perfil y los permisos se leen **de la base de datos** (`usuarios.usuarios`,
  `modulos.permisos` × `modulos.modulos`), **nunca** de `user_metadata` del JWT.
- **Eliminación del hack de demo**: se borran `DEMO_EMAIL`/`DEMO_PASSWORD` y los `defaultValue` de
  `LoginPage.tsx`, y el chequeo de `VITE_DEMO_MODE` de `AuthContext.tsx` (pendiente registrado en
  `CHANGES.md` bajo C-02). Con Supabase Auth real la sesión nunca arranca "logueada por defecto".

### Login real

- `LoginPage` valida credenciales contra Supabase: lee email/contraseña del formulario, muestra
  estados de carga y error (credenciales inválidas, red caída, cuenta inexistente), y solo navega
  al destino tras un login efectivo.
- Se preserva el destino original: quien entra a `/facturacion` sin sesión vuelve a `/facturacion`
  después de loguearse, no al Dashboard.

### Guard con permisos reales

- `RequireAuth` pasa a distinguir **no autenticado** (→ `/login`) de **autenticado sin permiso
  sobre el módulo** (→ pantalla de acceso denegado dentro del shell, no un redirect silencioso).
- Se define el **mapeo ruta → módulo**: los 8 rutas del frontend contra los 4 módulos reales
  seedeados (`pacientes`, `obra_social`, `facturacion`, `conductores`) — ver `design.md`.
- La navegación del `AppShell` oculta los módulos sin permiso (no basta con bloquear la ruta: un
  menú lleno de callejones sin salida es peor UX que un menú corto).
- Se agrega el **control de cerrar sesión**, hoy inexistente.

### Pantalla de cuentas y matriz de permisos (nueva)

- Nueva ruta admin-only `/cuentas`: listado de cuentas (`usuarios.usuarios`), alta de cuenta vía
  Edge Function `create-user`, y **matriz de permisos** (cuenta × 4 módulos × nivel
  `read`/`write`/`admin`/sin acceso) que se guarda vía Edge Function `update-permisos`
  (semántica de reemplazo total).
- Toda escritura pasa por las Edge Functions ya existentes — el frontend **no** escribe
  `modulos.permisos` directamente, aunque la RLS de admin se lo permitiría.

### Fuera de alcance (explícito)

- **Todo el backend**: migraciones, RLS, triggers, Edge Functions. Ya está hecho y desplegado
  (C-02). Este change **no toca `supabase/`**.
- **Reemplazo de los repositorios mock de dominio** (`PacienteRepository`, `FacturaRepository`,
  etc.) por implementaciones Supabase: es el resto de la tabla FE-8, un change por módulo.
- **Gateo por nivel de escritura dentro de cada pantalla** (deshabilitar "Guardar" para quien tiene
  solo `read`): este change entrega el hook `usePermiso(modulo, nivel)` y el gate a nivel de ruta;
  el cableado botón por botón se hace en la integración de cada módulo. Ver Open Questions.
- **Recuperación de contraseña / cambio de contraseña propio**: ver Open Questions.
- **Visor de la bitácora de auditoría** (`auditoria.logs`): existe backend, pero es una pantalla
  aparte y no bloquea el acceso al sistema.

## Capabilities

### New Capabilities

- `auth-supabase`: sesión real contra Supabase Auth — login con credenciales, logout, restauración
  y refresh de sesión, estado de carga, y derivación del perfil/rol desde `usuarios.usuarios`
  (nunca desde el JWT).
- `permisos-modulo-frontend`: modelo de permisos en el cliente — carga de `modulos.permisos`,
  mapeo ruta→módulo, jerarquía de niveles `read < write < admin`, hook `usePermiso()`, y filtrado
  de la navegación.
- `cuentas-gestion`: pantalla de administración de cuentas y matriz de permisos, consumiendo
  `create-user` y `update-permisos`.

### Modified Capabilities

- `auth-mock`: **REMOVED** en su totalidad. Sus tres requisitos ("sesión activa por defecto",
  "alternar estado con `signIn()`/`signOut()` sin argumentos", "guardar solo autenticación, no
  roles") quedan explícitamente derogados y sustituidos por `auth-supabase` +
  `permisos-modulo-frontend`. El propio spec anticipaba esto: *"los permisos flexibles por cuenta
  son responsabilidad del backend real (C-02) y se incorporan en FE-8"*.
- `route-guard`: MODIFIED — el guard pasa de "solo autenticación" a "autenticación + permiso por
  módulo"; el login pasa de mock a validación real de credenciales.
- `app-routing`: MODIFIED — se agrega la ruta `/cuentas` (admin-only) al router.
- `app-shell`: MODIFIED — la navegación se filtra por permisos y se agrega el control de cierre de
  sesión y la identidad del usuario logueado.

## Impact

### Código afectado

| Ruta | Acción |
|---|---|
| `frontend/src/shared/auth/AuthContext.tsx` | Reescritura completa (mock → Supabase) |
| `frontend/src/shared/auth/useAuth.ts` | Firma extendida |
| `frontend/src/shared/auth/RequireAuth.tsx` | Reescritura (auth + permiso de módulo) |
| `frontend/src/features/auth/LoginPage.tsx` | Reescritura del submit; borrado del hack de demo |
| `frontend/src/shared/auth/*.test.tsx`, `features/auth/LoginPage.test.tsx` | Reescritos |
| `frontend/src/shared/lib/auth/` | **Nuevo** — `AuthRepository` + implementación Supabase + mock |
| `frontend/src/shared/lib/cuentas/` | **Nuevo** — `CuentaRepository` (Edge Functions + lecturas) |
| `frontend/src/features/cuentas/` | **Nuevo** — pantalla de cuentas + matriz de permisos |
| `frontend/src/shared/types/usuario.ts` | **Nuevo** — `Usuario`, `Rol`, `Modulo`, `NivelAcceso`, `Permiso` |
| `frontend/src/app/router.tsx`, `routes.ts`, `AppShell.tsx` | Ruta `/cuentas`, filtrado de nav, logout |
| `frontend/src/shared/lib/supabaseClient.ts` | Validación de env vars ausentes (hoy `createClient` revienta sin mensaje útil) |
| `frontend/.env.example` | **Nuevo** — no hay ningún `.env` versionado en el repo |
| `CHANGES.md`, `ROADMAP-FRONTEND.md` | Marcar la fila C-02/FE-8 y borrar la nota del hack de demo |

**No se toca**: `supabase/migrations/`, `supabase/functions/`, ni ninguna pantalla de los 8 módulos
de dominio.

### Dependencias

- **`C-02-usuarios-permisos-auditoria` (dependencia blanda)** — el contrato que consume este change
  (Edge Functions, tablas, RLS) está **implementado y desplegado**; las tareas 4.1/4.2 (push de
  migraciones y deploy de funciones) están cerradas. Quedan abiertas 4.3 (crear la cuenta real de
  Andrea + `UPDATE ... SET rol = 'admin'` manual), 4.4 (verificación manual) y 5.2 (sincronizar la
  KB). **Ninguna bloquea el desarrollo** — la API es estable y se puede implementar contra ella.
  Pero **4.3 sí bloquea la verificación end-to-end**: sin una cuenta `admin` real no hay forma de
  probar `/cuentas` ni el flujo de login contra el proyecto real.
- `C-01-foundation-setup` (archivado) — `supabaseClient.ts` ya existe.

### Riesgo de regresión

Los ~190 tests existentes se ejecutan hoy con la sesión mock siempre activa. Cambiar la firma de
`useAuth()` y el estado inicial del provider puede romper cualquier test que monte el router
completo. **Mitigación**: un helper de test (`renderConSesion(...)`) que inyecte un
`mockAuthRepository` con perfil y permisos configurables, para que cada test declare qué acceso
tiene el usuario en vez de asumir "admin implícito".

### Rollback

El change es aditivo sobre archivos aislados y no toca datos ni el backend: revertir el commit
restaura el mock sin migraciones inversas ni pérdida de información. La única acción externa
irreversible sería crear cuentas reales desde `/cuentas` — mitigable verificando primero contra
una cuenta de prueba antes de dar de alta al personal real.

## Open Questions — RESUELTAS (2026-07-29, confirmado con Andrea/Delfina)

1. **`/hojas-de-ruta` no tiene módulo propio** entre los 4 seedeados. **Resuelto**: se gatea por
   `conductores` (planificación de flota — recorridos = asignación de vehículo/conductor). Mismo
   criterio aplicado de forma consistente a las 8 pantallas contra el mapeo que ya usó Enzo en
   `seed_modulos.sql` (docx: "Vehículo/Mantenimiento/Documentación vehicular" y
   "Presupuesto/Autorización/Cobros/Gastos" caen en un solo módulo cada uno, no uno por pantalla):

   | Pantalla | Módulo |
   |---|---|
   | `/pacientes` | `pacientes` |
   | `/obras-sociales` | `obra_social` |
   | `/conductores` | `conductores` |
   | `/vehiculos` | `conductores` |
   | `/hojas-de-ruta` | `conductores` |
   | `/presupuestos` | `facturacion` |
   | `/facturacion` | `facturacion` |
   | `/` (Dashboard) | sin gate — ver punto 2 |
   | `/cuentas` (nueva) | solo `rol = admin`, no pasa por módulo |

2. **`/` (Dashboard) agrega datos de todos los módulos.** **Resuelto**: sin gate propio — visible
   para cualquier autenticado, la RLS de cada tabla subyacente ya recorta los datos según permisos.
   Sigue la intención original documentada en `seed_modulos.sql` ("dashboard" deliberadamente NO es
   un módulo — C-11 es pura agregación de lectura sin tabla propia).
3. **Gateo de escritura por nivel**: **Resuelto**: solo el hook `usePermiso(modulo, nivel)` y el
   gate a nivel de ruta en este change. El cableado botón por botón en las 8 pantallas existentes
   queda para la integración de cada módulo (FE-8 por módulo).
4. **Contraseñas**: **Resuelto**: no entra en este change. Solo alta con password inicial fijada
   por el admin vía `create-user`. Cambiar/recuperar contraseña queda para un change aparte.
5. **Baja de cuentas**: **Resuelto**: la pantalla de cuentas revoca todos los permisos llamando a
   `update-permisos` con un array vacío — la cuenta queda sin acceso a ningún módulo pero sigue
   existiendo (reversible, no requiere tocar `supabase/`). Bloqueo real de login queda para un
   endpoint de backend aparte, si hiciera falta.
6. **Exposición de datos**: **Resuelto**: `"Users can read all profiles" USING (true)` es
   intencional — equipo interno de 4 personas, no es dato sensible. Además, solo Andrea (admin)
   tiene acceso a `/cuentas`, así que el riesgo de exposición vía esa pantalla es nulo de todos
   modos. Se construye asumiendo esto, sin cambios de RLS.
