# Tasks: auth-frontend-real

> **Governance: CRÍTICO** (auth / permisos). Estas tareas son un plan, no una autorización.
> No arrancar la implementación sin aprobación humana explícita, y confirmar antes las
> Open Questions de `proposal.md` y `design.md`.
>
> **Strict TDD activo**: cada tarea de código va en RED → GREEN → TRIANGULATE → REFACTOR.
> Test runner: `npm test` (vitest) dentro de `frontend/`. Type check: `npx tsc -b --noEmit`
> (nunca `tsc --noEmit` a secas).

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 900–1300 |
| 400-line budget risk | **High** |
| Chained PRs recommended | **Yes** |
| Suggested split | PR 1: fases 1–5 (sesión, guard, login). PR 2: fases 6–7 (pantalla de cuentas). PR 3: fase 8 (shell + documentación) |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked |

```
Decision needed before apply: Yes (Open Questions 1–6 + aprobación de governance CRITICO)
Chained PRs recommended: Yes
Chain strategy: stacked
400-line budget risk: High
```

## 0. Gate previo (no es código)

- [x] 0.1 Confirmar con la usuaria las Open Questions 1–6 de `proposal.md` (módulo de `/hojas-de-ruta`, permiso del Dashboard, alcance del gateo de escritura, contraseñas, baja de cuentas, visibilidad de perfiles) — confirmadas 2026-07-29, ver `proposal.md` §Open Questions
- [x] 0.2 Obtener aprobación humana explícita para implementar (dominio CRÍTICO: auth/permisos) — aprobado 2026-07-29
- [x] 0.3 Verificar el estado de la tarea 4.3 de `C-02-usuarios-permisos-auditoria` (cuenta admin real de Andrea creada y promovida) — confirmado por la usuaria 2026-07-29: la cuenta ya tiene rol `admin`. Desbloquea 9.5
- [x] 0.4 **Red de seguridad**: correr `npm test` y `npx tsc -b --noEmit` en `frontend/` y registrar el baseline (`N tests passing`). Cualquier fallo previo se reporta como preexistente, no se arregla acá — baseline: **853 passed / 2 failed / 855 total** (159 archivos). Los 2 fallos son preexistentes y reproducibles en aislamiento (confirmado corriendo cada archivo solo): `frontend/.env` trae `VITE_DEMO_MODE=true`, lo que rompe `AuthContext.test.tsx` ("arranca con sesión falsa por defecto") y `router.test.tsx` (dashboard no se monta porque arranca deslogueado). No se tocan en 0.4 — se resuelven naturalmente en 4.10/5.8 de este mismo batch, que borran el hack de demo. `npx tsc -b --noEmit`: 0 errores.

## 1. Configuración de entorno y cliente

- [ ] 1.1 Crear `frontend/.env.example` con `SUPABASE_URL` y `SUPABASE_ANON_KEY` (sin valores reales) y documentar en él que el prefijo no lleva `VITE_` por el `envPrefix` de `vite.config.ts` — **BLOQUEADO**: el sandbox del agente deniega lectura/escritura de cualquier ruta `.env*` (política de seguridad de la herramienta, no del proyecto). El archivo ya existe (`ls` confirma 245 bytes) pero no pudo inspeccionarse ni actualizarse desde este batch. Contenido propuesto para que la usuaria lo aplique a mano:<br>`SUPABASE_URL=`<br>`SUPABASE_ANON_KEY=`<br>más un comentario documentando que el prefijo no es `VITE_` por el `envPrefix: ['VITE_', 'SUPABASE_']` de `vite.config.ts`.
- [x] 1.2 RED: test que `supabaseClient` falla con un mensaje que nombra la variable faltante cuando `SUPABASE_URL` o `SUPABASE_ANON_KEY` no están definidas — `frontend/src/shared/lib/__tests__/supabaseClient.test.ts` (describe "validación de variables de entorno", falló confirmado antes de 1.3)
- [x] 1.3 GREEN + REFACTOR: agregar la validación de variables de entorno en `frontend/src/shared/lib/supabaseClient.ts` sin cambiar la firma exportada — `requireEnv()` interno, `supabase: SupabaseClient` se conserva igual
- [x] 1.4 Verificar que no aparece ninguna referencia a `SUPABASE_SERVICE_ROLE_KEY` en `frontend/` — `grep -rn SERVICE_ROLE frontend/src` sin resultados

