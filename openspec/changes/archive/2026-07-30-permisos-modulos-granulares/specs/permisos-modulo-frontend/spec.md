## ADDED Requirements

### Requirement: Gateo de escritura en la pantalla de Presupuestos

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `presupuestos` a todas las acciones que persisten datos en la pantalla de presupuestos: alta, edición, guardado y autorización.

El gateo MUST cubrir tanto las acciones de CRUD (alta, edición, guardado) como la autorización de un presupuesto. Todas estas acciones MUST requerir nivel `write`; ninguna MUST requerir nivel `admin`.

La consulta de los datos MUST seguir disponible con nivel `read`, incluida la vista imprimible de un presupuesto: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla.

#### Scenario: Alta y edición de presupuestos

- **GIVEN** una cuenta con permiso `read` sobre `presupuestos` y ningún otro nivel
- **WHEN** la cuenta abre el listado de presupuestos y luego el detalle de uno
- **THEN** las acciones de crear y de editar están visibles y no se pueden activar, y la fila del listado sigue navegando al detalle

#### Scenario: Guardado del formulario de presupuesto

- **GIVEN** una cuenta con permiso `read` sobre `presupuestos` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un presupuesto
- **THEN** ninguno de sus campos acepta entrada, la acción de guardar no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Autorización de un presupuesto

- **GIVEN** una cuenta con permiso `read` sobre `presupuestos` y ningún otro nivel
- **WHEN** la cuenta abre el detalle de un presupuesto con autorización
- **THEN** no puede iniciar la edición de la autorización ni guardarla, y los datos de la autorización siguen siendo legibles

#### Scenario: Cancelar un formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `presupuestos` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un presupuesto y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Aviso de modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `presupuestos` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de presupuestos
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `presupuestos`
- **WHEN** la cuenta recorre el listado, el detalle, el formulario y la autorización de un presupuesto
- **THEN** todas las acciones de escritura se pueden activar con normalidad, y la pantalla no muestra aviso de solo lectura

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta abre la pantalla de presupuestos
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre facturación no habilita presupuestos

- **GIVEN** una cuenta con permiso `write` sobre `facturacion` y solo `read` sobre `presupuestos`
- **WHEN** la cuenta abre la pantalla de presupuestos
- **THEN** queda en modo solo lectura, porque `presupuestos` y `facturacion` son módulos independientes desde este cambio y el gateo se resuelve contra el módulo de la ruta

### Requirement: Gateo de escritura en la pantalla de Vehículos

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `vehiculos` a todas las acciones que persisten datos en la pantalla de vehículos: alta, edición y guardado de vehículos, gastos y mantenimiento, y carga y baja de documentos de vehículo.

Los controles que **no** persisten datos MUST permanecer operativos sin nivel `write`: en particular, cancelar un formulario, volver al listado y navegar de una fila del listado a su detalle.

La consulta de los datos MUST seguir disponible con nivel `read`, incluida la **descarga** de un documento ya cargado y la lectura de las tablas de gastos y del historial de mantenimiento: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla.

#### Scenario: Alta y edición de vehículos

- **GIVEN** una cuenta con permiso `read` sobre `vehiculos` y ningún otro nivel
- **WHEN** la cuenta abre el listado de vehículos y luego el detalle de uno
- **THEN** las acciones de crear y de editar están visibles y no se pueden activar, y la fila del listado sigue navegando al detalle

#### Scenario: Guardado del formulario de vehículo

- **GIVEN** una cuenta con permiso `read` sobre `vehiculos` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un vehículo
- **THEN** ninguno de sus campos acepta entrada, la acción de guardar no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Gastos y mantenimiento de un vehículo

- **GIVEN** una cuenta con permiso `read` sobre `vehiculos` y ningún otro nivel
- **WHEN** la cuenta abre los gastos y el mantenimiento de un vehículo
- **THEN** no puede registrar gastos ni acciones de mantenimiento, y los gastos y el historial de mantenimiento siguen siendo legibles

