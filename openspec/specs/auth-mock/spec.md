## ADDED Requirements

### Requirement: Hook y proveedor de autenticación mock
El sistema SHALL exponer un `AuthProvider` y un hook `useAuth()` que mantienen una sesión falsa **en memoria**, sin ninguna llamada a Supabase ni backend real. El estado de sesión MUST estar tipado en modo estricto (sin `any`; tipos desconocidos como `unknown` y angostados). Por defecto, la aplicación MUST arrancar con una sesión activa (usuario logueado) para no bloquear el desarrollo frontend.

#### Scenario: Sesión activa por defecto
- **WHEN** la aplicación se monta por primera vez
- **THEN** `useAuth()` reporta una sesión activa con un usuario falso, sin requerir login

#### Scenario: Consumo del hook fuera del provider
- **WHEN** un componente usa `useAuth()` sin estar dentro de `AuthProvider`
- **THEN** el sistema falla de forma explícita (error claro), en vez de devolver un estado ambiguo

### Requirement: Alternar el estado de autenticación
El sistema SHALL permitir cambiar el estado de sesión en memoria mediante acciones `signIn()` y `signOut()` expuestas por `useAuth()`, para poder ejercitar tanto el flujo autenticado como el no autenticado durante el desarrollo.

#### Scenario: Cerrar sesión
- **WHEN** se invoca `signOut()`
- **THEN** `useAuth()` pasa a reportar que no hay sesión

#### Scenario: Iniciar sesión mock
- **WHEN** se invoca `signIn()` estando sin sesión
- **THEN** `useAuth()` pasa a reportar una sesión activa con un usuario falso

### Requirement: Guardar solo autenticación, no roles
El sistema SHALL modelar la autenticación mock como presencia/ausencia de sesión únicamente, SIN roles fijos ni permisos por módulo. Los permisos flexibles por cuenta son responsabilidad del backend real (`C-02`) y se incorporan en FE-8; este contrato NO debe sobre-diseñarlos.

#### Scenario: Sin lógica de roles
- **WHEN** un consumidor lee el estado de `useAuth()`
- **THEN** obtiene si hay o no sesión (y el usuario falso), pero no una estructura de roles ni de permisos por módulo
