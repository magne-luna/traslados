## ADDED Requirements

### Requirement: Gateo de escritura en las pantallas de Conductores y Vehículos

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `conductores` a todas las acciones que persisten datos en **las dos** rutas de ese módulo —conductores y vehículos—, porque ambas resuelven el mismo módulo del backend.

> **Fuera de alcance de este requisito**: la pantalla de hojas de ruta. Su ruta resuelve el módulo `pacientes`, no `conductores` —lo confirma tanto el mapeo de rutas como la Row Level Security de las tablas de recorridos—, así que su gateo se especifica en un requisito aparte, scopeado a ese módulo.

El gateo MUST cubrir el alta, la edición y el guardado de conductores y vehículos, la asignación semanal, los gastos y el mantenimiento de vehículos, y la carga y baja de documentos de conductor y de vehículo. Todas estas acciones MUST requerir nivel `write`; ninguna MUST requerir nivel `admin`.

Los controles que **no** persisten datos MUST permanecer operativos sin nivel `write`: en particular, cancelar un formulario, volver al listado y navegar de una fila del listado a su detalle.

La consulta de los datos MUST seguir disponible con nivel `read`, incluida la **descarga** de un documento ya cargado y la lectura de las tablas de asignación semanal, de gastos y del historial de mantenimiento: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

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

#### Scenario: Alta y edición de vehículos

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre el listado de vehículos y luego el detalle de uno
- **THEN** las acciones de crear y de editar están visibles y no se pueden activar, y la fila del listado sigue navegando al detalle

#### Scenario: Guardado del formulario de vehículo

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un vehículo
- **THEN** ninguno de sus campos acepta entrada, la acción de guardar no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Gastos y mantenimiento de un vehículo

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre los gastos y el mantenimiento de un vehículo
- **THEN** no puede registrar gastos ni acciones de mantenimiento, y los gastos y el historial de mantenimiento siguen siendo legibles

#### Scenario: Documentos de conductor y de vehículo sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre los documentos de un conductor y los de un vehículo
- **THEN** no puede cargar ni dar de baja documentos en ninguno de los dos, y sí puede consultar y descargar los documentos ya cargados

#### Scenario: Cancelar un formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un conductor o de un vehículo y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Aviso de modo solo lectura en las dos rutas

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre las pantallas de conductores y de vehículos
- **THEN** las dos pantallas informan que está en modo solo lectura sobre ese módulo

#### Scenario: Coherencia del permiso entre las dos rutas

- **GIVEN** una cuenta con permiso `write` sobre `conductores`
- **WHEN** la cuenta recorre las pantallas de conductores y de vehículos
- **THEN** tiene escritura habilitada en las dos, y ninguna muestra aviso de solo lectura

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta recorre las pantallas de conductores y de vehículos
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre otro módulo no habilita este

- **GIVEN** una cuenta con permiso `write` sobre `facturacion` y solo `read` sobre `conductores`
- **WHEN** la cuenta abre las pantallas de conductores y de vehículos
- **THEN** las dos quedan en modo solo lectura, porque el gateo se resuelve contra el módulo de la ruta y no contra cualquier permiso de escritura de la cuenta
