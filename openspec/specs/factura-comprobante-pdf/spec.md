## ADDED Requirements

### Requirement: Generación del PDF del comprobante emitido

El sistema SHALL generar un PDF del comprobante inmediatamente después de obtener el CAE, dentro de
la Edge Function `facturar`, mediante una función pura `construirFacturaPdf(datos): Promise<Uint8Array>`
implementada con `pdf-lib`. El PDF MUST incluir: datos del emisor (razón social, CUIT, punto de
venta), tipo y letra del comprobante, número de comprobante, fecha de emisión, datos del receptor
(obra social: razón social, CUIT, condición IVA), período facturado y período de servicio, detalle
y descripción congelada, totales (neto, IVA, total), CAE, vencimiento del CAE, código de barras
AFIP, y el anexo de asistencias del período. Cuando `arca_ambiente = 'homologacion'`, el PDF MUST
mostrar de forma visible "HOMOLOGACIÓN — SIN VALOR FISCAL".

#### Scenario: El PDF contiene el comprobante fiscal

- **WHEN** se genera el PDF de una factura emitida
- **THEN** los bytes empiezan con `%PDF-`
- **AND** el CAE, el vencimiento del CAE y el número de comprobante aparecen como texto

#### Scenario: Comprobante de homologación marcado

- **GIVEN** una emisión contra `homologacion`
- **WHEN** se genera el PDF
- **THEN** incluye la leyenda "HOMOLOGACIÓN — SIN VALOR FISCAL"

#### Scenario: El anexo lista las asistencias

- **GIVEN** una factura con N asistencias declaradas
- **WHEN** se genera el PDF
- **THEN** el anexo lista las N asistencias con su fecha, prestación, dependencia y retorno

#### Scenario: El PDF no se regenera al corregir la factura

- **GIVEN** una factura emitida con su PDF archivado
- **WHEN** se edita un campo de la factura después de emitida
- **THEN** el PDF archivado no se regenera (refleja el comprobante tal como se emitió, RN-FA-06)

### Requirement: Almacenamiento del PDF en bucket privado gateado por módulo

El sistema SHALL guardar el PDF en el bucket privado `facturas-emitidas` con la clave
`{facturaId}/{cbteTipo}-{ptoVta}-{cbteNro}.pdf`, y persistir su ruta en
`facturacion.facturas.comprobante_pdf_url`. El bucket MUST ser `public = false` y sus policies
sobre `storage.objects` MUST gatear por `modulos.tiene_permiso('facturacion', <nivel>)`. El
frontend MUST acceder al PDF sólo mediante una URL firmada de vigencia acotada, nunca una URL
pública.

#### Scenario: El bucket es privado y gateado

- **WHEN** se inspecciona la migración del bucket
- **THEN** `facturas-emitidas` se crea con `public = false`
- **AND** las 4 policies (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) referencian
  `modulos.tiene_permiso('facturacion', …)` y ninguna es `TO anon` / `TO public`

#### Scenario: Acceso al PDF desde la interfaz

- **GIVEN** un usuario con `facturacion: read` y una factura emitida
- **WHEN** abre "Ver comprobante (PDF)"
- **THEN** recibe una URL firmada temporal
- **AND** un usuario sin `facturacion: read` no puede resolver esa URL

#### Scenario: Clave de objeto determinista

- **WHEN** se sube el PDF de una factura
- **THEN** la clave es `{facturaId}/{cbteTipo}-{ptoVta}-{cbteNro}.pdf`
- **AND** re-subir la misma factura no crea una segunda copia con otra clave

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