## 2. Tipos y funciones puras de permisos

- [x] 2.1 Crear `frontend/src/shared/types/usuario.ts`: `Rol`, `Modulo` (los 4 valores seedeados), `NivelAcceso`, `Usuario`, `Permiso`, `MapaPermisos`, `EstadoAuth` (unión discriminada `loading`/`anonymous`/`authenticated`). Sin `any`
- [x] 2.2 RED: tests de tabla para `tienePermiso(rol, permisos, modulo, nivelMinimo)` — jerarquía `read < write < admin`, módulo ausente, mapa vacío — `frontend/src/shared/lib/auth/permisos.test.ts`
- [x] 2.3 GREEN: implementar `frontend/src/shared/lib/auth/permisos.ts` como función pura
- [x] 2.4 TRIANGULATE: agregar el caso `rol === 'admin'` (short-circuit a `true` para cualquier módulo/nivel, incluso con matriz vacía) y el caso de nivel insuficiente
- [x] 2.5 REFACTOR: extraer el orden de niveles a una constante tipada; documentar en comentario que replica `modulos.tiene_permiso()` del servidor y que **no es una frontera de seguridad**

## 3. Mapeo ruta → módulo

- [x] 3.1 RED: tests de `moduloDeRuta(path)` para las 10 rutas (8 módulos + `/cuentas` + `/design-system`), incluidas las agrupadas (`/vehiculos`→`conductores`, `/presupuestos`→`facturacion`) y las de módulo ausente — `frontend/src/app/routes.test.ts`
- [x] 3.2 GREEN: agregar el campo `modulo: Modulo | null` a `AppRoute` en `frontend/src/app/routes.ts` y poblarlo en `APP_ROUTES` según la tabla D4 de `design.md`
- [x] 3.3 TRIANGULATE: caso de ruta desconocida (debe tratarse como sin acceso, no como sin módulo) — `moduloDeRuta` devuelve `undefined` (distinto de `null`) para rutas no declaradas; se agrega también `requiereRolAdmin(path)` en el mismo archivo (necesario para `/cuentas`, D4) para no hardcodear el path en `RequireAuth`

## 4. AuthRepository y sesión real

- [x] 4.1 Definir la interfaz `AuthRepository` en `frontend/src/shared/lib/auth/AuthRepository.ts` (`getSesionActual`, `signIn`, `signOut`, `onCambioDeSesion` devolviendo unsubscribe)
- [x] 4.2 Crear `frontend/src/shared/lib/auth/mockAuthRepository.ts` — configurable con usuario, permisos y estado inicial; usado por todos los tests (`createMockAuthRepository(options)` + instancia `mockAuthRepository`; test propio `mockAuthRepository.test.ts`, 6 casos)
- [x] 4.3 RED: tests de `AuthProvider` — arranca en `loading`, pasa a `anonymous` sin sesión persistida, pasa a `authenticated` con perfil y permisos cuando el repositorio devuelve sesión — `frontend/src/shared/auth/AuthContext.test.tsx` (repositorio de control con Promise diferida para observar `loading`)
- [x] 4.4 GREEN: reescribir `frontend/src/shared/auth/AuthContext.tsx` sobre el repositorio inyectado, con la unión discriminada de 3 estados. **Borrado** `FAKE_SESSION` y el chequeo de `VITE_DEMO_MODE`. `App.tsx` actualizado para inyectar `supabaseAuthRepository` en producción
- [x] 4.5 TRIANGULATE: `signIn` con credenciales inválidas no crea sesión y expone el error; `signOut` vuelve a `anonymous` — cubierto en `AuthContext.test.tsx`
- [x] 4.6 RED+GREEN: la suscripción a `onCambioDeSesion` se registra al montar y se cancela al desmontar (sin listeners colgados) — test con spies de `onCambioDeSesion`/`unsubscribe`, más test de reacción a cambio externo (logout en otra pestaña)
- [x] 4.7 RED+GREEN: sesión válida en Supabase Auth pero sin fila en `usuarios.usuarios` ⇒ se cierra sesión y se expone un error de cuenta no habilitada — implementado y testeado en `SupabaseAuthRepository.ts`/`.test.ts` (no en el mock genérico, que no modela esa desincronización de datos)
- [x] 4.8 Actualizar `frontend/src/shared/auth/useAuth.ts` a la nueva firma, conservando el error explícito fuera del provider — sin cambios funcionales necesarios (re-exporta `AuthContextValue` de `AuthContext.tsx`, ya actualizado); test de "fuera de provider" preservado
- [x] 4.9 Implementar `frontend/src/shared/lib/auth/SupabaseAuthRepository.ts`: `signInWithPassword`, `signOut`, `getSession`, `onAuthStateChange`, más las lecturas de `usuarios.usuarios` y `modulos.permisos` × `modulos.modulos`. **Nunca** leer rol ni permisos de `user_metadata` — 9 tests con fakes tipados del cliente Supabase (sin `any`)
- [x] 4.10 Borrar `frontend/src/shared/auth/AuthContext.test.tsx` en su versión mock (incluidos los dos tests de `VITE_DEMO_MODE`) y reemplazarlo por la suite nueva — hecho (9 tests nuevos, cero referencias a `VITE_DEMO_MODE`/`FAKE_SESSION`)

