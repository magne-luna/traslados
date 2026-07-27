## ADDED Requirements

### Requirement: Listado de pacientes
El sistema SHALL mostrar un listado de pacientes con estados de carga, vacío y error, resueltos contra el `PacienteRepository`. Cada fila MUST mostrar al menos apellido y nombre, DNI y la obra social asignada, y MUST seguir la convención de UI del proyecto: la fila completa es clickeable para abrir el detalle y un botón "Editar" separado usa `stopPropagation` para no disparar la apertura del detalle.

#### Scenario: Estado de carga y vacío
- **WHEN** el listado está resolviendo `list()` o no hay pacientes
- **THEN** se muestra un estado de carga durante la latencia y un estado vacío explícito cuando la lista está vacía (nunca una pantalla en blanco)

#### Scenario: Fila clickeable con Editar independiente
- **WHEN** el usuario hace click en una fila del listado
- **THEN** se abre el detalle del paciente; y **WHEN** hace click en "Editar" dentro de la fila **THEN** se abre la edición sin togglear el detalle (el click no se propaga)

### Requirement: Ficha completa del paciente
El sistema SHALL permitir crear y editar la ficha de un paciente con datos personales (apellido, nombre, fecha de nacimiento, DNI, CUIL del titular), datos clínicos (diagnóstico/condición), accesorio de movilidad, obra social asignada, teléfono alternativo del responsable y flag de amparo judicial. El formulario MUST validar los campos requeridos en UI (al menos apellido, nombre y DNI), bloqueando el guardado y señalando los faltantes, y MUST manejar el error del repository con un mensaje visible sin loading infinito.

#### Scenario: Validación de requeridos
- **WHEN** el usuario intenta guardar sin apellido, nombre o DNI
- **THEN** el guardado se bloquea y se señalan los campos faltantes

#### Scenario: Selección de obra social e identificador de afiliado adaptable
- **WHEN** el usuario asigna una obra social al paciente
- **THEN** puede cargar el identificador de afiliado eligiendo su formato (número de documento, alfanumérico o CUIL con sufijo), con un formato por defecto editable, sin que el sistema imponga un único formato fijo

#### Scenario: Amparo judicial con aclaración
- **WHEN** el usuario marca el flag de amparo judicial
- **THEN** puede registrar una aclaración asociada, y el flag queda persistido en la ficha

### Requirement: Alerta de vencimiento del CUD
El sistema SHALL mostrar en la ficha el CUD del paciente (número, emisión, vencimiento) y una señal visible de su estado de vigencia derivada de la función pura de estado del CUD, destacando los casos `por-vencer` y `vencido` (RF-104).

#### Scenario: CUD por vencer se destaca
- **WHEN** el CUD del paciente está `por-vencer` o `vencido` según la fecha actual
- **THEN** la ficha muestra una alerta visible (p. ej. un chip de advertencia/peligro) diferenciada del estado `vigente`

### Requirement: Personas a cargo
El sistema SHALL permitir registrar una o más personas a cargo del paciente (nombre, apellido, DNI) como lista dinámica, con alta y baja de entradas. Al renderizar la lista, el sistema MUST usar un identificador estable por entrada como key (nunca el índice del array).

#### Scenario: Alta y baja de personas a cargo
- **WHEN** el usuario agrega o quita una persona a cargo
- **THEN** la lista se actualiza y el cambio se persiste con el paciente vía `update()`

### Requirement: Sensibilidad de datos clínicos y de menores
El sistema SHALL ubicar el CUD y las personas a cargo (datos de salud y potencialmente de menores de edad) en secciones identificables de la ficha, de modo que su visualización o edición pueda quedar gateada por permiso/RLS en FE-8. El diseño de la UI MUST NOT asumir acceso irrestricto a estos datos como premisa estructural.

#### Scenario: Secciones sensibles aisladas
- **WHEN** se compone la ficha del paciente
- **THEN** el CUD y las personas a cargo viven en secciones propias que pueden ocultarse o deshabilitarse por permiso sin reescribir el resto de la ficha
