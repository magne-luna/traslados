# Design: auth-frontend-real

## Context

El backend de `C-02-usuarios-permisos-auditoria` está implementado y desplegado en el proyecto
Supabase real (`pkryfoljypuzfifofdwp`). El frontend todavía consume un mock en memoria. Este
documento define cómo se cablea uno con el otro sin romper los ~190 tests existentes ni las 8
pantallas de dominio ya construidas.

### Estado actual del frontend

| Archivo | Qué hace hoy |
|---|---|
| `shared/auth/AuthContext.tsx` | `useState(FAKE_SESSION)`; arranca logueado salvo `VITE_DEMO_MODE=true` |
| `shared/auth/useAuth.ts` | `useContext` + error si está fuera del provider (se conserva) |
| `shared/auth/RequireAuth.tsx` | `session === null ? <Navigate to="/login"/> : <Outlet/>` |
| `features/auth/LoginPage.tsx` | `defaultValue` hardcodeados; `handleSubmit` no lee los campos |
| `app/router.tsx` | `/login` pública; todo lo demás bajo `RequireAuth` → `AppShell` |
| `app/AppShell.tsx` | Sidebar desde `APP_ROUTES`; **sin** control de logout |

`signOut()` existe en el contexto pero **no lo llama nadie**: no hay forma de cerrar sesión.

### Contrato backend disponible (congelado)

Fuente: `openspec/changes/C-02-usuarios-permisos-auditoria/design.md` §Interfaces / Contracts.

**Tablas y RLS relevantes** (verificadas en las migraciones, no asumidas):

| Objeto | Policy | Qué implica para el frontend |
|---|---|---|
| `usuarios.usuarios` | `SELECT ... USING (true)` para `authenticated` | Cualquier autenticado lee **todos** los perfiles → el listado de cuentas se puede leer con el cliente anon |
| `usuarios.usuarios` | `UPDATE ... USING (auth.uid() = id)` | Cada quien edita su propio perfil; el trigger `prevent_rol_tampering()` bloquea cambiar `rol` |
| `modulos.modulos` | `SELECT ... USING (true)` | El catálogo de los 4 módulos se lee directo |
| `modulos.permisos` | `SELECT ... USING (usuario_id = auth.uid())` **+** `FOR ALL USING (rol = 'admin')` | Un empleado lee **solo sus propios** permisos; un admin lee los de todos (las policies permisivas se combinan con OR) |
| `auditoria.logs` | `SELECT` para cualquier autenticado | Fuera de alcance de este change |

**Edge Functions** (`POST`, `Authorization: Bearer <JWT del admin>`):

```
create-user      body { email, password (>=8), nombre, apellido, permisos?: {modulo, nivel_acceso}[] }
                 200 { id, email } | 400 {error} | 401 {error} | 403 {error} | 405 {error}

update-permisos  body { usuario_id: uuid, permisos: {modulo, nivel_acceso}[] }   ← reemplazo TOTAL
                 200 { usuario_id, permisos } | 400 | 401 | 403 | 404 {error}
```

⚠️ **`password` es obligatorio en `create-user`** (validado con `password.length >= 8`), aunque el
resumen del roadmap lo omitía. El formulario de alta debe pedirlo.

**Módulos seedeados** (`modulos.modulos.tipo_modulo`): `pacientes`, `obra_social`, `facturacion`,
`conductores` — exactamente 4, no los 8 nombres de carpeta del frontend.

## Goals / Non-Goals

**Goals:**

- Sesión real: login/logout/restauración/refresh contra Supabase Auth, con estado de carga explícito.
- Autorización derivada de la base de datos, jamás del JWT.
- Guard de rutas por módulo + nivel, con navegación coherente (no mostrar lo que no se puede abrir).
- Pantalla de cuentas + matriz de permisos para la administradora.
- Cero cambios en las 8 pantallas de dominio y en sus repositorios mock.

**Non-Goals:**

- Tocar `supabase/` (migraciones, RLS, Edge Functions). Ya está hecho en C-02.
- Reemplazar repositorios de dominio por Supabase (resto de FE-8, un change por módulo).
- Deshabilitar botón por botón según `nivel_acceso` dentro de cada pantalla (se entrega el hook).
- Visor de auditoría, recuperación de contraseña, baja de cuentas (ver Open Questions).

