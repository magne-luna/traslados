## ADDED Requirements

### Requirement: Ruta de administración de cuentas
El sistema SHALL exponer una ruta `/cuentas` montada dentro del shell y bajo la guardia de rutas protegidas, reservada a cuentas con rol `admin`. La ruta MUST componerse con un composition root propio que inyecte el repositorio de cuentas, siguiendo el patrón de las demás rutas de módulo.

#### Scenario: Acceso de la administradora
- **WHEN** una cuenta con rol `admin` navega a `/cuentas`
- **THEN** se renderiza la pantalla de administración de cuentas dentro del shell

#### Scenario: Acceso de un empleado
- **WHEN** una cuenta con rol `empleado` navega a `/cuentas`
- **THEN** se renderiza la pantalla de acceso denegado, sin cargar datos de cuentas

## MODIFIED Requirements

### Requirement: Rutas placeholder de los módulos del roadmap
El sistema SHALL exponer una ruta por cada uno de los ocho módulos del roadmap: Dashboard, Obras Sociales, Vehículos, Pacientes, Conductores, Presupuestos, Hojas de Ruta y Facturación. Cada ruta MUST declarar además, en el único punto de verdad `app/routes.ts`, el módulo del backend al que corresponde a efectos de permisos (o la ausencia explícita de módulo). Cada ruta MUST renderizar la pantalla de su módulo cuando su change FE-N ya la entregó, o una página placeholder ("próximamente") mientras tanto.

#### Scenario: Módulo aún no implementado
- **WHEN** el usuario navega a la ruta de un módulo cuyo FE-N todavía no se implementó
- **THEN** se muestra una página placeholder con el nombre del módulo y un indicador de "próximamente"

#### Scenario: Dashboard como pantalla inicial
- **WHEN** el usuario accede a la raíz de la aplicación estando autenticado
- **THEN** se muestra la ruta del Dashboard como pantalla inicial (no la vitrina del design system)

#### Scenario: Módulo declarado por ruta
- **WHEN** se consulta la definición de una ruta de módulo
- **THEN** incluye el módulo del backend asociado (`pacientes`, `obra_social`, `facturacion` o `conductores`) o la ausencia explícita de módulo para las rutas transversales