#### Scenario: Documentos de vehículo sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `vehiculos` y ningún otro nivel
- **WHEN** la cuenta abre los documentos de un vehículo
- **THEN** no puede cargar ni dar de baja documentos, y sí puede consultar y descargar los documentos ya cargados

#### Scenario: Cancelar un formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `vehiculos` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un vehículo y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Aviso de modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `vehiculos` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de vehículos
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `vehiculos`
- **WHEN** la cuenta recorre el listado, el detalle, el formulario, los gastos, el mantenimiento y los documentos de un vehículo
- **THEN** todas las acciones de escritura se pueden activar con normalidad

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta abre la pantalla de vehículos
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre conductores no habilita vehículos

- **GIVEN** una cuenta con permiso `write` sobre `conductores` y solo `read` sobre `vehiculos`
- **WHEN** la cuenta abre la pantalla de vehículos
- **THEN** queda en modo solo lectura, porque `vehiculos` y `conductores` son módulos independientes desde este cambio y el gateo se resuelve contra el módulo de la ruta

## MODIFIED Requirements

### Requirement: Carga de los permisos de la cuenta activa
El sistema SHALL cargar, al establecerse una sesión, los permisos por módulo de la cuenta activa leyendo `modulos.permisos` cruzado con `modulos.modulos`, y MUST exponerlos en `useAuth()` como una estructura tipada `Modulo -> NivelAcceso`. Los módulos válidos MUST ser exactamente los siete seedeados por el backend: `pacientes`, `hojas_de_ruta`, `obra_social`, `facturacion`, `presupuestos`, `conductores` y `vehiculos`.

#### Scenario: Cuenta con permisos parciales
- **WHEN** la cuenta activa tiene permiso `read` sobre `pacientes` y ninguno sobre los demás módulos
- **THEN** `useAuth()` expone un mapa con `pacientes: 'read'` y sin entradas para los otros seis módulos

#### Scenario: Cuenta sin ningún permiso
- **WHEN** la cuenta activa no tiene ninguna fila en `modulos.permisos`
- **THEN** `useAuth()` expone un mapa vacío y el sistema sigue considerando la sesión válida

### Requirement: Mapeo declarativo de ruta a módulo
El sistema SHALL declarar en un único punto de verdad (`app/routes.ts`, junto a `APP_ROUTES`) a qué módulo del backend corresponde cada ruta del frontend, en una relación 1:1: ninguna ruta MUST compartir módulo con otra ruta distinta. Las rutas que no pertenecen a ningún módulo (Dashboard, vitrina del design system, gestión de cuentas) MUST declararlo explícitamente como ausencia de módulo, no por omisión.

#### Scenario: Ruta con módulo asociado
- **WHEN** se consulta el módulo de `/facturacion`
- **THEN** se obtiene `facturacion`

#### Scenario: Rutas antes agrupadas ahora resuelven módulos independientes
- **WHEN** se consulta el módulo de `/vehiculos` y el de `/presupuestos`
- **THEN** se obtiene `vehiculos` y `presupuestos` respectivamente, cada uno su propio módulo, sin agrupación con `conductores` ni `facturacion`

#### Scenario: Ruta sin módulo
- **WHEN** se consulta el módulo de `/`
- **THEN** se obtiene ausencia de módulo, y el acceso queda condicionado solo a estar autenticado

### Requirement: Navegación filtrada por permisos
El sistema SHALL mostrar en la navegación del shell únicamente los módulos sobre los que la cuenta activa tiene al menos nivel `read`, más las rutas sin módulo asociado. La entrada de administración de cuentas MUST mostrarse solo a cuentas con rol `admin`.

#### Scenario: Navegación de una cuenta con permisos parciales
- **WHEN** la cuenta activa tiene permiso solo sobre `pacientes`
- **THEN** la navegación muestra Dashboard y Pacientes, y no muestra Obras Sociales, Conductores, Vehículos, Hojas de Ruta, Presupuestos ni Facturación — porque `pacientes` y `hojas_de_ruta` son ahora módulos independientes, tener uno no implica tener el otro

