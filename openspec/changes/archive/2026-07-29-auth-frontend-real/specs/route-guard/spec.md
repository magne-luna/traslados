## MODIFIED Requirements

### Requirement: Guardia de rutas protegidas
El sistema SHALL proteger las rutas de los módulos con una guardia que consulta `useAuth()`. La guardia MUST distinguir tres situaciones: sesión en restauración (`loading`), sin sesión (`anonymous`) y con sesión (`authenticated`). Con sesión activa, la guardia MUST además verificar que la cuenta tenga al menos nivel `read` sobre el módulo asociado a la ruta, según el mapeo declarado en `app/routes.ts`. Las rutas sin módulo asociado MUST requerir únicamente sesión activa. La ruta de administración de cuentas MUST requerir además rol `admin`.

#### Scenario: Acceso con sesión y permiso
- **WHEN** el usuario navega a una ruta protegida, `useAuth()` reporta `authenticated` y la cuenta tiene al menos `read` sobre el módulo de esa ruta
- **THEN** la pantalla del módulo se renderiza normalmente dentro del shell

#### Scenario: Acceso sin sesión
- **WHEN** el usuario navega a una ruta protegida y `useAuth()` reporta `anonymous`
- **THEN** el sistema redirige a `/login` sin renderizar la ruta protegida, recordando la ruta solicitada como destino posterior al login

#### Scenario: Sesión en restauración
- **WHEN** el usuario navega a una ruta protegida y `useAuth()` reporta `loading`
- **THEN** el sistema muestra un indicador de carga y NO redirige a `/login`

#### Scenario: Acceso sin permiso sobre el módulo
- **WHEN** el usuario autenticado navega a una ruta cuyo módulo no tiene habilitado
- **THEN** el sistema muestra una pantalla explícita de acceso denegado dentro del shell, en vez de redirigir silenciosamente

#### Scenario: Ruta de administración de cuentas
- **WHEN** una cuenta con rol `empleado` navega a `/cuentas`
- **THEN** el sistema muestra la pantalla de acceso denegado

### Requirement: Pantalla de login
El sistema SHALL proveer una pantalla de login en `/login` que valide credenciales reales contra Supabase Auth. La pantalla MUST leer el email y la contraseña ingresados por el usuario, invocar `signIn(email, password)` y navegar únicamente cuando la autenticación resulta exitosa. La pantalla NO MUST precargar credenciales de ningún tipo. Los estados de carga y de error MUST representarse explícitamente, reutilizando los componentes del design system.

#### Scenario: Login con credenciales válidas
- **WHEN** el usuario ingresa credenciales válidas y confirma
- **THEN** se crea la sesión real y el usuario es llevado a la ruta que intentaba visitar, o al Dashboard si no había ninguna

#### Scenario: Login con credenciales inválidas
- **WHEN** el usuario ingresa credenciales incorrectas y confirma
- **THEN** la pantalla muestra un mensaje de error, permanece en `/login` y no crea ninguna sesión

#### Scenario: Envío en curso
- **WHEN** la autenticación está en curso
- **THEN** el botón de ingreso queda deshabilitado hasta que la operación termine, impidiendo envíos duplicados

#### Scenario: Campos vacíos
- **WHEN** el usuario confirma sin completar email o contraseña
- **THEN** la pantalla lo señala y no invoca la autenticación

#### Scenario: Usuario ya autenticado visita login
- **WHEN** un usuario con sesión activa navega a `/login`
- **THEN** el sistema lo redirige al Dashboard en vez de mostrar el formulario de login
