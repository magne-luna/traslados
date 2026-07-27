## ADDED Requirements

### Requirement: Guardia de rutas protegidas
El sistema SHALL proteger las rutas de los módulos con una guardia que consulta `useAuth()`. La guardia MUST permitir el acceso solo cuando hay sesión activa y redirigir a `/login` cuando no la hay. La guardia MUST verificar únicamente autenticación (presencia de sesión), NO roles ni permisos por módulo.

#### Scenario: Acceso con sesión
- **WHEN** el usuario navega a una ruta protegida y `useAuth()` reporta sesión activa
- **THEN** la pantalla del módulo se renderiza normalmente dentro del shell

#### Scenario: Acceso sin sesión
- **WHEN** el usuario navega a una ruta protegida y `useAuth()` no reporta sesión
- **THEN** el sistema redirige a la pantalla de login mock (`/login`) sin renderizar la ruta protegida

### Requirement: Pantalla de login mock
El sistema SHALL proveer una pantalla de login mock en `/login` que, al confirmarse, invoca `signIn()` y devuelve al usuario a la aplicación. La pantalla NO valida credenciales reales ni contacta a Supabase; es un disparador del estado de sesión en memoria.

#### Scenario: Login desde la pantalla mock
- **WHEN** el usuario está en `/login` sin sesión y confirma el ingreso
- **THEN** `signIn()` se dispara, se crea la sesión falsa y el usuario es llevado a una ruta protegida (Dashboard)

#### Scenario: Usuario ya autenticado visita login
- **WHEN** un usuario con sesión activa navega a `/login`
- **THEN** el sistema lo redirige al Dashboard en vez de mostrar el formulario de login