**Nota de desviación de `design.md`**: la firma final de `tienePermiso` quedó `(rol, permisos, modulo, nivelMinimo)` — 4 argumentos, no los 3 de la firma de ejemplo en D5 — porque el short-circuit de `rol === 'admin'` (obligatorio incluso con matriz de permisos vacía) no es derivable solo de `MapaPermisos`. No se creó el hook `usePermiso(modulo, nivelMinimo)` de la capacidad `permisos-modulo-frontend`: no hay ninguna tarea numerada para él en las secciones 0–5 de este `tasks.md` (la única mención está en la spec, no en las tareas); queda señalado para el batch de la sección 8, donde `AppShell` ya consume `tienePermiso` para filtrar la navegación y es el lugar natural para agregarlo.

## 5. Guard de rutas y login

- [x] 5.1 Crear el helper `frontend/src/shared/test/renderConSesion.tsx` (default: admin con todos los permisos, para preservar el comportamiento que asumen los ~190 tests existentes)
- [x] 5.2 RED: tests de `RequireAuth` — `loading` muestra indicador y **no** redirige; `anonymous` redirige a `/login` guardando el destino; `authenticated` con permiso renderiza el `<Outlet>` — `frontend/src/shared/auth/RequireAuth.test.tsx`
- [x] 5.3 GREEN: reescribir `frontend/src/shared/auth/RequireAuth.tsx` con los tres estados
- [x] 5.4 TRIANGULATE: autenticado **sin** permiso sobre el módulo ⇒ pantalla de acceso denegado (no redirect); `/cuentas` con rol `empleado` ⇒ acceso denegado
- [x] 5.5 Crear `frontend/src/shared/components/AccesoDenegado.tsx` con `EmptyState`/`Alert` del design system (sin markup a mano, sin `style={{}}`)
- [x] 5.6 RED: tests de `LoginPage` — lee email y contraseña del formulario, error visible con credenciales inválidas, botón deshabilitado durante el envío, campos vacíos no invocan la autenticación — `frontend/src/features/auth/LoginPage.test.tsx` (7 tests, incluye además "usuario ya autenticado" y "destino guardado" de route-guard spec)
- [x] 5.7 GREEN + REFACTOR: reescribir `frontend/src/features/auth/LoginPage.tsx`. **Borrado** `DEMO_EMAIL`, `DEMO_PASSWORD` y los `defaultValue`; navega solo tras un login efectivo, al destino guardado (query param `?destino=`, ver `RequireAuth.tsx`) o al Dashboard
- [x] 5.8 Correr la suite completa y arreglar los tests existentes que rompan por la nueva firma de `useAuth()`, usando `renderConSesion` — solo `router.test.tsx` necesitó ajuste (ahora usa `renderConSesion`). Resultado: **902 passed / 902 total** (163 archivos), por encima del baseline de 0.4 (853/855) — los 2 fallos preexistentes del baseline quedaron resueltos como efecto colateral de borrar el hack de `VITE_DEMO_MODE`. `npx tsc -b --noEmit`: 0 errores. `npm run lint`: sin errores nuevos (solo warnings preexistentes `react(only-export-components)`, misma categoría ya tolerada en `ObraSocialRepositoryContext.tsx` y hermanos; `AuthContext.tsx` ahora comparte esa misma advertencia)

