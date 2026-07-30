## ADDED Requirements

### Requirement: Gateo de escritura en las pantallas de Conductores, Vehículos y Hojas de Ruta

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `conductores` a todas las acciones que persisten datos en **las tres** rutas de ese módulo —conductores, vehículos y hojas de ruta—, porque las tres resuelven el mismo módulo del backend según la agrupación de `seed_modulos.sql`.

El gateo MUST cubrir el alta, la edición y el guardado de conductores y vehículos, la asignación semanal, los gastos y el mantenimiento de vehículos, y el armado de hojas de ruta: alta de hoja, alta de recorrido, sugerencia de orden, reordenamiento de paradas, asignación de vehículo y conductor, y movimiento de filas en la vista global. Todas estas acciones MUST requerir nivel `write`; ninguna MUST requerir nivel `admin`.

Los controles que **no** persisten datos MUST permanecer operativos sin nivel `write`. En particular, los conmutadores entre las vistas de la pantalla de hojas de ruta MUST seguir funcionando con nivel `read`, y las tres vistas MUST seguir renderizándose: una cuenta con `read` está autorizada a ver esos datos y no debe quedar encerrada en una sola vista.

La consulta de los datos MUST seguir disponible con nivel `read`, incluidas la vista imprimible de una hoja de ruta y la **descarga** de un documento ya cargado: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

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

#### Scenario: Armado de una hoja de ruta

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de hojas de ruta en la vista de armado
- **THEN** no puede crear una hoja, ni dar de alta un recorrido, ni sugerir un orden, ni entrar a editar un recorrido

#### Scenario: Reordenamiento de paradas

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre la lista de paradas de un recorrido
- **THEN** no puede reordenar las paradas, y las paradas siguen siendo legibles

#### Scenario: Asignación de vehículo y conductor a un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre el panel de asignación de un recorrido
- **THEN** no puede modificar ni confirmar la asignación, y la asignación actual sigue siendo legible

#### Scenario: Movimiento de filas en la vista global

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre la vista global de hojas de ruta
- **THEN** no puede mover filas, y la vista global sigue siendo legible

#### Scenario: Conmutadores de vista de hojas de ruta operativos sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta conmuta entre las vistas de armado, global e imprimir de la pantalla de hojas de ruta
- **THEN** los tres conmutadores se pueden activar y las tres vistas se renderizan, porque conmutar de vista no persiste ningún dato

#### Scenario: Vista imprimible de una hoja de ruta

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre la vista imprimible de una hoja de ruta
- **THEN** la vista se renderiza completa y es utilizable

#### Scenario: Documentos de conductor y de vehículo sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre los documentos de un conductor y los de un vehículo
- **THEN** no puede cargar ni dar de baja documentos en ninguno de los dos, y sí puede consultar y descargar los documentos ya cargados

#### Scenario: Cancelar un formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un conductor o de un vehículo y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Aviso de modo solo lectura en las tres rutas

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta abre las pantallas de conductores, de vehículos y de hojas de ruta
- **THEN** las tres pantallas informan que está en modo solo lectura sobre ese módulo

#### Scenario: Coherencia del permiso entre las tres rutas

- **GIVEN** una cuenta con permiso `write` sobre `conductores`
- **WHEN** la cuenta recorre las pantallas de conductores, de vehículos y de hojas de ruta
- **THEN** tiene escritura habilitada en las tres, y ninguna muestra aviso de solo lectura

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta recorre las pantallas de conductores, de vehículos y de hojas de ruta
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre otro módulo no habilita este

- **GIVEN** una cuenta con permiso `write` sobre `facturacion` y solo `read` sobre `conductores`
- **WHEN** la cuenta abre las pantallas de conductores, de vehículos y de hojas de ruta
- **THEN** las tres quedan en modo solo lectura, porque el gateo se resuelve contra el módulo de la ruta y no contra cualquier permiso de escritura de la cuenta