## Decisions

### D1 — Patrón repositorio para auth, igual que el resto del código

`AuthRepository` (interfaz) + `SupabaseAuthRepository` (real) + `mockAuthRepository` (tests),
inyectado en `AuthProvider` por prop, exactamente como `PacienteRepositoryContext` y sus ocho
hermanos hacen hoy.

```ts
export interface AuthRepository {
  getSesionActual(): Promise<SesionUsuario | null>;
  signIn(email: string, password: string): Promise<SesionUsuario>;   // rechaza con AuthError
  signOut(): Promise<void>;
  onCambioDeSesion(cb: (s: SesionUsuario | null) => void): () => void; // devuelve unsubscribe
}
```

**Alternativa descartada:** llamar `supabase.auth.*` directamente desde `AuthContext`. Es menos
código, pero obligaría a mockear el módulo `@supabase/supabase-js` con `vi.mock` en cada test que
monte el router — frágil y contrario a la convención establecida del repo. Con el repositorio,
`renderConSesion()` inyecta un objeto plano.

**Alternativa descartada:** TanStack Query. No es dependencia del proyecto y el estado de sesión es
un singleton con suscripción push (`onAuthStateChange`), no un cache de queries. Introducirla aquí
sería una decisión de arquitectura global que excede este change.

### D2 — Máquina de estados de tres valores, no `session | null`

```ts
type EstadoAuth =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; usuario: Usuario; permisos: MapaPermisos };
```

El mock de hoy puede modelar la sesión como `Session | null` porque su restauración es síncrona.
Supabase resuelve la sesión de forma asíncrona al montar; con dos estados, `RequireAuth` vería
`null` en el primer render y **expulsaría al usuario a `/login` en cada refresh de página**. El
tercer estado es obligatorio, no cosmético.

`RequireAuth` renderiza un indicador de carga mientras `status === 'loading'` — nunca redirige.

**Alternativa descartada:** un flag `isLoading` separado. Permite estados imposibles
(`isLoading && session`), que es justo lo que el modo estricto de TypeScript debería impedir.

### D3 — El perfil y los permisos salen de la base, no del JWT

Al autenticar (y en cada `onAuthStateChange` con sesión), el repositorio hace dos lecturas con el
cliente anon, protegidas por RLS:

```
supabase.schema('usuarios').from('usuarios').select('*').eq('id', user.id).single()
supabase.schema('modulos').from('permisos').select('nivel_acceso, modulos(tipo_modulo)')
        .eq('usuario_id', user.id)
```

`user_metadata` / `raw_user_meta_data` es **editable por el propio usuario** en Supabase: usarlo
para autorización es una escalada de privilegios trivial. `usuarios.usuarios.rol` está protegido
por el trigger `prevent_rol_tampering()`; `modulos.permisos` solo lo escribe un admin. El
`user_metadata: { nombre, apellido }` que setea `create-user` se usa **solo** para mostrar el
nombre en el trigger `handle_new_user()`; el frontend lee siempre la tabla.

**Nota importante**: esto es defensa en profundidad, no la defensa. La autorización real la impone
la RLS del servidor en cada tabla de dominio vía `modulos.tiene_permiso()`. El gate del cliente
existe para UX (no mostrar callejones sin salida), no como frontera de seguridad. La documentación
del change debe decirlo explícitamente para que nadie lo tome como suficiente.

### D4 — Mapeo ruta → módulo, declarado en `routes.ts`

8 rutas del frontend contra 4 módulos del backend. La tabla vive en `app/routes.ts` (junto a
`APP_ROUTES`, ya el único punto de verdad de path/label/icono) como campo nuevo `modulo`:

| Ruta | `modulo` | Justificación |
|---|---|---|
| `/` | `null` | Dashboard: agregación pura, sin tabla propia (C-02 design.md §catálogo) |
| `/pacientes` | `pacientes` | 1:1 |
| `/obras-sociales` | `obra_social` | 1:1 |
| `/conductores` | `conductores` | 1:1 |
| `/vehiculos` | `conductores` | El docx agrupa Vehículo/Mantenimiento bajo `conductores` |
| `/hojas-de-ruta` | `conductores` | ✅ Confirmado — planificación de flota |
| `/presupuestos` | `facturacion` | El docx agrupa Presupuesto/Autorización bajo `facturacion` |
| `/facturacion` | `facturacion` | 1:1 |
| `/cuentas` | `null` + `rol === 'admin'` | Los usuarios no son un módulo: se gobiernan por `rol` |
| `/design-system` | `null` | Vitrina interna |

El acceso a una ruta con módulo requiere nivel **`read` o superior**. `null` = cualquier
autenticado.

**Alternativa descartada:** un `Record<string, Modulo>` suelto en `RequireAuth`. Se desincronizaría
de `APP_ROUTES` en el primer módulo nuevo; el campo obliga a decidirlo al agregar la ruta.

### D5 — Jerarquía de niveles como función pura y testeable

```ts
const ORDEN: Record<NivelAcceso, number> = { read: 1, write: 2, admin: 3 };
export function tienePermiso(p: MapaPermisos, m: Modulo, min: NivelAcceso): boolean
```

Espejo en el cliente de `modulos.tiene_permiso()` del servidor, con la misma regla de
short-circuit: `rol === 'admin'` ⇒ `true` para cualquier módulo y nivel, sin consultar la matriz.
Función pura, sin React, con tests de tabla — el candidato ideal para TDD estricto.

### D6 — Acceso denegado se renderiza, no se redirige

Autenticado + sin permiso ⇒ una pantalla explícita dentro del `AppShell` (usando `EmptyState`/
`Alert` del design system), no `<Navigate to="/">`. Un redirect silencioso es indistinguible de un
bug para quien lo sufre, y dispara bucles si el destino tampoco es accesible. Además la navegación
ya oculta esos módulos, así que llegar ahí implica una URL escrita a mano o un link viejo — el caso
en que el mensaje más importa.

### D7 — Toda escritura de cuentas/permisos pasa por las Edge Functions

Aunque la policy `"Admins manage permisos" FOR ALL` permitiría a un admin escribir
`modulos.permisos` directo desde el cliente anon, el frontend **no lo hace**:

- `create-user` es el **único** camino de alta (no hay signup público) y necesita service-role.
- `update-permisos` encapsula la semántica de reemplazo total (delete + insert) en una sola
  llamada; reimplementarla en el cliente duplicaría lógica y abriría una ventana de inconsistencia
  entre el `delete` y el `insert` si el navegador se cierra en el medio.

Invocación vía `supabase.functions.invoke(...)`, que adjunta el JWT de la sesión automáticamente.
El `{ error: string }` del body se propaga tal cual a la UI (regla de api-design: no inventar
formas de error nuevas). Mapeo de estados:

| Status | Mensaje en pantalla |
|---|---|
| 401 | "Tu sesión expiró. Volvé a ingresar." + `signOut()` |
| 403 | "Solo la administradora puede realizar esta acción." |
| 404 | "La cuenta ya no existe." + recargar el listado |
| 400 | El `error` del body, tal cual |

### D8 — Lecturas del listado de cuentas: directo por RLS

Leer `usuarios.usuarios` + `modulos.permisos` + `modulos.modulos` con el cliente anon. La RLS ya
resuelve la visibilidad correcta (admin ve todo). No hace falta Edge Function para leer, y agregar
una sería trabajo backend — explícitamente fuera de alcance.

### D9 — Estructura de la pantalla de cuentas

Sigue el patrón list+detail del resto de la app (`ObraSocialesPage` como referencia más cercana):

```
features/cuentas/
  CuentasRoute.tsx      composition root: inyecta CuentaRepository (mock en tests, Supabase en prod)
  CuentasPage.tsx       list + detail
  CuentasList.tsx       Table del design system: nombre, email, rol, módulos con acceso
  CuentaDetail.tsx      perfil + <MatrizPermisos>
  CuentaForm.tsx        alta: email, nombre, apellido, password, permisos iniciales
  MatrizPermisos.tsx    4 filas (módulo) × Select de nivel (sin acceso / read / write / admin)
  validateCuentaForm.ts función pura de validación (TDD)
```