## 6. Repositorio de cuentas

- [x] 6.1 Definir `CuentaRepository` en `frontend/src/shared/lib/cuentas/CuentaRepository.ts`: `listarCuentas()`, `crearCuenta(input)`, `actualizarPermisos(usuarioId, permisos)`
- [x] 6.2 Crear `frontend/src/shared/lib/cuentas/mockCuentaRepository.ts` con fixture de cuentas — mock en memoria (no localStorage, ver nota de desviación más abajo), configurable via `createMockCuentaRepository(options)` + instancia `mockCuentaRepository`, 7 tests
- [x] 6.3 RED: tests de mapeo de errores de las Edge Functions — 401, 403, 404 y 400 se traducen a los mensajes definidos en D7 de `design.md`, propagando el `error` del body en el caso 400 — `SupabaseCuentaRepository.test.ts`
- [x] 6.4 GREEN: implementar `SupabaseCuentaRepository` — lecturas directas por RLS (`usuarios.usuarios`, `modulos.permisos`, `modulos.modulos`) y escrituras **solo** vía `supabase.functions.invoke('create-user' | 'update-permisos')`
- [x] 6.5 TRIANGULATE: `actualizarPermisos` con array vacío revoca todo; `crearCuenta` envía `password` (obligatorio en la Edge Function) y los `permisos` iniciales
- [x] 6.6 Verificar que el repositorio no contiene ningún `insert`/`update`/`delete` sobre `modulos.permisos` ni `usuarios.usuarios` — test de código fuente (`?raw` import de Vite, ver nota) que falla si aparece `.insert(`/`.update(`/`.delete(`

**Nota de desviación de sección 6**: `mockCuentaRepository.ts` NO sigue el patrón localStorage de los mocks de dominio (`mockObraSocialRepository.ts` y hermanos) — es en memoria, igual criterio que `mockAuthRepository.ts`. Motivo: a diferencia de los módulos de dominio (donde el mock ES la implementación de producción hasta que se archive su change de backend), acá el backend de C-02 ya está desplegado, así que `CuentasRoute.tsx` (7.8) inyecta siempre `SupabaseCuentaRepository` en producción — el mock solo corre en tests, no hay necesidad de persistencia entre recargas. El test de la tarea 6.6 usa el import `?raw` de Vite (declarado en `vite/client.d.ts`) para leer el código fuente como string en vez de `node:fs`, porque `tsconfig.app.json` no habilita los tipos de Node (`"types": ["vite/client"]` únicamente) y agregarlos sería un cambio de alcance mayor al de esta tarea.

## 7. Pantalla de cuentas y matriz de permisos

