## ADDED Requirements

### Requirement: Gateo de escritura en las pantallas de Presupuestos y Facturación

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `facturacion` a todas las acciones que persisten datos en **las dos** rutas de ese módulo —presupuestos y facturación—, porque ambas resuelven el mismo módulo del backend según la agrupación de `seed_modulos.sql`.

El gateo MUST cubrir tanto las acciones de CRUD (alta, edición, guardado) como las acciones que no son un CRUD limpio: emitir una factura, confirmar su emisión, registrar un cobro, aplicar una corrección de estado, editar asistencias y seleccionar días facturables. Todas estas acciones MUST requerir nivel `write`; ninguna MUST requerir nivel `admin`.

La consulta de los datos MUST seguir disponible con nivel `read`, incluidas la vista imprimible de una factura y la **descarga** de un documento ya cargado: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla.

#### Scenario: Alta y edición de presupuestos

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre el listado de presupuestos y luego el detalle de uno
- **THEN** las acciones de crear y de editar están visibles y no se pueden activar, y la fila del listado sigue navegando al detalle

#### Scenario: Guardado del formulario de presupuesto

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un presupuesto
- **THEN** ninguno de sus campos acepta entrada, la acción de guardar no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Autorización de un presupuesto

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre el detalle de un presupuesto con autorización
- **THEN** no puede iniciar la edición de la autorización ni guardarla, y los datos de la autorización siguen siendo legibles

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
- **WHEN** la cuenta tiene abierto el formulario de un presupuesto o de una factura y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Aviso de modo solo lectura en las dos rutas

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de presupuestos y la pantalla de facturación
- **THEN** las dos pantallas informan que está en modo solo lectura sobre ese módulo

#### Scenario: Coherencia del permiso entre las dos rutas

- **GIVEN** una cuenta con permiso `write` sobre `facturacion`
- **WHEN** la cuenta recorre la pantalla de presupuestos y la de facturación
- **THEN** tiene escritura habilitada en ambas, y ninguna de las dos muestra aviso de solo lectura

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta recorre las pantallas de presupuestos y de facturación
- **THEN** todas las acciones de escritura se pueden activar, incluidas emitir factura y registrar cobro, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre otro módulo no habilita este

- **GIVEN** una cuenta con permiso `write` sobre `pacientes` y solo `read` sobre `facturacion`
- **WHEN** la cuenta abre las pantallas de presupuestos y de facturación
- **THEN** las dos quedan en modo solo lectura, porque el gateo se resuelve contra el módulo de la ruta y no contra cualquier permiso de escritura de la cuenta