#### Scenario: Entrada de cuentas solo para admin
- **WHEN** la cuenta activa tiene rol `empleado`
- **THEN** la navegación no incluye la entrada de administración de cuentas

#### Scenario: Cuenta sin ningún módulo habilitado
- **WHEN** la cuenta activa no tiene permiso sobre ningún módulo
- **THEN** el shell muestra un mensaje indicando que hay que solicitar acceso a la administradora, en vez de una navegación vacía sin explicación

### Requirement: Gateo de escritura en la pantalla de Facturación

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `facturacion` a todas las acciones que persisten datos en la pantalla de facturación.

El gateo MUST cubrir tanto las acciones de CRUD (alta, edición, guardado) como las acciones que no son un CRUD limpio: emitir una factura, confirmar su emisión, registrar un cobro, aplicar una corrección de estado, editar asistencias y seleccionar días facturables. Todas estas acciones MUST requerir nivel `write`; ninguna MUST requerir nivel `admin`.

La consulta de los datos MUST seguir disponible con nivel `read`, incluidas la vista imprimible de una factura y la **descarga** de un documento ya cargado: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla.

#### Scenario: Alta y edición de facturas

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre el listado de facturas y luego el detalle de una
- **THEN** las acciones de crear y de editar están visibles y no se pueden activar, y la fila del listado sigue navegando al detalle

#### Scenario: Guardado del formulario de factura

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de una factura
- **THEN** ninguno de los campos de sus bloques de datos básicos y económicos acepta entrada, la acción de guardar no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Emisión de una factura

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre el detalle de una factura emitible
- **THEN** las acciones de emitir la factura y de confirmar su emisión están visibles y no se pueden activar

#### Scenario: Registro de un cobro

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre el panel de cobros de una factura
- **THEN** no puede registrar un cobro ni completar sus campos, y los cobros ya registrados siguen siendo legibles

#### Scenario: Corrección de estado de cobro

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre la sección de cobros de una factura
- **THEN** la acción de aplicar una corrección de estado no se puede activar

#### Scenario: Edición de asistencias y días facturables

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre el editor de asistencias y el selector de días facturables de una factura
- **THEN** no puede modificar asistencias ni la selección de días facturables, y los valores actuales siguen siendo legibles

#### Scenario: Acciones no-CRUD con nivel write

- **GIVEN** una cuenta con permiso `write` sobre `facturacion` y sin rol `admin`
- **WHEN** la cuenta intenta emitir una factura, registrar un cobro, aplicar una corrección de estado y editar asistencias
- **THEN** las cuatro acciones se pueden activar, porque requieren nivel `write` y no nivel `admin`

#### Scenario: Lectura preservada en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre el detalle de una factura
- **THEN** el resumen de la factura, la vista imprimible, la alerta de cupo y el aviso de discrepancias se renderizan completos

#### Scenario: Documentos de la factura sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre los documentos de una factura
- **THEN** no puede cargar ni dar de baja documentos, y sí puede consultar y descargar los documentos ya cargados

#### Scenario: Cancelar un formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de una factura y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Aviso de modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de facturación
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta abre la pantalla de facturación
- **THEN** todas las acciones de escritura se pueden activar, incluidas emitir factura y registrar cobro, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre presupuestos no habilita facturación

- **GIVEN** una cuenta con permiso `write` sobre `presupuestos` y solo `read` sobre `facturacion`
- **WHEN** la cuenta abre la pantalla de facturación
- **THEN** queda en modo solo lectura, porque `facturacion` y `presupuestos` son módulos independientes desde este cambio y el gateo se resuelve contra el módulo de la ruta

### Requirement: Gateo de escritura en la pantalla de Obras Sociales

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `obra_social` a todas las acciones que persisten datos en la pantalla de obras sociales: alta, edición, guardado, y la administración del checklist de documentación y de la plantilla de factura. La consulta de esos mismos datos MUST seguir disponible con nivel `read`.

