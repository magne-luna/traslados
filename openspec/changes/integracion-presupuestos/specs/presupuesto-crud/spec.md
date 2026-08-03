## MODIFIED Requirements

### Requirement: Pantalla de alta / edición / listado de presupuestos
El sistema SHALL proveer una pantalla en `frontend/src/features/presupuestos/` para crear, editar y listar presupuestos, con estados de carga, vacío y error contra `PresupuestoRepository`, siguiendo el patrón fila clickeable + detalle de `08_arquitectura_propuesta.md` (mismo que Vehículos / Conductores). La pantalla MUST comportarse igual contra la implementación mock y contra la real: ningún componente, hook ni context de la feature cambia por el cambio de fuente de datos.

#### Scenario: Listado con estados de carga, vacío y error
- **WHEN** se abre la pantalla de presupuestos
- **THEN** muestra un estado de carga mientras el repository responde, un estado vacío si no hay presupuestos, y un mensaje de error visible (sin loading infinito) si el repository falla

#### Scenario: Fila clickeable abre el detalle
- **WHEN** se hace click en una fila del listado
- **THEN** se abre el detalle del presupuesto; el botón "Editar" de la fila usa `stopPropagation` para no colisionar con el click de la fila

#### Scenario: El cambio de fuente de datos ocurre en un solo archivo
- **GIVEN** la feature completa de Presupuestos
- **WHEN** se reemplaza la implementación del repository por la real
- **THEN** el único archivo de producción que cambia es el punto de composición de la feature
- **AND** ningún componente, hook ni context de `features/presupuestos/` importa el cliente de Supabase

#### Scenario: Un listado vacío contra datos reales no es un error
- **GIVEN** una base sin presupuestos cargados
- **WHEN** se abre la pantalla contra la implementación real
- **THEN** se muestra el estado vacío ya implementado
- **AND** NO se muestra un mensaje de error ni un estado de carga permanente

### Requirement: Formulario de presupuesto con selectores por id
El sistema SHALL proveer un formulario de presupuesto con selector de paciente alimentado por `PacienteRepository` y selector de obra social alimentado por `ObraSocialRepository` (ambos inyectados, consumidos de solo lectura), monto, fecha de emisión y archivo único adjunto, guardando solo los ids de paciente y obra social. Cuando el presupuesto se persiste contra la implementación real, los dos selectores MUST alimentarse de las **mismas fuentes reales** que respaldan las claves foráneas del presupuesto, porque `paciente_id` y `obra_social_id` son `NOT NULL` con integridad referencial.

#### Scenario: Los selectores guardan ids, no objetos embebidos
- **WHEN** se selecciona un paciente y una obra social y se guarda el presupuesto
- **THEN** el presupuesto persiste `pacienteId` y `obraSocialId` (strings), y NO embebe los objetos `Paciente`/`ObraSocial`; el detalle resuelve nombre/razón social contra los repositories consumidos

#### Scenario: Los selectores y el presupuesto comparten fuente de datos
- **GIVEN** la pantalla cableada contra la implementación real de `PresupuestoRepository`
- **WHEN** se revisa el punto de composición
- **THEN** el `PacienteRepository` y el `ObraSocialRepository` inyectados son también las implementaciones reales
- **AND** NO se inyecta ningún fixture como fuente de los selectores

#### Scenario: Un id de paciente u obra social que no existe se rechaza con un mensaje de dominio
- **GIVEN** un intento de guardar un presupuesto cuyo `pacienteId` u `obraSocialId` no existen
- **WHEN** el servidor rechaza la escritura por integridad referencial
- **THEN** la pantalla muestra un mensaje que explica que el paciente o la obra social no existen
- **AND** el mensaje no menciona claves foráneas ni nombres de tablas

#### Scenario: Validación de campos obligatorios
- **WHEN** se intenta guardar un presupuesto sin paciente, sin obra social o sin monto
- **THEN** el guardado se bloquea y se señalan los campos faltantes (validación en una función pura testeable)

#### Scenario: Archivo único adjunto (no multi-documento)
- **WHEN** se adjunta documentación al presupuesto
- **THEN** el formulario ofrece un input de un único archivo (`archivo?: ArchivoAdjunto`), no un checklist multi-documento, y muestra un `AvisoModeloDatos` indicando que el modelo real tiene un solo "Archivo" por presupuesto

#### Scenario: El archivo adjunto todavía no se guarda en el servidor
- **GIVEN** la pantalla cableada contra la implementación real
- **WHEN** el usuario selecciona un archivo en el formulario
- **THEN** un `AvisoModeloDatos` indica que el archivo todavía no se sube al servidor
- **AND** el guardado no reporta como persistido un archivo que no lo está
- **AND** un archivo ya referenciado en el servidor no se pierde al editar otros campos
