## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Límites de persistencia de la dirección frente al esquema real
El sistema SHALL persistir de cada dirección únicamente los datos que el esquema real soporta —calle
y tipo de lugar— y MUST señalizar con `AvisoModeloDatos` que `localidad`, `dias` y `horario` se
capturan en pantalla pero NO se guardan, porque `pacientes.direcciones` no tiene esas columnas y los
días/horarios habituales viven en `pacientes.recorridos`, una tabla gateada por el permiso del
módulo `hojas_de_ruta` y fuera del alcance del módulo Pacientes. El sistema MUST NOT inventar un
mapeo (por ejemplo, parsear la altura desde `calle` para llenar la columna `numero`, o serializar
`dias`/`horario` dentro de un campo de texto) ni resolver la discrepancia unilateralmente: queda
para confirmar con quien mantiene el modelo de datos.

#### Scenario: El usuario ve qué datos de la dirección no se guardan
- **WHEN** el usuario abre el editor de direcciones
- **THEN** un `AvisoModeloDatos` visible enumera `localidad`, `dias` y `horario` como datos que la
  base todavía no persiste

#### Scenario: No se inventa el desglose de la altura
- **WHEN** se guarda una dirección
- **THEN** la columna `numero` de `pacientes.direcciones` se escribe como `NULL`
- **AND** el texto completo ingresado por el usuario se conserva en `calle` sin parsearse

#### Scenario: Al releer, la dirección se reconstruye sin pérdida visible de la calle
- **WHEN** una fila de `pacientes.direcciones` tiene `calle` y `numero` cargados por otro sistema
- **THEN** ambos se combinan en el campo `calle` del dominio para no ocultarle datos al usuario

#### Scenario: La regla de ida y vuelta independientes no se altera
- **WHEN** se persisten direcciones contra el esquema real
- **THEN** RN-HR-02 sigue vigente sin cambios: ningún tramo se autocompleta ni se deriva del otro
- **AND** la integración de datos no introduce ninguna simetría implícita entre ida y vuelta
