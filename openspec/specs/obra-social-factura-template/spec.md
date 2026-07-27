## Requirements

### Requirement: Plantilla de descripción de factura por obra social
El sistema SHALL permitir configurar, por obra social, una plantilla de descripción de factura compuesta por campos dinámicos, con los datos complementarios que cada obra social pida (US-300, RF-302, RN-FA-08). Cada campo de la plantilla MUST tener al menos una etiqueta, un identificador de origen del dato y una posición/orden. La plantilla MUST persistirse en la obra social vía `ObraSocialRepository.update()`.

#### Scenario: Agregar un campo a la plantilla
- **WHEN** el usuario agrega un campo con su etiqueta y origen de dato
- **THEN** el campo se incorpora a la plantilla de esa obra social y queda disponible para facturación (FE-6)

#### Scenario: Los campos varían por obra social
- **WHEN** se configuran plantillas para dos obras sociales distintas
- **THEN** cada obra social conserva su propio conjunto de campos, sin compartir una plantilla única

### Requirement: Identificador de factura configurable por obra social
El sistema SHALL permitir configurar, por obra social, qué campo de la ficha del paciente alimenta el identificador que aparece en la factura (DNI, número de afiliado u otro), dado que puede diferir por entidad pagadora (IN-01, RF-400). El valor MUST ser un campo configurable, no una constante fija.

#### Scenario: Selección del origen del identificador
- **WHEN** el usuario configura la plantilla de una obra social
- **THEN** puede elegir explícitamente qué campo del paciente se usa como identificador de factura para esa obra social

#### Scenario: Default documentado cuando el cliente no confirmó
- **WHEN** no hay confirmación del cliente sobre el identificador a usar (pregunta abierta Alta)
- **THEN** la plantilla toma el valor por defecto documentado en la KB y lo deja editable, sin hardcodearlo