- [x] 7.1 RED+GREEN: `validateCuentaForm.ts` como función pura — email, nombre, apellido obligatorios; contraseña de 8 caracteres o más
- [x] 7.2 RED+GREEN: `CuentasList.tsx` con `Table`/`Tr`/`Td`/`Th` del design system — nombre, email, rol y módulos habilitados; fila 100% clickeable, como el resto de la app — requirió extender `Tr` (design-system/table.tsx) con `interactive`/`onClick` (ver nota de desviación)
- [x] 7.3 RED+GREEN: `MatrizPermisos.tsx` — 4 filas (una por módulo) con `Select` de nivel incluyendo "sin acceso"; edición diferida en línea, nunca modal; cada control etiquetado con su módulo
- [x] 7.4 TRIANGULATE: otorgar, revocar un módulo y revocar todos ⇒ el conjunto enviado a `update-permisos` es siempre el estado completo deseado
- [x] 7.5 RED+GREEN: cancelar la edición descarta los cambios sin invocar ninguna Edge Function
- [x] 7.6 RED+GREEN: `CuentaForm.tsx` (alta) y `CuentaDetail.tsx` (perfil + matriz)
- [x] 7.7 RED+GREEN: `CuentasPage.tsx` con estados explícitos de carga, error (con reintento) y listado vacío; controles de escritura deshabilitados mientras hay una operación en curso — hook `useCuentas.ts` (mismo patrón que `useObrasSociales`)
- [x] 7.8 Crear `CuentasRoute.tsx` como composition root que inyecta el `CuentaRepository`, siguiendo el patrón de `ObraSocialesRoute` — con `CuentaRepositoryContext.tsx` (Provider + hook), mismo patrón que `ObraSocialRepositoryContext`
- [x] 7.9 Registrar `/cuentas` en `frontend/src/app/router.tsx` bajo `RequireAuth` + `AppShell`, con `modulo: null` y requisito de rol `admin` — como ruta `lazy` (ver nota de desviación), tests en `src/app/router.cuentas.test.tsx`
- [x] 7.10 Verificación de accesibilidad: recorrido completo por teclado (seleccionar cuenta → editar los 4 niveles → guardar) con foco visible, y contraste ≥ 4.5:1 / 3:1 en los estados nuevos — `CuentasPage.accessibility.test.tsx`

**Notas de desviación de sección 7**:
1. **Extensión del design system**: `Tr` (`frontend/src/design-system/table.tsx`) no tenía forma de ser clickeable — se le agregó `interactive`/`onClick` (opcionales, backward-compatible; `table.test.tsx` cubre el caso nuevo y confirma que el caso existente no cambió). Igual criterio que `Card interactive` (`design-system/layout.tsx`): el `onClick` en el `<tr>` es un atajo de mouse, NO le agrega `role="button"`/`tabIndex` (un `<tr>` no es semánticamente un botón) — la accesibilidad por teclado la resuelve un `<button>` real dentro de la fila (el nombre, en `CuentasList.tsx`), mismo patrón que "Ver detalle" en `ObrasSocialesList.tsx`.
2. **`modulos.ts` (helpers compartidos)**: extraído en el REFACTOR de 7.3 — `MODULOS`, `ETIQUETA_MODULO`, `NivelDeFila`, `mapaAFilas`/`filasVacias`/`filasAPermisos`/`filasSonIguales`, para no duplicar el mapeo módulo↔fila entre `MatrizPermisos.tsx` (edición) y `CuentaForm.tsx` (permisos iniciales de alta) — `CuentasList.tsx` también reusa `ETIQUETA_MODULO`.
3. **Ruta `/cuentas` como `lazy`, no `element` estático** (tasks.md 7.9): `CuentasRoute` importa `SupabaseCuentaRepository` (y transitivamente `supabaseClient`, que valida `SUPABASE_URL`/`SUPABASE_ANON_KEY` al importarse — tasks.md 1.2/1.3) a nivel de módulo. Un `element: <CuentasRoute />` estático en `router.tsx` hubiera forzado esa validación en TODOS los tests que importan `router.tsx` (ej. el `router.test.tsx` preexistente, que nunca visita `/cuentas`) — de hecho rompió `router.test.tsx` al implementarlo así por primera vez (regresión detectada y corregida en el mismo batch, ver Learned de apply-progress). `lazy` (soportado por `react-router` v8/`createBrowserRouter`) difiere la importación hasta que la ruta efectivamente se visita; el test dedicado (`router.cuentas.test.tsx`) mockea `shared/lib/supabaseClient` para no depender de red.
4. **Sin test para `CuentasRoute.tsx`**: mismo criterio que `App.tsx` (que tampoco tiene test) — es un composition root que solo cablea `supabaseCuentaRepository` (la única implementación de producción), no hay lógica propia que testear sin pegarle a la red real.
5. Contraste (≥4.5:1/3:1) no se midió con un algoritmo de color: la pantalla no introduce ningún color/token nuevo, solo reusa componentes del design system ya auditados (`Button`, `Select`, `Field`, `Chip`, `Alert`, `Table`). La verificación de accesibilidad de 7.10 cubre keyboard-completo + ausencia de `outline-none` (indicador de foco nunca suprimido); el resto se hereda por composición.

