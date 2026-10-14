## Purpose

Permite registrar en la hoja de ruta que un recorrido no lo hace la flota propia sino una aplicación
(Uber u otra) o una agencia de remis, para saber cómo se resolvió cada viaje y a qué agencia se le
debe (pedido de Andrea, reunión 2026-10-07; RN-HR-05).

## ADDED Requirements

### Requirement: Tipo de transporte del recorrido
Cada recorrido de la hoja de ruta SHALL tener un tipo de transporte con exactamente uno de tres
valores: `propio`, `aplicacion` o `remis`. El valor por defecto MUST ser `propio`. Un recorrido
`propio` MUST tener vehículo y conductor; un recorrido `aplicacion` o `remis` (tercerizado) MUST NOT
tener vehículo ni conductor; un recorrido `remis` MUST tener un nombre de agencia no vacío (texto
libre); un recorrido que no es `remis` MUST NOT tener agencia.

#### Scenario: Recorrido nuevo sin tildar "Viaje tercerizado"
- **WHEN** la operadora crea un recorrido sin tildar "Viaje tercerizado"
- **THEN** el recorrido queda como `propio` y exige vehículo y conductor exactamente como antes de este change

#### Scenario: Recorrido por aplicación
- **WHEN** la operadora tilda "Viaje tercerizado", elige "Uber / aplicación" y guarda
- **THEN** el recorrido queda como `aplicacion`, sin vehículo, sin conductor y sin agencia

#### Scenario: Recorrido por remis con agencia
- **WHEN** la operadora tilda "Viaje tercerizado", elige "Remis", escribe "París" y guarda
- **THEN** el recorrido queda como `remis` con agencia "París", sin vehículo ni conductor

#### Scenario: Remis sin agencia
- **WHEN** la operadora elige "Remis" y deja la agencia vacía o solo con espacios
- **THEN** el recorrido no se guarda y se muestra un mensaje pidiendo la agencia

#### Scenario: Recorridos existentes
- **WHEN** se lee un recorrido cargado antes de este change
- **THEN** se trata como `propio`, con su vehículo y conductor de siempre

### Requirement: Formulario de recorrido con opción de tercerizado
El formulario de alta de recorrido y la edición de un recorrido existente SHALL ofrecer un control
"Viaje tercerizado" destildado por defecto. Al tildarlo MUST mostrar la elección entre "Uber /
aplicación" y "Remis" y, para Remis, un campo de texto de agencia; y MUST ocultar y dejar de validar
los selectores de vehículo y conductor. Al destildarlo MUST volver a mostrar y exigir vehículo y
conductor.

#### Scenario: Tildar oculta vehículo y conductor
- **WHEN** la operadora tilda "Viaje tercerizado"
- **THEN** los selectores de vehículo y conductor desaparecen y el aviso "ningún vehículo disponible tiene capacidad o accesorios compatibles" no bloquea el alta

#### Scenario: Paciente sin vehículo compatible
- **WHEN** ningún vehículo propio es compatible con el paciente elegido
- **THEN** la operadora igual puede crear el recorrido marcándolo como tercerizado

#### Scenario: Pasar un recorrido propio a tercerizado
- **WHEN** la operadora edita un recorrido `propio` y lo marca como remis "RSM"
- **THEN** al guardar el recorrido queda como `remis` "RSM" y pierde vehículo y conductor

#### Scenario: Volver un tercerizado a propio
- **WHEN** la operadora destilda "Viaje tercerizado" en un recorrido tercerizado
- **THEN** debe elegir vehículo y conductor antes de poder guardar

### Requirement: Asignación de pasajeros a un recorrido tercerizado
Agregar o mover una parada a un recorrido tercerizado SHALL NOT aplicar la validación de capacidad
del vehículo ni la de compatibilidad de accesorios de movilidad (RN-VE-01), porque no hay vehículo
propio contra el cual validar. Los recorridos `propio` MUST seguir validándose como hasta ahora.

#### Scenario: Paciente con silla de ruedas a un remis
- **WHEN** la operadora agrega a un recorrido `remis` un paciente que requiere un accesorio que ningún vehículo propio soporta
- **THEN** la parada se agrega sin error de compatibilidad ni de capacidad

#### Scenario: Recorrido propio sin cambios
- **WHEN** la operadora agrega un paciente incompatible a un recorrido `propio`
- **THEN** la asignación se bloquea con el motivo de incompatibilidad, igual que antes

### Requirement: Identificación visible del recorrido tercerizado
Donde la hoja de ruta identifica un recorrido por "vehículo · conductor" (tarjeta del recorrido,
vista global del día, destino al mover una parada y hoja imprimible), un recorrido tercerizado SHALL
mostrarse como "Uber / aplicación" o "Remis · <agencia>", nunca como "Vehículo desconocido" ni con un
id crudo. La vista global MUST agrupar los recorridos tercerizados aparte de los de flota propia.

#### Scenario: Tarjeta e imprimible de un remis
- **WHEN** la hoja del día tiene un recorrido `remis` con agencia "París"
- **THEN** la tarjeta y la hoja imprimible lo encabezan como "Remis · París", con sus paradas, orden y direcciones como cualquier recorrido

#### Scenario: Vista global con tercerizados
- **WHEN** la vista global del día tiene recorridos propios y tercerizados
- **THEN** los tercerizados aparecen en un grupo propio, identificados por su tipo y agencia

### Requirement: Coherencia del tipo de transporte garantizada por la base
La base de datos SHALL rechazar cualquier recorrido que viole las reglas de tipo de transporte
(propio sin vehículo o sin conductor, tercerizado con vehículo o conductor, remis sin agencia, agencia
en un no-remis, tipo fuera de los tres valores), independientemente del cliente que escriba. El alta y
la edición atómicas de la hoja de ruta MUST tratar como `propio` un recorrido que no informa tipo
de transporte, y MUST devolver un error identificable cuando el tipo de transporte es incoherente,
que la pantalla muestra en castellano sin perder lo cargado.

#### Scenario: Cliente viejo sin tipo de transporte
- **WHEN** se guarda una hoja de ruta con un recorrido que trae vehículo y conductor pero no informa tipo de transporte
- **THEN** el recorrido se guarda como `propio`

#### Scenario: Remis sin agencia rechazado por la base
- **WHEN** llega a la base un recorrido `remis` sin agencia
- **THEN** la escritura completa de la hoja de ruta se rechaza (ningún recorrido ni parada queda a medias) y la pantalla muestra "Revisá el tipo de transporte del recorrido"

#### Scenario: Paradas de un tercerizado
- **WHEN** se guardan las paradas de un recorrido tercerizado
- **THEN** quedan persistidas sin vehículo asociado y se leen de vuelta con el mismo orden, tramo y direcciones
