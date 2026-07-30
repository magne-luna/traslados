## ADDED Requirements

### Requirement: Gateo de escritura en la pantalla de Hojas de Ruta

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo **`pacientes`** a todas las acciones que persisten datos en la pantalla de hojas de ruta, porque las tablas que esa pantalla escribe —`pacientes.recorridos` y `pacientes.historial_recorridos`— están gateadas en el servidor por `modulos.tiene_permiso('pacientes', …)`. El gateo del cliente MUST resolverse contra el módulo que declara la ruta y MUST NOT re-derivarse ni nombrarse dentro de los componentes de la pantalla.

El gateo MUST cubrir el alta de la hoja del día, el alta de un recorrido, la sugerencia de orden, la entrada al modo de edición de un recorrido, el reordenamiento y la baja de paradas, el agregado de un pasajero, el cambio de vehículo y de conductor de un recorrido, la escritura de notas del recorrido y el movimiento de filas en la vista global. Todas estas acciones MUST requerir nivel `write`; ninguna MUST requerir nivel `admin`.

El gateo MUST alcanzar también los caminos de escritura que **no** pasan por un control de acción explícito: los campos que persisten al perder el foco o al cambiar de valor MUST quedar inertes sin nivel `write`, y con nivel `read` la pantalla MUST NOT emitir ninguna escritura al repositorio.

Los controles que **no** persisten datos MUST permanecer operativos sin nivel `write`. En particular:

- los conmutadores entre las vistas de armado, global e imprimir MUST seguir funcionando, y las tres vistas MUST seguir renderizándose completas;
- el selector de fecha MUST seguir funcionando, y la cuenta MUST poder consultar la hoja de cualquier día;
- la acción que **sale** del modo de edición de un recorrido MUST seguir siendo activable, porque no persiste ningún dato.

La consulta de los datos MUST seguir disponible con nivel `read`, incluida la vista imprimible de una hoja de ruta: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla, y los componentes de campos anidados MUST resolver el permiso sin recibir el módulo de la pantalla ni declararlo por su cuenta.

#### Scenario: Alta de la hoja del día

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de hojas de ruta en un día sin hoja cargada
- **THEN** la acción de crear la hoja de ese día está visible y no se puede activar, y el mensaje de que no hay hoja cargada sigue siendo legible

#### Scenario: Alta de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el formulario de alta de recorrido de la vista de armado
- **THEN** ninguno de sus campos acepta entrada —ni el selector de paciente, ni los de tramo, dirección y hora, ni los de vehículo y conductor, ni la marca de recorrido manual, ni las notas—, la acción de crear el recorrido no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Sugerencia de orden y entrada al modo de edición de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la tarjeta de un recorrido ya armado
- **THEN** las acciones de sugerir un orden y de entrar a editar están visibles y no se pueden activar, y el resumen del recorrido sigue siendo legible

#### Scenario: Salir del modo de edición de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la tarjeta de un recorrido está en modo de edición y la cuenta activa la acción de salir de ese modo
- **THEN** la acción se ejecuta y la tarjeta vuelve al resumen, porque salir del modo de edición no persiste ningún dato

#### Scenario: Reordenamiento y baja de paradas

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la lista editable de paradas de un recorrido con al menos tres paradas
- **THEN** las acciones de subir, bajar y quitar una parada **intermedia** están visibles y no se pueden activar, las paradas siguen siendo legibles, y no se emite ninguna escritura al repositorio

#### Scenario: Agregado de un pasajero a un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el panel de asignación de un recorrido
- **THEN** ninguno de sus campos acepta entrada, la acción de agregar el pasajero no se puede activar, y los requisitos del paciente seleccionado siguen siendo legibles

#### Scenario: Cambio de vehículo y de conductor de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre en modo de edición el encabezado de vehículo y conductor de un recorrido
- **THEN** ninguno de los dos selectores acepta cambios y el repositorio no recibe ninguna escritura, aunque esos selectores persistan al cambiar de valor y no detrás de una acción de confirmación

#### Scenario: Notas de un recorrido

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta intenta escribir una nota en un recorrido en modo de edición y luego quita el foco del campo
- **THEN** el campo no acepta entrada y el repositorio no recibe ninguna escritura, aunque esa nota persista al perder el foco y no detrás de una acción de confirmación

#### Scenario: Movimiento de filas en la vista global

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la vista global de la hoja de ruta
- **THEN** no puede elegir un recorrido destino ni mover una fila, y la vista global y sus conflictos siguen siendo legibles

#### Scenario: Conmutadores de vista operativos sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta conmuta entre las vistas de armado, global e imprimir
- **THEN** los tres conmutadores se pueden activar y las tres vistas se renderizan completas, porque conmutar de vista no persiste ningún dato

#### Scenario: Selector de fecha operativo sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta cambia la fecha de consulta de la pantalla
- **THEN** el selector acepta el cambio y la pantalla muestra la hoja de ruta de ese día, porque elegir qué día se consulta no persiste ningún dato

#### Scenario: Vista imprimible de una hoja de ruta

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la vista imprimible de una hoja de ruta
- **THEN** la vista se renderiza completa y es utilizable

#### Scenario: Vistas de consulta del armado

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta recorre la vista de armado
- **THEN** el mapa del recorrido, los datos resumidos del recorrido y los requisitos del paciente se renderizan completos

#### Scenario: Aviso de modo solo lectura en las tres vistas

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de hojas de ruta y conmuta entre las vistas de armado, global e imprimir
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo, y el aviso sigue visible en las tres vistas

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `pacientes`
- **WHEN** la cuenta crea la hoja del día, da de alta un recorrido, sugiere un orden, reordena paradas, agrega un pasajero, cambia vehículo y conductor y mueve una fila en la vista global
- **THEN** todas las acciones se pueden activar con normalidad, y la pantalla no muestra aviso de solo lectura

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta abre la pantalla de hojas de ruta
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Coherencia con la pantalla de Pacientes

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de pacientes y la de hojas de ruta en la misma sesión
- **THEN** las dos quedan en modo solo lectura, porque las dos rutas resuelven el mismo módulo del backend

#### Scenario: Permiso de escritura sobre conductores no habilita esta pantalla

- **GIVEN** una cuenta con permiso `write` sobre `conductores` y solo `read` sobre `pacientes`
- **WHEN** la cuenta abre la pantalla de hojas de ruta
- **THEN** queda en modo solo lectura, aunque pueda escribir en las pantallas de conductores y de vehículos, porque las tablas de recorridos las gatea el módulo `pacientes` y no el de los vehículos y conductores que la pantalla solo consulta

#### Scenario: Permiso de escritura sobre pacientes habilita esta pantalla sin permiso sobre conductores

- **GIVEN** una cuenta con permiso `write` sobre `pacientes` y solo `read` sobre `conductores`
- **WHEN** la cuenta arma una hoja de ruta eligiendo vehículo y conductor
- **THEN** todas las acciones de escritura de la pantalla se pueden activar, porque los vehículos y conductores solo se consultan para poblar los selectores y no se modifican desde acá