Componentes del design system (`Table`/`Tr`/`Td`/`Th`, `Field`, `Input`, `Select`, `Button`,
`Alert`, `Card`, `EmptyState`) — cero markup a mano, cero `style={{}}`.

La matriz usa `<Select>` por fila (4 filas × 4 opciones), no una grilla de radio buttons: es
operable por teclado sin trampas de foco, no necesita modal (la app usa edición diferida en línea,
nunca modal), y el estado enviado a `update-permisos` es exactamente el conjunto de filas con nivel
≠ "sin acceso".

### D10 — Control de sesión en el `AppShell`

Al pie del sidebar: nombre + email del usuario, chip de rol, y botón "Cerrar sesión" que llama
`signOut()` y navega a `/login`. Hoy no existe ninguno de los tres.

La navegación se filtra con `tienePermiso(permisos, route.modulo, 'read')`; `/cuentas` aparece solo
si `rol === 'admin'`. Si el filtro deja el menú vacío (cuenta sin ningún permiso), se muestra un
mensaje explicando que hay que pedirle acceso a la administradora — no un sidebar en blanco.

### D11 — Helper de tests, para no reescribir 190 tests

`shared/test/renderConSesion(ui, { usuario?, permisos?, status? })` monta `AuthProvider` con un
`mockAuthRepository`. Por defecto: admin con todos los permisos, que es el comportamiento que los
tests existentes asumen implícitamente hoy. Así los tests de dominio siguen pasando sin tocarlos, y
los tests nuevos de permisos declaran su escenario explícitamente.

## Data Flow

```
Montaje de la app
  AuthProvider → repo.getSesionActual()          status: 'loading'
       │                                          RequireAuth: spinner, NO redirige
       ├─ sin sesión ────────────────────────→   status: 'anonymous'  → /login
       └─ con sesión → SELECT usuarios.usuarios
                     → SELECT modulos.permisos → status: 'authenticated'
                                                  { usuario, permisos }

Login
  LoginPage → signIn(email, password) → supabase.auth.signInWithPassword
       ├─ error  → Alert con el mensaje, el formulario NO navega
       └─ ok     → (mismas dos lecturas) → navigate(destinoGuardado ?? '/')

Navegación a /X
  RequireAuth: status==='loading' → spinner
               status==='anonymous' → /login (guardando /X como destino)
               status==='authenticated' → tienePermiso(permisos, moduloDe('/X'), 'read')
                                            ? <Outlet/> : <AccesoDenegado/>

Alta de cuenta (admin)
  CuentaForm → functions.invoke('create-user', { email, password, nombre, apellido, permisos })
             → 200 → refrescar listado | 4xx → Alert con el error del body

Editar permisos (admin)
  MatrizPermisos → functions.invoke('update-permisos', { usuario_id, permisos })  ← reemplazo total
                 → 200 → refrescar la fila | 4xx → Alert, sin cambio optimista

onAuthStateChange (refresh de token / logout en otra pestaña / expiración)
  repo.onCambioDeSesion → recalcula estado; si pasa a null → 'anonymous' → /login
```

## Threat Model (STRIDE — change de auth, obligatorio por security-review)

| Vector | Mitigación |
|---|---|
| **S**poofing — entrar sin credenciales | Se elimina el arranque logueado por defecto; `signInWithPassword` real contra Supabase |
| **T**ampering — el cliente se auto-otorga permisos | El gate del cliente es solo UX; la RLS del servidor (`tiene_permiso()`) es la frontera real. Un cliente parcheado no obtiene datos |
| **T**ampering — auto-promoción a `admin` | `prevent_rol_tampering()` en el servidor; el frontend nunca hace `UPDATE` sobre `rol` |
| **R**epudiation | `auditoria.log_action()` ya registra toda mutación de `usuarios`/`modulos` con `auth.uid()` (backend, ya hecho) |
| **I**nformation disclosure — 8 pantallas hoy públicas | Resuelto por este change: sin sesión no se renderiza ninguna ruta protegida |
| **I**nformation disclosure — cualquier autenticado lee todos los perfiles | Es la policy `USING (true)` vigente de C-02. Confirmado como intencional (equipo interno de 4 personas; `/cuentas` de todos modos es admin-only) — se construye sin cambios de RLS |
| **D**oS | Fuera de alcance del cliente; el rate limiting de Supabase Auth aplica a `signInWithPassword` |
| **E**levation of privilege — `user_metadata` como fuente de rol | D3: el rol se lee de `usuarios.usuarios`, nunca del JWT |
| Fuga de `service_role` | Solo vive en secretos de Edge Functions. Este change no agrega ninguna variable de entorno con secretos al frontend |
| Almacenamiento de tokens | Se delega íntegramente en `@supabase/supabase-js`. **No** se escribe el token a mano en `localStorage` |