#### Scenario: Alta desde el listado

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el listado de obras sociales
- **THEN** la acción de crear una obra social está visible y no se puede activar, tanto en el encabezado del listado como en el atajo del estado vacío

#### Scenario: Edición desde el listado y desde el detalle

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el listado de obras sociales y luego el detalle de una de ellas
- **THEN** la acción de editar está visible y no se puede activar en los dos lugares, y la fila del listado sigue navegando al detalle

#### Scenario: Guardado del formulario

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de una obra social
- **THEN** la acción de guardar no se puede activar y no se emite ninguna escritura al repositorio

#### Scenario: Checklist de documentación

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el editor de checklist de una obra social
- **THEN** no puede agregar, renombrar, reordenar ni eliminar ítems, y el checklist sigue siendo legible

#### Scenario: Plantilla de factura

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el editor de plantilla de factura de una obra social
- **THEN** no puede agregar, editar, reordenar ni eliminar campos, y la plantilla sigue siendo legible

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `obra_social`
- **WHEN** la cuenta recorre el listado, el detalle, el formulario, el checklist y la plantilla de factura
- **THEN** todas las acciones de escritura se pueden activar con normalidad

#### Scenario: Permiso sobre otro módulo no habilita este

- **GIVEN** una cuenta con permiso `write` sobre `pacientes` y solo `read` sobre `obra_social`
- **WHEN** la cuenta abre la pantalla de obras sociales
- **THEN** queda en modo solo lectura, porque el gateo se resuelve contra el módulo de la ruta y no contra cualquier permiso de escritura de la cuenta

### Requirement: Gateo de escritura en la pantalla de Conductores

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `conductores` a todas las acciones que persisten datos en la pantalla de conductores: alta, edición y guardado de conductores, la asignación semanal, y la carga y baja de documentos de conductor.

Los controles que **no** persisten datos MUST permanecer operativos sin nivel `write`: en particular, cancelar un formulario, volver al listado y navegar de una fila del listado a su detalle.

La consulta de los datos MUST seguir disponible con nivel `read`, incluida la **descarga** de un documento ya cargado y la lectura de la tabla de asignación semanal: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla.

#### Scenario: Alta y edición de conductores

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre el listado de conductores y luego el detalle de uno
- **THEN** las acciones de crear y de editar están visibles y no se pueden activar, y la fila del listado sigue navegando al detalle

#### Scenario: Guardado del formulario de conductor

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un conductor
- **THEN** ninguno de sus campos acepta entrada, la acción de guardar no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Asignación semanal de conductores

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre la tabla de asignación semanal
- **THEN** no puede modificar ni enviar la asignación, y la tabla sigue siendo legible

#### Scenario: Documentos de conductor sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre los documentos de un conductor
- **THEN** no puede cargar ni dar de baja documentos, y sí puede consultar y descargar los documentos ya cargados

#### Scenario: Cancelar un formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un conductor y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Aviso de modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de conductores
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `conductores`
- **WHEN** la cuenta recorre el listado, el detalle, el formulario, la asignación semanal y los documentos de un conductor
- **THEN** todas las acciones de escritura se pueden activar con normalidad

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta abre la pantalla de conductores
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre vehículos no habilita conductores

- **GIVEN** una cuenta con permiso `write` sobre `vehiculos` y solo `read` sobre `conductores`
- **WHEN** la cuenta abre la pantalla de conductores
- **THEN** queda en modo solo lectura, porque `conductores` y `vehiculos` son módulos independientes desde este cambio y el gateo se resuelve contra el módulo de la ruta

### Requirement: Gateo de escritura en la pantalla de Pacientes

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `pacientes` a todas las acciones que persisten datos en la pantalla de pacientes: alta, edición y guardado de la ficha, y la administración del CUD, de las direcciones, de las personas a cargo y de los documentos del paciente. Este módulo MUST NOT gatear la pantalla de Hojas de Ruta — esa pantalla resuelve el módulo independiente `hojas_de_ruta`.

