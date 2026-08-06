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
El sistema SHALL proveer un formulario de alta y edición de factura con: selector de paciente,
período estructurado (mes 1-12 y año), prestación, domicilio del paciente, dependencia y retorno,
**valor del km de carga manual** (RN-FA-05), cantidad de km, cantidad de días y total. El tipo de
comprobante MUST pre-cargarse con un valor por defecto fijo (`TIPO_COMPROBANTE_DEFAULT`) y
permanecer **siempre editable a mano** — MUST NOT derivarse ni bloquearse a partir de ninguna
fuente (ni de la obra social del paciente, ni de ningún prestador), porque no existe ninguna
entidad `Prestador` en el sistema. Cuando `ObraSocial.modalidadFacturacion === 'por-prestacion'`,
el formulario MUST pedir además el **nombre** y el **domicilio** del prestador que realizó la
prestación, como dos campos de texto libre sin entidad ni repository detrás
(`Factura.prestadorNombre?`/`Factura.prestadorDomicilio?`), y MUST bloquear el avance al resto del
formulario mientras alguno de los dos esté vacío.

#### Scenario: El valor del km se carga a mano, sin automatización
- **WHEN** el usuario completa el formulario
- **THEN** el valor del km es un campo de entrada manual, sin autocompletado desde ninguna tabla de tarifas ni servicio externo (RN-FA-05: el nomenclador lo fija el Estado, no se automatiza en Fase 1)

#### Scenario: Tipo de comprobante siempre manual, sin auto-completar ni bloquearse
- **WHEN** el usuario completa el formulario, con cualquier obra social y con o sin prestador cargado
- **THEN** el campo de tipo de comprobante se pre-carga con `TIPO_COMPROBANTE_DEFAULT` y permanece editable en todo momento — el sistema no lo deriva de `obraSocial.tipoComprobante` ni de ningún prestador, y no existe ningún estado de solo-lectura para este campo

#### Scenario: Nombre y domicilio del prestador en modalidad "por-prestación"
- **GIVEN** que la obra social del paciente elegido tiene `modalidadFacturacion === 'por-prestacion'`
- **WHEN** el usuario completa el paso de Obra social / Prestador del formulario
- **THEN** se muestran dos campos de texto libre, "Nombre" y "Domicilio", que escriben en `values.prestadorNombre` y `values.prestadorDomicilio` respectivamente, sin ningún selector poblado por repository

#### Scenario: Avance bloqueado sin completar ambos campos del prestador
- **GIVEN** que `obraSocial.modalidadFacturacion === 'por-prestacion'`
- **WHEN** el usuario no completó `prestadorNombre` o no completó `prestadorDomicilio` (vacío o solo espacios)
- **THEN** el sistema no permite avanzar al resto del formulario ni arma la vista previa de la descripción de la factura, hasta que ambos campos tengan contenido

#### Scenario: Sin campos de prestador en modalidad "general"
- **GIVEN** que `obraSocial.modalidadFacturacion === 'general'`
- **WHEN** el usuario completa el formulario
- **THEN** no se muestra ningún campo de prestador y el formulario se comporta como si esos campos no existieran — `prestadorNombre`/`prestadorDomicilio` quedan `undefined` en la `Factura` resultante

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
