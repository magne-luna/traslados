## ADDED Requirements

### Requirement: Gateo de escritura en la pantalla de Pacientes

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `pacientes` a todas las acciones que persisten datos en la pantalla de pacientes: alta, edición y guardado de la ficha, y la administración del CUD, de las direcciones, de las personas a cargo y de los documentos del paciente.

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
