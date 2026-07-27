## ADDED Requirements

### Requirement: Pantalla de facturación con listado y detalle
El sistema SHALL proveer una pantalla de facturación en la ruta `/facturacion` que liste las facturas con su paciente, período, monto y estado, y permita abrir el detalle de cada una, siguiendo la convención de UI del proyecto (`08_arquitectura_propuesta.md`): fila de listado clickeable en su totalidad más detalle separado con botón "Editar" que detiene la propagación del click.

#### Scenario: Listado con fila clickeable y botón Editar
- **WHEN** el usuario hace click en cualquier parte de una fila del listado
- **THEN** se abre el detalle de esa factura; y **WHEN** hace click en el botón "Editar" de la fila, se abre el formulario de edición sin disparar además la apertura del detalle

#### Scenario: Estados de carga, vacío y error
- **WHEN** la pantalla consulta el `FacturaRepository`
- **THEN** muestra un estado de carga mientras la promesa está pendiente, un estado vacío explícito si no hay facturas, y un mensaje de error visible si la promesa se rechaza — nunca una pantalla en blanco

#### Scenario: Filtro por paciente y período
- **WHEN** el usuario filtra el listado por paciente o por mes/año
- **THEN** se muestran solo las facturas que coinciden con el filtro, resolviendo el nombre del paciente vía `PacienteRepository` (solo lectura)

#### Scenario: Keys estables por id
- **WHEN** se renderiza cualquier lista dinámica de la feature (facturas, asistencias, cobros, ítems de checklist)
- **THEN** la key de cada elemento es su id estable, nunca el índice del array

### Requirement: Formulario de carga de factura
El sistema SHALL proveer un formulario de alta y edición de factura con: selector de paciente, período estructurado (mes 1-12 y año), prestación, domicilio del paciente, dependencia y retorno, **valor del km de carga manual** (RN-FA-05), cantidad de km, cantidad de días y total. El tipo de comprobante MUST pre-cargarse desde la obra social del paciente (RN-FA-07) y quedar editable.

#### Scenario: El valor del km se carga a mano, sin automatización
- **WHEN** el usuario completa el formulario
- **THEN** el valor del km es un campo de entrada manual, sin autocompletado desde ninguna tabla de tarifas ni servicio externo (RN-FA-05: el nomenclador lo fija el Estado, no se automatiza en Fase 1)

#### Scenario: Tipo de comprobante derivado de la obra social
- **WHEN** el usuario selecciona un paciente cuya obra social tiene `tipoComprobante` configurado
- **THEN** el campo de tipo de comprobante se pre-carga con ese valor (A, B o C) y permanece editable (RN-FA-07)

#### Scenario: El domicilio se elige entre las direcciones del paciente
- **WHEN** el usuario elige el domicilio de la factura
- **THEN** las opciones provienen de `paciente.direcciones` (solo lectura, vía `PacienteRepository`) y se guarda solo el id de la dirección, sin embeber la dirección

#### Scenario: Total propuesto y editable
- **WHEN** el usuario carga valor del km y cantidad de km
- **THEN** el total se propone calculado como `valorKm × cantidadKm` y queda editable, porque el docx modela `Monto` como campo persistido propio de la factura

#### Scenario: Validación de campos obligatorios antes de guardar
- **WHEN** el usuario intenta guardar sin paciente, sin período, sin valor del km o sin cantidad de días
- **THEN** el formulario muestra el error correspondiente por campo y no invoca al repository

#### Scenario: Persistencia vía repository inyectado
- **WHEN** el usuario guarda una factura nueva o editada
- **THEN** el cambio se persiste llamando a `FacturaRepository.create()` / `update()` obtenido del context, sin que ningún componente importe la implementación mock directamente

### Requirement: Carga de asistencias/prestaciones de la factura
El sistema SHALL permitir declarar las asistencias/prestaciones que la factura cubre (fecha, prestación, dependencia, retorno, y si esa prestación factura sábados), como colección embebida en la factura. Estas asistencias MUST facturarse íntegramente y MUST NOT derivarse ni validarse contra el recorrido efectivo (RN-FA-01).

#### Scenario: Alta y baja de asistencias en la factura
- **WHEN** el usuario agrega o quita una asistencia/prestación
- **THEN** la colección embebida de la factura se actualiza y se persiste vía `FacturaRepository.update()`

#### Scenario: Independencia del recorrido efectivo
- **WHEN** se cargan las asistencias de una factura
- **THEN** la pantalla no consulta `HojaDeRutaRepository` ni ninguna fuente de recorridos, y ningún campo de la asistencia referencia un recorrido — un paciente con 5 prestaciones semanales puede tener 2 declaradas el mismo día sin que el sistema lo objete (RN-FA-01)