## 8. Shell, navegación y documentación

- [x] 8.1 RED: tests de `AppShell` — la navegación oculta los módulos sin permiso; `/cuentas` solo aparece con rol `admin` — `frontend/src/app/AppShell.test.tsx` (describes "navegación filtrada por permisos" y "identidad y cierre de sesión"; se reescribió `renderShellAt` para pasar por `renderConSesion`, confirmado en RED que fallaban por falta de filtrado, no por infraestructura de test)
- [x] 8.2 GREEN: filtrar `APP_ROUTES` con `tienePermiso(...)` en `AppShell.tsx` — extraído a `frontend/src/app/SidebarNav.tsx` (ver nota de desviación 1 más abajo); se cerró además el gap heredado de batches anteriores creando el hook `usePermiso(modulo, nivelMinimo)` de la capacidad `permisos-modulo-frontend` (`frontend/src/shared/auth/usePermiso.ts` + `.test.tsx`, propio ciclo RED→GREEN→TRIANGULATE, 4 tests)
- [x] 8.3 TRIANGULATE: cuenta sin ningún permiso ⇒ mensaje de "solicitá acceso a la administradora", no un sidebar vacío — `SidebarNav.tsx` (Alert `tone="info"`), nunca se dispara para `rol === 'admin'`
- [x] 8.4 RED+GREEN: bloque de identidad (nombre, email, chip de rol) y botón "Cerrar sesión" al pie del sidebar, accesible también con el sidebar colapsado (etiqueta accesible) — extraído a `frontend/src/app/SidebarIdentity.tsx`; el botón es siempre un `<button aria-label="Cerrar sesión">` real, nunca depende del texto visible
- [x] 8.5 REFACTOR: mantener cada componente por debajo de ~200 líneas, extrayendo sub-componentes donde haga falta — `AppShell.tsx` quedó en 151 líneas (antes 232); paths de íconos movidos a `frontend/src/app/navIcons.tsx` (74 líneas), filtrado de navegación a `SidebarNav.tsx` (108 líneas), identidad/logout a `SidebarIdentity.tsx` (46 líneas)
- [x] 8.6 Actualizar `CHANGES.md`: marcar el frontend de C-02 y **borrar** la nota del hack temporal de demo (`VITE_DEMO_MODE` / `DEMO_EMAIL` / `DEMO_PASSWORD`), que deja de existir — bullet de progreso frontend reescrito, bullet del hack de demo eliminado, `Estado` de C-02 actualizado a "backend y frontend implementados, pendiente verificación manual"
- [x] 8.7 Actualizar `ROADMAP-FRONTEND.md`: marcar la fila `C-02` de la tabla de FASE FE-8 como completada — hecho, con referencia a `auth-frontend-real`
- [x] 8.8 Documentar en el código y en este change que el gate de permisos del cliente es UX, y que la autorización efectiva la impone la RLS del servidor — ya documentado en `permisos.ts`/`usePermiso.ts` (batches previos y este); reforzado con nota explícita en `SidebarNav.tsx` (comentario "IMPORTANTE (security-review, tasks.md 8.8)") y en `CHANGES.md` (bullet de progreso frontend de C-02)