La consulta de esos mismos datos MUST seguir disponible con nivel `read`. En particular, **descargar** un documento ya cargado MUST seguir disponible con nivel `read`: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor, que autoriza la lectura de los documentos del módulo con nivel `read`.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla, y los editores anidados MUST resolver el permiso sin recibir el módulo de la pantalla ni declararlo por su cuenta.

#### Scenario: Alta desde el listado

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el listado de pacientes
- **THEN** la acción de crear un paciente está visible y no se puede activar, tanto en el encabezado del listado como en el atajo del estado vacío

#### Scenario: Edición desde el listado y desde el resumen

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el listado de pacientes y luego la ficha de uno de ellos
- **THEN** la acción de editar está visible y no se puede activar en los dos lugares, y la fila del listado sigue navegando a la ficha

#### Scenario: Campos y guardado del formulario

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un paciente
- **THEN** ninguno de sus campos acepta entrada, la acción de guardar no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Cancelar el formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un paciente y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Editor de CUD

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la ficha de un paciente con datos de CUD
- **THEN** no puede iniciar la edición, editar, quitar ni guardar el CUD, y los datos del CUD siguen siendo legibles

#### Scenario: Cancelar la edición interna de un editor anidado

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** un editor anidado ofrece una acción de cancelar su propia edición
- **THEN** esa acción de cancelar se puede activar, porque no persiste ningún dato

#### Scenario: Editor de direcciones

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el editor de direcciones de un paciente
- **THEN** no puede agregar, editar ni eliminar direcciones, y las direcciones existentes siguen siendo legibles

#### Scenario: Editor de personas a cargo

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el editor de personas a cargo de un paciente
- **THEN** no puede agregar, editar ni eliminar personas a cargo, y las existentes siguen siendo legibles

#### Scenario: Documentos del paciente sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre los documentos de un paciente
- **THEN** no puede cargar ni dar de baja documentos, y sí puede consultar y descargar los documentos ya cargados

#### Scenario: Aviso de modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de pacientes
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo, tanto en la vista de listado como en la de ficha

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `pacientes`
- **WHEN** la cuenta recorre el listado, la ficha, el formulario, el CUD, las direcciones, las personas a cargo y los documentos
- **THEN** todas las acciones de escritura se pueden activar con normalidad, y la pantalla no muestra aviso de solo lectura

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta abre la pantalla de pacientes
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre otro módulo no habilita este

- **GIVEN** una cuenta con permiso `write` sobre `obra_social` y solo `read` sobre `pacientes`
- **WHEN** la cuenta abre la pantalla de pacientes
- **THEN** queda en modo solo lectura, porque el gateo se resuelve contra el módulo de la ruta y no contra cualquier permiso de escritura de la cuenta

#### Scenario: Permiso sobre hojas de ruta no habilita pacientes

- **GIVEN** una cuenta con permiso `write` sobre `hojas_de_ruta` y solo `read` sobre `pacientes`
- **WHEN** la cuenta abre la pantalla de pacientes
- **THEN** queda en modo solo lectura, porque `pacientes` y `hojas_de_ruta` son módulos independientes desde este cambio

### Requirement: Gateo de escritura en la pantalla de Hojas de Ruta

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo **`hojas_de_ruta`** a todas las acciones que persisten datos en la pantalla de hojas de ruta. El gateo del cliente MUST resolverse contra el módulo que declara la ruta y MUST NOT re-derivarse ni nombrarse dentro de los componentes de la pantalla.

El gateo MUST cubrir el alta de la hoja del día, el alta de un recorrido, la sugerencia de orden, la entrada al modo de edición de un recorrido, el reordenamiento y la baja de paradas, el agregado de un pasajero, el cambio de vehículo y de conductor de un recorrido, la escritura de notas del recorrido y el movimiento de filas en la vista global. Todas estas acciones MUST requerir nivel `write`; ninguna MUST requerir nivel `admin`.

