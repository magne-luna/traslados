## ADDED Requirements

### Requirement: Pantalla de alta / edición / listado de presupuestos
El sistema SHALL proveer una pantalla en `frontend/src/features/presupuestos/` para crear, editar y listar presupuestos, con estados de carga, vacío y error contra `PresupuestoRepository`, siguiendo el patrón fila clickeable + detalle de `08_arquitectura_propuesta.md` (mismo que Vehículos / Conductores).

#### Scenario: Listado con estados de carga, vacío y error
- **WHEN** se abre la pantalla de presupuestos
- **THEN** muestra un estado de carga mientras el repository responde, un estado vacío si no hay presupuestos, y un mensaje de error visible (sin loading infinito) si el repository falla

#### Scenario: Fila clickeable abre el detalle
- **WHEN** se hace click en una fila del listado
- **THEN** se abre el detalle del presupuesto; el botón "Editar" de la fila usa `stopPropagation` para no colisionar con el click de la fila

### Requirement: Formulario de presupuesto con selectores por id
El sistema SHALL proveer un formulario de presupuesto con selector de paciente alimentado por `PacienteRepository` y selector de obra social alimentado por `ObraSocialRepository` (ambos inyectados, consumidos de solo lectura), monto, fecha de emisión y archivo único adjunto, guardando solo los ids de paciente y obra social.

#### Scenario: Los selectores guardan ids, no objetos embebidos
- **WHEN** se selecciona un paciente y una obra social y se guarda el presupuesto
- **THEN** el presupuesto persiste `pacienteId` y `obraSocialId` (strings), y NO embebe los objetos `Paciente`/`ObraSocial`; el detalle resuelve nombre/razón social contra los repositories consumidos

#### Scenario: Validación de campos obligatorios
- **WHEN** se intenta guardar un presupuesto sin paciente, sin obra social o sin monto
- **THEN** el guardado se bloquea y se señalan los campos faltantes (validación en una función pura testeable)

#### Scenario: Archivo único adjunto (no multi-documento)
- **WHEN** se adjunta documentación al presupuesto
- **THEN** el formulario ofrece un input de un único archivo (`archivo?: ArchivoAdjunto`), no un checklist multi-documento, y muestra un `AvisoModeloDatos` indicando que el modelo real tiene un solo "Archivo" por presupuesto (design.md Discrepancia 1)