## Risks / Trade-offs

- **[Los ~190 tests existentes se ejecutan con sesión mock siempre activa]** → D11: el helper
  `renderConSesion` con default admin-total preserva el comportamiento asumido. Correr la suite
  completa antes y después es un gate de la fase de tareas (baseline de red de seguridad).
- **[El mapeo ruta→módulo es 8→4 y no es obvio]** → Se declara en `routes.ts` y se documenta acá;
  `/hojas-de-ruta` → `conductores` confirmado con la usuaria (2026-07-29).
- **[Sin la tarea 4.3 de C-02 (cuenta admin de Andrea) no hay verificación end-to-end]** → Se puede
  desarrollar y testear todo con mocks; la verificación manual contra el proyecto real queda como
  una tarea explícita, bloqueada por 4.3. Alternativa: crear una cuenta de prueba y promoverla a
  admin por SQL Editor solo para verificar, y darla de baja después.
- **[Cambiar `useAuth()` es breaking para cualquier código futuro en vuelo]** → El change es
  pequeño en superficie (4 archivos existentes) y no hay ramas paralelas de frontend abiertas.
- **[La matriz de permisos usa reemplazo total: dos admins editando a la vez se pisan]** → Con una
  sola administradora es un escenario teórico. Se documenta; no se agrega control de concurrencia.
- **[No hay `.env` versionado y `supabaseClient.ts` no valida env vars ausentes]** → `createClient`
  falla con un mensaje críptico. Se agrega `.env.example` y una validación con mensaje claro. Nota:
  `vite.config.ts` usa `envPrefix: ['VITE_', 'SUPABASE_']`, así que `SUPABASE_URL`/
  `SUPABASE_ANON_KEY` sí llegan a `import.meta.env` — el prefijo no estándar es intencional.
- **[Estado de carga mal implementado = pantalla en blanco al refrescar]** → Escenario de spec
  explícito y test dedicado: refrescar en una ruta protegida con sesión válida **no** debe pasar
  por `/login`.

## Migration Plan

1. Verificar que la tarea 4.3 de C-02 esté hecha (cuenta admin real) — o crear una de prueba.
2. Configurar `.env.local` con `SUPABASE_URL` / `SUPABASE_ANON_KEY` del proyecto real.
3. Implementar en el orden de `tasks.md`: tipos → funciones puras → repositorio → contexto →
   guard → login → pantalla de cuentas → shell. Cada paso en RED-GREEN-REFACTOR.
4. `npx tsc -b --noEmit` + `npm test` (suite completa) antes de cada commit.
5. Verificación manual contra el proyecto real: login válido, login inválido, refresh de página,
   logout, acceso a módulo sin permiso, alta de cuenta, edición de la matriz.

**Rollback**: revertir el commit. No hay migraciones ni cambios de datos; el mock vuelve intacto.
Las cuentas creadas durante la verificación quedan en la base y hay que darlas de baja a mano.

## Open Questions — todas resueltas (2026-07-29, ver `proposal.md` §Open Questions)

1. `/hojas-de-ruta`: **`conductores`**.
2. Dashboard `/`: **sin gate propio**, visible para cualquier autenticado.
3. Gateo de escritura por nivel: **solo el hook** `usePermiso()` en este change.
4. Cambiar/recuperar contraseña: **no entra** en este change.
5. Baja de cuentas: **revocar todos los permisos** vía `update-permisos` con array vacío.
6. Policy `USING (true)` en `usuarios.usuarios`: **confirmado intencional**.