El gateo MUST alcanzar también los caminos de escritura que **no** pasan por un control de acción explícito: los campos que persisten al perder el foco o al cambiar de valor MUST quedar inertes sin nivel `write`, y con nivel `read` la pantalla MUST NOT emitir ninguna escritura al repositorio.

Los controles que **no** persisten datos MUST permanecer operativos sin nivel `write`. En particular:

- los conmutadores entre las vistas de armado, global e imprimir MUST seguir funcionando, y las tres vistas MUST seguir renderizándose completas;
- el selector de fecha MUST seguir funcionando, y la cuenta MUST poder consultar la hoja de cualquier día;
- la acción que **sale** del modo de edición de un recorrido MUST seguir siendo activable, porque no persiste ningún dato.

La consulta de los datos MUST seguir disponible con nivel `read`, incluida la vista imprimible de una hoja de ruta: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla, y los componentes de campos anidados MUST resolver el permiso sin recibir el módulo de la pantalla ni declararlo por su cuenta.

#### Scenario: Alta de la hoja del día

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de hojas de ruta en un día sin hoja cargada
- **THEN** la acción de crear la hoja de ese día está visible y no se puede activar, y el mensaje de que no hay hoja cargada sigue siendo legible

#### Scenario: Alta de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre el formulario de alta de recorrido de la vista de armado
- **THEN** ninguno de sus campos acepta entrada —ni el selector de paciente, ni los de tramo, dirección y hora, ni los de vehículo y conductor, ni la marca de recorrido manual, ni las notas—, la acción de crear el recorrido no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Sugerencia de orden y entrada al modo de edición de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre la tarjeta de un recorrido ya armado
- **THEN** las acciones de sugerir un orden y de entrar a editar están visibles y no se pueden activar, y el resumen del recorrido sigue siendo legible

#### Scenario: Salir del modo de edición de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la tarjeta de un recorrido está en modo de edición y la cuenta activa la acción de salir de ese modo
- **THEN** la acción se ejecuta y la tarjeta vuelve al resumen, porque salir del modo de edición no persiste ningún dato

#### Scenario: Reordenamiento y baja de paradas

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre la lista editable de paradas de un recorrido con al menos tres paradas
- **THEN** las acciones de subir, bajar y quitar una parada **intermedia** están visibles y no se pueden activar, las paradas siguen siendo legibles, y no se emite ninguna escritura al repositorio

#### Scenario: Agregado de un pasajero a un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre el panel de asignación de un recorrido
- **THEN** ninguno de sus campos acepta entrada, la acción de agregar el pasajero no se puede activar, y los requisitos del paciente seleccionado siguen siendo legibles

#### Scenario: Cambio de vehículo y de conductor de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre en modo de edición el encabezado de vehículo y conductor de un recorrido
- **THEN** ninguno de los dos selectores acepta cambios y el repositorio no recibe ninguna escritura, aunque esos selectores persistan al cambiar de valor y no detrás de una acción de confirmación

#### Scenario: Notas de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta intenta escribir una nota en un recorrido en modo de edición y luego quita el foco del campo
- **THEN** el campo no acepta entrada y el repositorio no recibe ninguna escritura, aunque esa nota persista al perder el foco y no detrás de una acción de confirmación

#### Scenario: Movimiento de filas en la vista global

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre la vista global de la hoja de ruta
- **THEN** no puede elegir un recorrido destino ni mover una fila, y la vista global y sus conflictos siguen siendo legibles

#### Scenario: Conmutadores de vista operativos sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta conmuta entre las vistas de armado, global e imprimir
- **THEN** los tres conmutadores se pueden activar y las tres vistas se renderizan completas, porque conmutar de vista no persiste ningún dato

#### Scenario: Selector de fecha operativo sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta cambia la fecha de consulta de la pantalla
- **THEN** el selector acepta el cambio y la pantalla muestra la hoja de ruta de ese día, porque elegir qué día se consulta no persiste ningún dato

