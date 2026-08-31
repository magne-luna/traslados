## ADDED Requirements

### Requirement: Traza del rechazo de ARCA en la Edge Function

Cuando el miniserver no aprueba el comprobante (identidad fiscal inválida, rechazo de WSFE, o
error de transporte), la Edge Function `facturar` SHALL registrar un `console.error` con
`facturaId`, `tipoComprobante`, el HTTP status del miniserver, el `codigo`
(`ARCA_IDENTIDAD` / `ARCA_RECHAZO` / `ARCA_ERROR`), el `detalle` y las `observaciones` de ARCA si
vinieron. La traza MUST NOT incluir el certificado, la clave privada ni el payload fiscal. La
respuesta al frontend NO cambia.

#### Scenario: Un rechazo de ARCA deja rastro en los logs

- **GIVEN** una emisión que el miniserver responde con `422` (`ARCA_RECHAZO`)
- **WHEN** la Edge Function procesa esa respuesta
- **THEN** escribe un `console.error` con el código, el detalle y las observaciones
- **AND** devuelve el mismo `422` de siempre al frontend

#### Scenario: La traza no filtra la identidad fiscal

- **WHEN** se registra el rechazo
- **THEN** el objeto logueado no contiene `certB64`, `keyB64` ni el payload enviado al miniserver

### Requirement: Aviso en el formulario cuando Factura A no puede ir al receptor

El formulario de factura SHALL mostrar un aviso NO bloqueante cuando `tipoComprobante === 'A'` y la
obra social receptora tiene una condición frente al IVA cargada distinta de
`IVA_RESPONSABLE_INSCRIPTO`, explicando que ARCA rechazará ese comprobante (RG 5616) y que la
salida es cambiar el tipo de comprobante de la obra social a B o corregir su condición. El aviso
MUST NOT impedir guardar la factura ni emitirla. Con la condición del receptor ausente el
formulario NO muestra este aviso (ese caso lo cubre `422 EMISION_SIN_CONDICION_IVA`). Para Factura
B o C el formulario NO muestra el aviso.

#### Scenario: Factura A a obra social exenta

- **GIVEN** un paciente cuya obra social tiene `condicionIva = 'IVA_SUJETO_EXENTO'`
- **AND** la factura es tipo A
- **WHEN** se ve el paso de datos de la factura
- **THEN** aparece el aviso de que ARCA solo acepta Factura A con Responsable Inscripto
- **AND** el botón de guardar / emitir sigue habilitado

#### Scenario: Factura A a Responsable Inscripto

- **GIVEN** una obra social con `condicionIva = 'IVA_RESPONSABLE_INSCRIPTO'`
- **WHEN** la factura es tipo A
- **THEN** no aparece ningún aviso de tipo de comprobante

#### Scenario: Factura B no dispara el aviso

- **GIVEN** una obra social exenta
- **WHEN** la factura es tipo B
- **THEN** no aparece el aviso (el receptor no se valida en Factura B)

### Requirement: Fechas de servicio en formato aaaammdd

`construirPayloadArca` SHALL emitir las fechas del período de servicio
(`servicio.desde` / `servicio.hasta` / `servicio.vtoPago`) en formato `aaaammdd` (sin separadores),
no en ISO `YYYY-MM-DD`. WSFE rechaza el ISO con la observación 10049.

#### Scenario: El período de servicio viaja sin guiones

- **GIVEN** una factura con `fechaInicial = '2026-08-01'`, `fechaTope = '2026-08-31'` y `fechaEstimadaCobro = '2026-09-30'`
- **WHEN** se arma el payload
- **THEN** `servicio` es `{ desde: '20260801', hasta: '20260831', vtoPago: '20260930' }`

### Requirement: Observaciones de WSFE normalizadas a texto

`parseRespuestaMiniserver` SHALL aceptar `observaciones` (y `detalles`) del miniserver tanto como
string plano como arreglo de `{ code, msg }` (el formato real de WSFE) y devolver un único string
legible con el código y el mensaje de cada observación. Sin observaciones útiles el resultado MUST
ser `undefined`.

#### Scenario: Arreglo de observaciones aplanado

- **GIVEN** una respuesta `422` con `observaciones: [{ code: 10015, msg: '…' }, { code: 10049, msg: '…' }]`
- **WHEN** se parsea
- **THEN** `observaciones` es `'[10015] … · [10049] …'`

#### Scenario: Sin observaciones

- **GIVEN** una respuesta `422` con `observaciones: []`
- **THEN** `observaciones` queda `undefined`

### Requirement: Una factura emitida no se edita

Cuando una factura no está en estado `a-facturar` (ya fue emitida), el detalle NO SHALL ofrecer la
acción de editar sus datos y el sistema MUST NOT persistir cambios sobre esos datos: la descripción
y los importes son un documento fiscal congelado (RN-FA-06). El resumen de solo lectura y los
controles de cobros / corrección de estado siguen disponibles.

#### Scenario: Sin botón "Editar" tras emitir

- **GIVEN** una factura en estado `facturado` (con o sin CAE) o `cobrado`
- **WHEN** se abre su detalle
- **THEN** no aparece el botón "Editar"
- **AND** se indica que es un documento fiscal que no se puede modificar

#### Scenario: El alta y el borrador siguen editables

- **GIVEN** una factura en estado `a-facturar`
- **WHEN** se abre su detalle
- **THEN** el botón "Editar" está disponible

### Requirement: El PDF tolera texto fuera de WinAnsi

`construirFacturaPdf` SHALL sanear todo el texto que dibuja al set WinAnsi (CP1252) de las fuentes
estándar de pdf-lib: flechas Unicode, comillas tipográficas y demás caracteres no representables
que vengan en el texto libre del operador (descripción, dependencia/retorno) NO deben hacer fallar
la generación del comprobante. Un carácter no mapeable se reemplaza por `?`; se conservan Latin-1 y
los extras de CP1252 (`€ – — • ™`).

#### Scenario: Una flecha en la descripción no rompe el PDF

- **GIVEN** una factura cuya descripción o asistencia contiene `→`
- **WHEN** se genera el PDF
- **THEN** el PDF se produce igual (`%PDF-`) y la flecha aparece como `->`
