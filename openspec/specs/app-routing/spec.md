## ADDED Requirements

### Requirement: Router de la aplicación
El sistema SHALL configurar un router cliente con `react-router` v7 (`createBrowserRouter`) montado en `App.tsx`, que sea el único punto de entrada de navegación de la SPA (RNF-01). El router MUST componer el shell de la app como layout raíz y las pantallas de módulo como rutas hijas renderizadas en un `<Outlet>`.

#### Scenario: Navegación entre módulos sin recarga
- **WHEN** el usuario hace clic en un ítem de navegación del shell
- **THEN** la URL cambia y la pantalla correspondiente se renderiza dentro del shell sin recargar la página

#### Scenario: Acceso directo por URL
- **WHEN** el usuario ingresa directamente una URL de módulo conocida (por ejemplo `/obras-sociales`)
- **THEN** el shell y la pantalla de ese módulo se renderizan

### Requirement: Rutas placeholder de los módulos del roadmap
El sistema SHALL exponer una ruta por cada uno de los ocho módulos del roadmap: Dashboard, Obras Sociales, Vehículos, Pacientes, Conductores, Presupuestos, Hojas de Ruta y Facturación. Cada ruta MUST renderizar, por ahora, una página placeholder ("próximamente") sin contenido funcional; el contenido real de cada módulo lo entrega su change FE-N correspondiente.

#### Scenario: Módulo aún no implementado
- **WHEN** el usuario navega a la ruta de un módulo cuyo FE-N todavía no se implementó
- **THEN** se muestra una página placeholder con el nombre del módulo y un indicador de "próximamente"

#### Scenario: Dashboard como pantalla inicial
- **WHEN** el usuario accede a la raíz de la aplicación estando autenticado
- **THEN** se muestra la ruta del Dashboard como pantalla inicial (no la vitrina del design system)

### Requirement: Ruta de la vitrina del design system
El sistema SHALL mantener la vitrina `DesignSystem` accesible en una ruta propia `/design-system`, como documentación viva del sistema de diseño, y NO como pantalla de inicio.

#### Scenario: Acceso a la vitrina
- **WHEN** el usuario navega a `/design-system`
- **THEN** se renderiza la vitrina del design system existente, sin modificar su contenido

### Requirement: Manejo de ruta desconocida
El sistema SHALL manejar cualquier ruta no reconocida con una respuesta explícita (pantalla "no encontrado" mínima o redirección al Dashboard), sin dejar la aplicación en blanco.

#### Scenario: URL inexistente
- **WHEN** el usuario ingresa una URL que no corresponde a ninguna ruta definida
- **THEN** se muestra una pantalla de "no encontrado" o se redirige al Dashboard, nunca una pantalla en blanco

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