#### Scenario: Vista imprimible de una hoja de ruta

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre la vista imprimible de una hoja de ruta
- **THEN** la vista se renderiza completa y es utilizable

#### Scenario: Vistas de consulta del armado

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta recorre la vista de armado
- **THEN** el mapa del recorrido, los datos resumidos del recorrido y los requisitos del paciente se renderizan completos

#### Scenario: Aviso de modo solo lectura en las tres vistas

- **GIVEN** una cuenta con permiso `read` sobre `hojas_de_ruta` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de hojas de ruta y conmuta entre las vistas de armado, global e imprimir
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo, y el aviso sigue visible en las tres vistas

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `hojas_de_ruta`
- **WHEN** la cuenta crea la hoja del día, da de alta un recorrido, sugiere un orden, reordena paradas, agrega un pasajero, cambia vehículo y conductor y mueve una fila en la vista global
- **THEN** todas las acciones se pueden activar con normalidad, y la pantalla no muestra aviso de solo lectura

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta abre la pantalla de hojas de ruta
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre pacientes ya no habilita esta pantalla

- **GIVEN** una cuenta con permiso `write` sobre `pacientes` y solo `read` sobre `hojas_de_ruta`
- **WHEN** la cuenta abre la pantalla de hojas de ruta
- **THEN** queda en modo solo lectura, porque desde este cambio `pacientes` y `hojas_de_ruta` son módulos independientes y ya no comparten permiso

#### Scenario: Permiso de escritura sobre conductores no habilita esta pantalla

- **GIVEN** una cuenta con permiso `write` sobre `conductores` y solo `read` sobre `hojas_de_ruta`
- **WHEN** la cuenta abre la pantalla de hojas de ruta
- **THEN** queda en modo solo lectura, aunque pueda escribir en las pantallas de conductores y de vehículos, porque las tablas de recorridos las gatea el módulo `hojas_de_ruta` y no el de los vehículos y conductores que la pantalla solo consulta

#### Scenario: Permiso de escritura sobre hojas de ruta habilita esta pantalla sin permiso sobre conductores

- **GIVEN** una cuenta con permiso `write` sobre `hojas_de_ruta` y solo `read` sobre `conductores`
- **WHEN** la cuenta arma una hoja de ruta eligiendo vehículo y conductor
- **THEN** todas las acciones de escritura de la pantalla se pueden activar, porque los vehículos y conductores solo se consultan para poblar los selectores y no se modifican desde acá

## REMOVED Requirements

### Requirement: Gateo de escritura en las pantallas de Presupuestos y Facturación
**Reason**: `presupuestos` y `facturacion` pasan a ser módulos independientes en este cambio — el requisito combinado se reemplaza por dos requisitos separados: "Gateo de escritura en la pantalla de Presupuestos" (ADDED) y "Gateo de escritura en la pantalla de Facturación" (MODIFIED, ya existía como parte de este requisito combinado).
**Migration**: Los escenarios de Presupuestos migraron sin cambios de comportamiento al nuevo requisito de Presupuestos, referenciando el módulo `presupuestos` en vez de `facturacion`. Los escenarios de Facturación migraron al requisito MODIFIED de Facturación.

### Requirement: Gateo de escritura en las pantallas de Conductores y Vehículos
**Reason**: `conductores` y `vehiculos` pasan a ser módulos independientes en este cambio — el requisito combinado se reemplaza por dos requisitos separados: "Gateo de escritura en la pantalla de Vehículos" (ADDED) y "Gateo de escritura en la pantalla de Conductores" (MODIFIED, ya existía como parte de este requisito combinado).
**Migration**: Los escenarios de Vehículos migraron sin cambios de comportamiento al nuevo requisito de Vehículos, referenciando el módulo `vehiculos` en vez de `conductores`. Los escenarios de Conductores migraron al requisito MODIFIED de Conductores.
