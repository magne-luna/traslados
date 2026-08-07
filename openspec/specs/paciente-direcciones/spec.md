# Paciente Direcciones

## Purpose

Define the requirements for managing multiple addresses per patient, including the independent modeling of outbound and return trips (ida/vuelta) with separate data entry, type/category support (home, school, therapies, CET, etc.), and days/hours of transport. Ensures traceability of addresses across the patient's record without auto-completion or implicit assumptions about symmetry.

---

## Requirements

### Requirement: Direcciones múltiples por paciente
El sistema SHALL permitir registrar múltiples direcciones por paciente (domicilio, escuela, terapias, CET), cada una con su tipo/etiqueta y, opcionalmente, días y horarios de traslado (RF-113). Al renderizar la lista de direcciones, el sistema MUST usar un identificador estable por dirección como key (nunca el índice del array), y ese identificador MUST ser el `id` real de la fila de `pacientes.direcciones` cuando la dirección ya está persistida, porque otras entidades la referencian por `id` con integridad referencial restrictiva. El sistema MUST preservar el `id` de una dirección al editarla: una edición se persiste como actualización de esa fila, NUNCA como borrado más alta.

#### Scenario: Alta de varias direcciones de distinto tipo
- **WHEN** el usuario agrega un domicilio y una escuela al mismo paciente
- **THEN** ambas quedan registradas como direcciones independientes del paciente y se persisten vía `update()`

#### Scenario: Editar una dirección conserva su identificador
- **WHEN** el usuario modifica la calle de una dirección ya persistida y guarda
- **THEN** la fila correspondiente se actualiza y su `id` no cambia
- **AND** las referencias existentes a esa dirección siguen siendo válidas

#### Scenario: Eliminar una dirección referenciada es rechazado con explicación
- **WHEN** el usuario intenta eliminar una dirección que está referenciada por un recorrido
- **THEN** la operación falla y se muestra un mensaje que explica que hay recorridos que la usan
- **AND** ninguna otra dirección del paciente queda modificada a medias

### Requirement: Ida y vuelta como registros independientes
El sistema SHALL modelar la dirección de ida y la de vuelta como registros independientes por tramo (RN-HR-02): cada dirección lleva su `tramo` (`ida | vuelta`) y no se asume que la vuelta es el trayecto inverso de la ida. El formulario MUST NOT autocompletar ni derivar la dirección de vuelta a partir de la de ida; ambos tramos se editan de forma explícita y separada.

#### Scenario: La vuelta no se autocompleta desde la ida
- **WHEN** el usuario carga la dirección de ida de un destino
- **THEN** el sistema NO copia esos datos al tramo de vuelta; la vuelta queda en blanco hasta que el usuario la complete manualmente

#### Scenario: Ida y vuelta pueden diferir
- **WHEN** un paciente tiene, para un mismo destino, una dirección de ida y una de vuelta con datos distintos
- **THEN** ambas se persisten y se releen sin fusionarse ni sobrescribirse entre sí

#### Scenario: Editar un tramo no altera el otro
- **WHEN** el usuario edita la dirección de vuelta
- **THEN** la dirección de ida correspondiente permanece sin cambios

### Requirement: Persistencia real de la dirección frente al esquema
El sistema SHALL persistir de cada dirección `calle`, `tipo_lugar` (enum `pacientes.tipo_direccion`,
cast explícito requerido — `text` no castea implícitamente a un enum de usuario) y `localidad`
(columna `NOT NULL` real desde `20260729120000_schema_pacientes_gaps.sql`, completada por
`crear_paciente_completo` desde `20260804120000_crear_paciente_completo_localidad_direccion.sql`).
`descripcion` y las coordenadas geocodificadas `lat`/`lng` (RF-701) también tienen columna propia y
son NULLable. El sistema SHALL señalizar con `AvisoModeloDatos` que `dias` y `horario` —aunque
existen como columnas nullable en `pacientes.direcciones`— **no** se envían todavía desde el
frontend (discrepancia #4, decisión deliberada y abierta: los días/horarios habituales viven en
`pacientes.recorridos`, tabla gateada por el permiso del módulo `hojas_de_ruta`, fuera del alcance
del módulo Pacientes). El sistema MUST NOT inventar un mapeo (por ejemplo, parsear la altura desde
`calle` para llenar la columna `numero`, o serializar `dias`/`horario` dentro de un campo de texto)
ni resolver la discrepancia unilateralmente: queda para confirmar con quien mantiene el modelo de
datos.

#### Scenario: El usuario ve qué datos de la dirección no se guardan
- **WHEN** el usuario abre el editor de direcciones
- **THEN** un `AvisoModeloDatos` visible enumera `dias` y `horario` como datos que el frontend
  todavía no envía al guardar, aunque la base ya tiene columna para ellos

#### Scenario: No se inventa el desglose de la altura
- **WHEN** se guarda una dirección
- **THEN** la columna `numero` de `pacientes.direcciones` se escribe como `NULL`
- **AND** el texto completo ingresado por el usuario se conserva en `calle` sin parsearse

#### Scenario: Al releer, la dirección se reconstruye sin pérdida visible de la calle
- **WHEN** una fila de `pacientes.direcciones` tiene `calle` y `numero` cargados por otro sistema
- **THEN** ambos se combinan en el campo `calle` del dominio para no ocultarle datos al usuario

#### Scenario: tipo_lugar se persiste con el enum correcto
- **GIVEN** una dirección con `tipo_lugar: "domicilio"`
- **WHEN** se guarda vía `crear_paciente_completo`
- **THEN** el INSERT castea explícitamente a `pacientes.tipo_direccion`
- **AND** no falla con `42804` (bug encontrado y corregido en
  `20260807000000_crear_paciente_completo_tipo_lugar_cast.sql`)

#### Scenario: localidad es obligatoria y se persiste
- **GIVEN** que el frontend nunca manda una dirección sin `localidad` completada
  (`DireccionesEditor.tsx` bloquea el alta hasta completarla)
- **WHEN** se guarda una dirección
- **THEN** `localidad` se persiste junto con `calle`
- **AND** el alta no falla por violación de `NOT NULL`

#### Scenario: La regla de ida y vuelta independientes no se altera
- **WHEN** se persisten direcciones contra el esquema real
- **THEN** RN-HR-02 sigue vigente sin cambios: ningún tramo se autocompleta ni se deriva del otro
- **AND** la integración de datos no introduce ninguna simetría implícita entre ida y vuelta
