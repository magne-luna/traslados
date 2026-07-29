## ADDED Requirements

### Requirement: Sesión real contra Supabase Auth
El sistema SHALL autenticar contra Supabase Auth mediante email y contraseña. El `AuthProvider` MUST obtener el estado de sesión a través de un `AuthRepository` inyectado (implementación real sobre `supabase.auth`, implementación mock en tests), y NO MUST mantener ninguna sesión falsa en memoria. El estado MUST estar tipado en modo estricto, sin `any`.

#### Scenario: Credenciales válidas
- **WHEN** se invoca `signIn(email, password)` con credenciales que existen en Supabase Auth
- **THEN** el sistema obtiene una sesión real y `useAuth()` pasa a reportar `status: 'authenticated'` con el usuario correspondiente

#### Scenario: Credenciales inválidas
- **WHEN** se invoca `signIn(email, password)` con credenciales incorrectas
- **THEN** el sistema NO crea ninguna sesión, `useAuth()` sigue reportando `status: 'anonymous'` y el error queda disponible para mostrarse en la interfaz

#### Scenario: Consumo del hook fuera del provider
- **WHEN** un componente usa `useAuth()` sin estar dentro de `AuthProvider`
- **THEN** el sistema falla de forma explícita con un error claro, en vez de devolver un estado ambiguo

### Requirement: Estado de carga explícito durante la restauración de sesión
El sistema SHALL modelar el estado de autenticación con exactamente tres valores excluyentes: `loading`, `anonymous` y `authenticated`. Mientras la sesión persistida se está restaurando, el estado MUST ser `loading`, y ningún consumidor MUST tratar ese estado como "sin sesión".

#### Scenario: Recarga de página en una ruta protegida
- **WHEN** el usuario con sesión válida recarga el navegador estando en una ruta protegida
- **THEN** el sistema muestra un indicador de carga y, una vez restaurada la sesión, renderiza la ruta original — sin pasar en ningún momento por `/login`

#### Scenario: Recarga sin sesión persistida
- **WHEN** el usuario sin sesión válida recarga el navegador en una ruta protegida
- **THEN** el estado pasa de `loading` a `anonymous` y el sistema redirige a `/login`

### Requirement: La aplicación nunca arranca autenticada
El sistema SHALL requerir un login efectivo en todos los escenarios. NO MUST existir ninguna variable de entorno, bandera de build ni modo de desarrollo que precargue una sesión activa al montar la aplicación.

#### Scenario: Primer arranque sin sesión previa
- **WHEN** la aplicación se monta y no hay ninguna sesión persistida
- **THEN** el estado resultante es `anonymous` y el usuario es llevado a `/login`

#### Scenario: Ausencia del modo demo
- **WHEN** se inspecciona el código de autenticación
- **THEN** no existe ninguna referencia a `VITE_DEMO_MODE`, `DEMO_EMAIL` ni `DEMO_PASSWORD`, ni credenciales precargadas en el formulario de login

### Requirement: Perfil y rol derivados de la base de datos
El sistema SHALL obtener el perfil del usuario (`nombre`, `apellido`, `email`, `rol`) leyendo la tabla `usuarios.usuarios` con el cliente anon protegido por RLS. El sistema NO MUST derivar el rol ni ningún dato de autorización de `user_metadata` ni de ningún claim del JWT, porque esos campos son modificables por el propio usuario.

#### Scenario: Carga del perfil tras autenticar
- **WHEN** se establece una sesión válida
- **THEN** el sistema consulta `usuarios.usuarios` por el `id` del usuario autenticado y expone el perfil resultante en `useAuth()`

#### Scenario: Perfil inexistente
- **WHEN** existe sesión en Supabase Auth pero no hay fila correspondiente en `usuarios.usuarios`
- **THEN** el sistema trata la sesión como inválida, cierra sesión y muestra un mensaje explicando que la cuenta no está habilitada

### Requirement: Reacción a cambios de sesión externos
El sistema SHALL suscribirse a los cambios de sesión de Supabase Auth (`onAuthStateChange`) mientras el `AuthProvider` esté montado, y MUST cancelar la suscripción al desmontarse. La renovación de token, el cierre de sesión en otra pestaña y la expiración MUST reflejarse en el estado sin requerir recarga manual.

#### Scenario: Cierre de sesión en otra pestaña
- **WHEN** la sesión se cierra desde otra pestaña del navegador
- **THEN** el estado de esta pestaña pasa a `anonymous` y el usuario es llevado a `/login`

#### Scenario: Limpieza de la suscripción
- **WHEN** el `AuthProvider` se desmonta
- **THEN** la suscripción a los cambios de sesión se cancela, sin dejar listeners activos

### Requirement: Cierre de sesión desde la interfaz
El sistema SHALL exponer un control visible de cierre de sesión en el shell de la aplicación, junto con la identidad de la cuenta activa (nombre y email) y su rol.

#### Scenario: Cerrar sesión
- **WHEN** el usuario activa el control de cerrar sesión
- **THEN** el sistema invoca `signOut()` sobre Supabase Auth, el estado pasa a `anonymous` y el usuario es llevado a `/login`

#### Scenario: Identidad visible
- **WHEN** hay una sesión activa
- **THEN** el shell muestra el nombre y el email de la cuenta autenticada y una indicación de su rol

### Requirement: Delegación del almacenamiento de tokens
El sistema SHALL delegar íntegramente en `@supabase/supabase-js` la persistencia y renovación de los tokens de sesión. El código de la aplicación NO MUST leer, escribir ni copiar tokens de acceso o de refresco a `localStorage`, `sessionStorage`, cookies ni ningún otro almacenamiento propio.

#### Scenario: Sin manejo manual de tokens
- **WHEN** se inspecciona el código de autenticación
- **THEN** no existe ninguna escritura ni lectura directa de tokens de sesión fuera del cliente de Supabase

### Requirement: Configuración de entorno verificable
El sistema SHALL validar al inicializar el cliente de Supabase que las variables de entorno requeridas (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) estén presentes, y MUST fallar con un mensaje que identifique la variable faltante. El repositorio MUST incluir un archivo de ejemplo con las variables necesarias y sin valores secretos.

#### Scenario: Variable de entorno ausente
- **WHEN** la aplicación arranca sin `SUPABASE_URL` o sin `SUPABASE_ANON_KEY`
- **THEN** falla con un error que nombra explícitamente la variable faltante, en vez de un error genérico del cliente

#### Scenario: Sin claves de servicio en el frontend
- **WHEN** se inspecciona la configuración del frontend
- **THEN** no existe ninguna referencia a `SUPABASE_SERVICE_ROLE_KEY` ni a ninguna otra credencial de servicio
