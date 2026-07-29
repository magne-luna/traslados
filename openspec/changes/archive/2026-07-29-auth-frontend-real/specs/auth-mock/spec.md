## REMOVED Requirements

### Requirement: Hook y proveedor de autenticación mock
**Reason**: El backend real de autenticación (`C-02-usuarios-permisos-auditoria`) está implementado y desplegado. La sesión falsa en memoria dejaba la aplicación completa accesible sin credenciales, lo que hacía imposible desplegarla. El propio spec anticipaba su reemplazo en FE-8.
**Migration**: Sustituido por la capacidad `auth-supabase`. El `AuthProvider` pasa a envolver Supabase Auth mediante un `AuthRepository` inyectado; los tests que dependían de la sesión falsa usan el helper `renderConSesion()` con un `mockAuthRepository`.

### Requirement: Alternar el estado de autenticación
**Reason**: `signIn()` sin argumentos y síncrono no puede representar una autenticación real: no recibe credenciales, no puede fallar y no puede esperar a la red.
**Migration**: Sustituido por `signIn(email, password): Promise<...>` y `signOut(): Promise<void>` de la capacidad `auth-supabase`, ambos asincrónicos y con manejo explícito de error.

### Requirement: Guardar solo autenticación, no roles
**Reason**: La restricción era deliberadamente temporal ("los permisos flexibles por cuenta son responsabilidad del backend real (`C-02`) y se incorporan en FE-8"). El backend ya expone `usuarios.usuarios.rol` y la matriz `modulos.permisos`, y la administradora necesita gobernar el acceso por módulo.
**Migration**: Sustituido por la capacidad `permisos-modulo-frontend`, que expone el rol y el mapa de permisos por módulo derivados de la base de datos — nunca del JWT.
