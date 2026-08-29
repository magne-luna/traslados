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
