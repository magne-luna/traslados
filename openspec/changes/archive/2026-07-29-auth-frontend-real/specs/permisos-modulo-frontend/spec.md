## ADDED Requirements

### Requirement: Carga de los permisos de la cuenta activa
El sistema SHALL cargar, al establecerse una sesión, los permisos por módulo de la cuenta activa leyendo `modulos.permisos` cruzado con `modulos.modulos`, y MUST exponerlos en `useAuth()` como una estructura tipada `Modulo -> NivelAcceso`. Los módulos válidos MUST ser exactamente los cuatro seedeados por el backend: `pacientes`, `obra_social`, `facturacion` y `conductores`.

#### Scenario: Cuenta con permisos parciales
- **WHEN** la cuenta activa tiene permiso `read` sobre `pacientes` y ninguno sobre los demás módulos
- **THEN** `useAuth()` expone un mapa con `pacientes: 'read'` y sin entradas para los otros tres módulos

#### Scenario: Cuenta sin ningún permiso
- **WHEN** la cuenta activa no tiene ninguna fila en `modulos.permisos`
- **THEN** `useAuth()` expone un mapa vacío y el sistema sigue considerando la sesión válida

### Requirement: Jerarquía de niveles de acceso
El sistema SHALL implementar la comprobación de permisos como una función pura `tienePermiso(permisos, modulo, nivelMinimo)` con la jerarquía `read < write < admin`, de modo que un nivel superior satisface cualquier requisito inferior. La función MUST devolver `true` para cualquier módulo y nivel cuando el rol de la cuenta es `admin`, replicando el short-circuit de `modulos.tiene_permiso()` del servidor.

#### Scenario: Nivel superior satisface un requisito inferior
- **WHEN** se consulta `tienePermiso` con nivel mínimo `read` sobre un módulo donde la cuenta tiene `write`
- **THEN** el resultado es verdadero

#### Scenario: Nivel insuficiente
- **WHEN** se consulta `tienePermiso` con nivel mínimo `write` sobre un módulo donde la cuenta tiene `read`
- **THEN** el resultado es falso

#### Scenario: Rol admin sobre cualquier módulo
- **WHEN** la cuenta tiene rol `admin` y se consulta cualquier módulo con cualquier nivel mínimo
- **THEN** el resultado es verdadero, aunque no exista fila alguna en la matriz de permisos

#### Scenario: Módulo sin permiso asignado
- **WHEN** se consulta un módulo que no aparece en el mapa de permisos de una cuenta con rol `empleado`
- **THEN** el resultado es falso

### Requirement: Mapeo declarativo de ruta a módulo
El sistema SHALL declarar en un único punto de verdad (`app/routes.ts`, junto a `APP_ROUTES`) a qué módulo del backend corresponde cada ruta del frontend. Las rutas que no pertenecen a ningún módulo (Dashboard, vitrina del design system) MUST declararlo explícitamente como ausencia de módulo, no por omisión.

#### Scenario: Ruta con módulo asociado
- **WHEN** se consulta el módulo de `/facturacion`
- **THEN** se obtiene `facturacion`

#### Scenario: Rutas agrupadas bajo un mismo módulo
- **WHEN** se consulta el módulo de `/vehiculos` y el de `/presupuestos`
- **THEN** se obtiene `conductores` y `facturacion` respectivamente, siguiendo la agrupación de módulos del backend

#### Scenario: Ruta sin módulo
- **WHEN** se consulta el módulo de `/`
- **THEN** se obtiene ausencia de módulo, y el acceso queda condicionado solo a estar autenticado

### Requirement: Hook de permisos para consumidores
El sistema SHALL exponer un hook `usePermiso(modulo, nivelMinimo)` que devuelva si la cuenta activa cumple ese requisito, para que cualquier pantalla pueda condicionar acciones sin reimplementar la lógica de niveles.

#### Scenario: Consulta desde una pantalla
- **WHEN** una pantalla consulta `usePermiso('pacientes', 'write')` con una cuenta que tiene `read` sobre `pacientes`
- **THEN** obtiene falso

### Requirement: Navegación filtrada por permisos
El sistema SHALL mostrar en la navegación del shell únicamente los módulos sobre los que la cuenta activa tiene al menos nivel `read`, más las rutas sin módulo asociado. La entrada de administración de cuentas MUST mostrarse solo a cuentas con rol `admin`.

#### Scenario: Navegación de una cuenta con permisos parciales
- **WHEN** la cuenta activa tiene permiso solo sobre `pacientes`
- **THEN** la navegación muestra Dashboard y Pacientes, y no muestra Obras Sociales, Conductores, Vehículos, Hojas de Ruta, Presupuestos ni Facturación

#### Scenario: Entrada de cuentas solo para admin
- **WHEN** la cuenta activa tiene rol `empleado`
- **THEN** la navegación no incluye la entrada de administración de cuentas

#### Scenario: Cuenta sin ningún módulo habilitado
- **WHEN** la cuenta activa no tiene permiso sobre ningún módulo
- **THEN** el shell muestra un mensaje indicando que hay que solicitar acceso a la administradora, en vez de una navegación vacía sin explicación

### Requirement: El control de permisos del cliente no sustituye a la RLS
El sistema SHALL tratar la comprobación de permisos del cliente como una mejora de experiencia de uso, no como frontera de seguridad. La documentación del código MUST dejar constancia de que la autorización efectiva la impone la Row Level Security del servidor a través de `modulos.tiene_permiso()`.

#### Scenario: Acceso forzado a datos sin permiso
- **WHEN** una petición alcanza una tabla de dominio sobre la que la cuenta no tiene permiso, sorteando el control del cliente
- **THEN** la RLS del servidor no devuelve filas, independientemente de lo que haya decidido el frontend
