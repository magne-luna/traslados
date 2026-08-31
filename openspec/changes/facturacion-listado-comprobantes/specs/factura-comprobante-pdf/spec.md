## ADDED Requirements

### Requirement: Listado de comprobantes emitidos

El sistema SHALL ofrecer una pantalla que liste todas las facturas con `cae` presente (comprobantes
ya emitidos contra ARCA), accesible desde la cabecera del listado de facturación. Cada fila MUST
mostrar el paciente, el período facturado (`mes/año`), el comprobante (`{tipo} {ptoVta}-{cbteNro}`
con `ptoVta` a 4 dígitos y `cbteNro` a 8), el CAE y la fecha de la factura. Cuando
`arca_ambiente = 'homologacion'` la fila MUST marcar el comprobante como de prueba / sin valor
fiscal. Las facturas sin `cae` (en estado `a-facturar`) MUST NOT aparecer en este listado.

#### Scenario: Solo aparecen las facturas emitidas

- **GIVEN** un conjunto de facturas, algunas con `cae` y otras en `a-facturar`
- **WHEN** se abre "Comprobantes emitidos"
- **THEN** se listan únicamente las que tienen `cae`
- **AND** cada una muestra su número de comprobante, su CAE y su período

#### Scenario: Listado vacío

- **GIVEN** que ninguna factura tiene `cae` todavía
- **WHEN** se abre "Comprobantes emitidos"
- **THEN** se muestra un estado vacío explícito, sin tabla

#### Scenario: Comprobante de homologación marcado

- **GIVEN** una factura emitida con `arcaAmbiente === 'homologacion'`
- **WHEN** aparece en el listado
- **THEN** su fila indica que es un comprobante de prueba sin valor fiscal

### Requirement: Acceso al PDF desde el listado de comprobantes

Desde el listado de comprobantes emitidos, el sistema SHALL permitir abrir el PDF archivado de cada
comprobante que tenga `comprobante_pdf_url`, resolviéndolo mediante
`EmisionRepository.verComprobante` a una URL firmada de vigencia acotada (nunca una URL pública).
Cuando la factura emitida no tiene `comprobante_pdf_url` (el PDF quedó pendiente en la emisión), la
fila MUST seguir visible con sus datos fiscales pero sin ofrecer la acción de abrir el PDF. Un fallo
al resolver la URL firmada MUST informarse en la misma pantalla sin romper el listado.

#### Scenario: Abrir el PDF de un comprobante

- **GIVEN** una factura emitida con `comprobantePdfUrl`
- **WHEN** se usa la acción "Ver PDF" de su fila
- **THEN** se resuelve una URL firmada temporal vía `verComprobante` y se abre el PDF

#### Scenario: Comprobante emitido sin PDF archivado

- **GIVEN** una factura con `cae` pero sin `comprobantePdfUrl`
- **WHEN** aparece en el listado
- **THEN** su fila muestra el CAE y el número de comprobante
- **AND** no ofrece la acción "Ver PDF"

#### Scenario: Falla la resolución de la URL firmada

- **GIVEN** una factura emitida con `comprobantePdfUrl`
- **WHEN** `verComprobante` rechaza (por ejemplo, sin permiso `facturacion: read`)
- **THEN** la pantalla muestra el mensaje de error
- **AND** el resto del listado sigue visible
