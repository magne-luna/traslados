## ADDED Requirements

### Requirement: Armado de la descripción según la plantilla de la obra social
El sistema SHALL armar la descripción de la factura a partir de la `plantillaFactura` configurada en la obra social del paciente (US-400, RF-302, RF-400, RN-FA-08), mediante una **función pura** `renderDescripcionFactura(plantilla, datos)` que recorra `plantilla.campos` en el orden dado por su campo `orden` y resuelva cada `OrigenCampoPlantilla` contra los datos del paciente y del traslado. La función MUST NOT acceder a repositorios, a la fecha del sistema ni a ningún estado global.

#### Scenario: La descripción respeta el orden de los campos de la plantilla
- **WHEN** se renderiza la descripción de una factura cuya obra social tiene campos con `orden` 0, 1 y 2
- **THEN** el texto resultante presenta los campos en ese orden, con la etiqueta configurada en cada uno

#### Scenario: Plantillas distintas producen descripciones distintas
- **WHEN** se renderiza la misma factura contra las plantillas de dos obras sociales diferentes
- **THEN** cada resultado refleja los campos y el orden de su propia obra social, sin ninguna plantilla única compartida

#### Scenario: Cobertura de los campos que exige US-400
- **WHEN** la plantilla incluye los orígenes `paciente.nombre`, `paciente.domicilio`, `traslado.prestacion`, `traslado.mesYAnio`, `traslado.cantidadDias`, `traslado.dependenciaYRetorno`, `traslado.valorKm`, `traslado.cantidadKm` y `traslado.total`
- **THEN** cada uno se resuelve con el dato correspondiente de la factura o del paciente, sin dejar marcadores sin sustituir

#### Scenario: Campo de valor manual
- **WHEN** un campo de la plantilla tiene origen `valor-manual`
- **THEN** se resuelve con el texto que el usuario cargó para ese campo en el formulario, sin buscarlo en el paciente ni en el traslado

#### Scenario: Mes y año formateados desde el período estructurado
- **WHEN** se resuelve el origen `traslado.mesYAnio`
- **THEN** el texto se formatea a partir de `mesFacturado` y `anioFacturado` (numéricos), sin requerir un campo de texto libre

### Requirement: Identificador del paciente resuelto por obra social y congelado en la factura
El sistema SHALL resolver el identificador del paciente que aparece en la factura leyendo `obraSocial.plantillaFactura.identificadorOrigen` (`'paciente.dni'` o `'paciente.numeroAfiliado'`), que es configurable por obra social (IN-01, pregunta abierta de prioridad Alta sin cerrar). El valor resuelto MUST persistirse en la factura como snapshot al emitirla, junto con su origen. El identificador MUST NOT estar hardcodeado ni ser una decisión de la pantalla de facturación.

#### Scenario: El identificador sale de la configuración de la obra social
- **WHEN** la obra social del paciente tiene `identificadorOrigen: 'paciente.numeroAfiliado'`
- **THEN** la descripción y la factura usan el número de afiliado del paciente; y **WHEN** otra obra social tiene `'paciente.dni'`, esa factura usa el DNI

#### Scenario: El identificador queda congelado tras emitir
- **WHEN** se cambia el `identificadorOrigen` de la obra social después de que una factura fue emitida
- **THEN** la factura ya emitida conserva el identificador y el origen con los que se emitió, sin recalcularse (RN-FA-06)

#### Scenario: Default documentado, nunca hardcodeado
- **WHEN** el cliente no confirmó qué identificador corresponde (pregunta abierta Alta)
- **THEN** se usa el default ya documentado en la configuración de la obra social, y la pantalla no contiene ninguna constante propia de facturación que fije DNI o afiliado