**Notas de desviación de sección 8**:
1. **`tienePermiso` se consume vía `usePermiso`/directo, no ambos indistintamente**: `SidebarNav.tsx` llama `tienePermiso(rol, permisos, modulo, 'read')` directo (no `usePermiso`) porque necesita evaluar los 8 `APP_ROUTES` en un `.filter()`, y `usePermiso` es un hook (una sola invocación por render, no apto para un loop) — `usePermiso` sí es el hook público de consumo puntual para futuras pantallas (Requirement "Hook de permisos para consumidores" de la spec), pero `AppShell`/`SidebarNav` resuelven el filtrado masivo con la función pura subyacente.
2. **Entrada de `/cuentas` fuera de `APP_ROUTES`**: se agregó `ADMIN_NAV_ROUTES` (nuevo export en `app/routes.ts`, tipo `NavItem` compartido con `AppRoute`) en vez de sumar `/cuentas` a `APP_ROUTES` — ese arreglo también alimenta el mapeo de rutas `element`/`lazy` de `router.tsx`, y `/cuentas` ya tiene ahí su propia ruta `lazy` (tasks.md 7.9); duplicarla en `APP_ROUTES` habría creado dos configuraciones de ruta para el mismo path.
3. **`AppShell` defensivo fuera de sesión autenticada**: `useAuth()` puede devolver `loading`/`anonymous` por el tipo, aunque en producción `RequireAuth` garantiza `authenticated` antes de montar `AppShell`. Se agregó un `return null` defensivo (no alcanzable en producción) en vez de asumir el narrowing con un cast, para que el modo estricto de TS no permita acceder a `usuario`/`permisos` sin chequear el estado.
4. Ícono nuevo de `/cuentas` (`navIcons.tsx`, `IconKey` extendido con `'cuentas'`): un escudo simple, deliberadamente distinto de los 8 íconos de módulo, para no sugerir que la administración de cuentas es un módulo más.

## 9. Verificación

- [x] 9.1 `npx tsc -b --noEmit` dentro de `frontend/` sin errores — 0 errores
- [x] 9.2 `npm test` — suite completa verde, con el conteo igual o mayor al baseline de 0.4 — **989/989 passed** (176 archivos), por encima del baseline de 0.4 (853/855) y del cierre del batch anterior (976/976)
- [x] 9.3 `npm run lint` (oxlint) sin errores nuevos — sin errores; mismos 14 warnings preexistentes `react(only-export-components)` de siempre, ninguno nuevo
- [x] 9.4 Confirmar que no queda ninguna referencia a `VITE_DEMO_MODE`, `DEMO_EMAIL`, `DEMO_PASSWORD` ni `FAKE_SESSION` en el repositorio — `grep -rn` sobre todo el repo (excluido `node_modules`/`.git`) solo encuentra menciones históricas en comentarios que documentan que el hack **fue borrado** (`LoginPage.tsx`, `LoginPage.test.tsx`, `AuthContext.tsx`, `CHANGES.md`) y en los artefactos de planificación de este mismo change (`tasks.md`/`proposal.md`/`design.md`/`specs/auth-supabase/spec.md`, que documentan la eliminación como parte del plan). Cero código funcional (constantes, lecturas de `import.meta.env`, `defaultValue`) las referencia. `frontend/.env` no pudo inspeccionarse (sandbox del agente deniega lectura de rutas `.env*`, mismo bloqueo que 1.1) pero es irrelevante: `AuthContext.tsx` ya no lee `VITE_DEMO_MODE` bajo ninguna condición desde el batch 1, así que aunque la variable siguiera presente en ese archivo no tendría ningún efecto en runtime
- [x] 9.5 **Verificación manual contra el proyecto real** — confirmada 2026-07-29 por la usuaria, los 8 casos verificados en vivo contra Supabase real: login válido, login inválido (error visible, sin navegar), refresh en ruta protegida (sesión persiste), logout (redirige a `/login`), acceso a módulo sin permiso con cuenta `empleado` (pantalla de acceso denegado, nav filtrada), 403 en `/cuentas` con esa misma cuenta `empleado`, alta de cuenta nueva desde `/cuentas`, y edición de la matriz de permisos (otorgar y revocar, ambos persistidos)
- [x] 9.6 Dar de baja las cuentas de prueba creadas durante la verificación — confirmado 2026-07-29: la cuenta `empleado` de prueba creada en 9.5 quedó con los 4 módulos en "sin acceso" vía la matriz de permisos (revocación total, según la resolución de la Open Question 5 de `proposal.md` — no hay borrado real, la cuenta sigue existiendo pero sin acceso)
