## ADDED Requirements

### Requirement: Emisión de comprobante electrónico mediada por Edge Function

El sistema SHALL emitir el comprobante fiscal de una factura invocando una Edge Function
`facturar` que, autorizada con `requirePermiso(req, 'facturacion', 'write')`, arma el payload
fiscal y llama al miniserver `arca-miniserver` (`POST /facturar`). El frontend MUST NOT construir
el payload fiscal, MUST NOT conocer la identidad fiscal (CUIT, certificado, clave) y MUST NOT
llamar al miniserver directamente. La Edge Function MUST usar `userClient` (sesión del caller) para
leer y persistir la factura, de modo que la RLS de `facturacion` y los triggers de auditoría
apliquen como ese usuario.

#### Scenario: El frontend solo envía el id de la factura

- **WHEN** la operadora confirma "Emitir factura"
- **THEN** el frontend invoca `functions.invoke('facturar', { method: 'POST', body: { facturaId } })`
- **AND** no envía datos fiscales, ni el CUIT, ni el certificado, ni el payload de ARCA

#### Scenario: Sin permiso de escritura la emisión se rechaza

- **GIVEN** un usuario con `facturacion: read` pero sin `facturacion: write`
- **WHEN** invoca la emisión
- **THEN** la Edge Function responde `403`
- **AND** ninguna fila de `facturas` cambia de estado

### Requirement: Identidad fiscal configurada exclusivamente por secrets

El sistema SHALL leer la identidad fiscal y la ubicación del miniserver únicamente de variables de
entorno de la Edge Function (`ARCA_MINISERVER_URL`, `ARCA_MINISERVER_API_KEY`, `ARCA_CUIT`,
`ARCA_CERT_B64`, `ARCA_KEY_B64`, `ARCA_PTO_VTA`, `ARCA_AMBIENTE`). El sistema MUST NOT persistir el
certificado ni la clave privada en la base de datos, en el repositorio, ni en el frontend. El
sistema MUST NOT registrar (log) el certificado, la clave, ni el cuerpo de la petición al
miniserver.

#### Scenario: Falta configuración

- **GIVEN** que alguno de los secrets obligatorios de ARCA no está definido
- **WHEN** se invoca la emisión
- **THEN** la Edge Function responde `503` con código `EMISION_NO_CONFIGURADA`
- **AND** el frontend muestra "La emisión electrónica todavía no está configurada" y deja la
  factura en `a-facturar`

#### Scenario: Ambiente por defecto

- **GIVEN** que `ARCA_AMBIENTE` no está definido
- **WHEN** se emite una factura
- **THEN** la emisión se hace contra `homologacion`
- **AND** la fila persiste `arca_ambiente = 'homologacion'`

### Requirement: Persistencia del comprobante fiscal aprobado

Cuando el miniserver responde `200` con `aprobada: true`, el sistema SHALL persistir en
`facturacion.facturas`: `estado = 'facturado'`, `cae`, `cae_vencimiento`, `cbte_nro`, `pto_vta`,
`arca_ambiente`, `fecha_factura`, `fecha_estimada_cobro`, `identificador_origen`/
`identificador_valor`, `descripcion` y `arca_respuesta` (snapshot crudo). El sistema MUST persistir
el CAE **antes** de generar o subir el PDF, de modo que un fallo posterior no pierda el comprobante.

#### Scenario: Emisión aprobada

- **WHEN** ARCA aprueba el comprobante
- **THEN** la factura queda en `facturado` con su `cae`, `cae_vencimiento`, `cbte_nro` y `pto_vta`
- **AND** `arca_respuesta` guarda la respuesta completa del miniserver

#### Scenario: El CAE se guarda aunque falle el PDF

- **GIVEN** una emisión aprobada por ARCA
- **WHEN** la generación o la subida del PDF falla
- **THEN** la factura queda igualmente en `facturado` con su CAE persistido
- **AND** la respuesta indica que el PDF quedó pendiente

### Requirement: Los snapshots de emisión se calculan en el servidor

El sistema SHALL calcular `identificadorFactura`, `fechaFactura`, `fechaEstimadaCobro` y
`descripcion` dentro de la Edge Function al emitir, no en el cliente. El resultado MUST ser
equivalente al de las funciones puras existentes (`resolverIdentificadorFactura`,
`calcularFechaEstimadaCobro`, `renderDescripcionFactura`, `construirDatosDescripcion`) para las
mismas entradas.

#### Scenario: El contenido congelado no viene del cliente

- **WHEN** el frontend invoca la emisión
- **THEN** el body no contiene `descripcion`, `identificadorFactura`, `fechaFactura` ni
  `fechaEstimadaCobro`
- **AND** esos valores se calculan en la Edge Function y quedan congelados junto con el CAE

### Requirement: El rechazo de ARCA no altera el estado de la factura

Cuando el miniserver responde `401` (identidad), `422` (rechazo del comprobante), `400`, o no
responde dentro del timeout, el sistema SHALL dejar la factura en `a-facturar`, editable, sin
persistir ningún campo fiscal. El sistema SHALL devolver al frontend un motivo legible en
castellano; para un `422 ARCA_RECHAZO` el motivo MUST incluir las `observaciones` de ARCA.

#### Scenario: ARCA rechaza el comprobante

- **WHEN** el miniserver responde `422` con `error: "ARCA_RECHAZO"` y `observaciones`
- **THEN** la factura permanece en `a-facturar`
- **AND** el frontend muestra "ARCA rechazó el comprobante: {observaciones}"

#### Scenario: Problema con el certificado fiscal

- **WHEN** el miniserver responde `401` / `ARCA_AUTH_ERROR`
- **THEN** ningún campo fiscal se persiste
- **AND** el frontend muestra un mensaje que remite a administración, sin exponer detalles del
  certificado

#### Scenario: El miniserver no responde

- **WHEN** la llamada al miniserver supera el timeout
- **THEN** la factura permanece en `a-facturar`
- **AND** el frontend muestra un mensaje de reintento

### Requirement: Idempotencia de la emisión

El sistema SHALL rechazar la emisión de una factura que ya tiene `cae` persistido o cuyo estado no
es `a-facturar`, antes de llamar al miniserver. El frontend SHALL ocultar la acción "Emitir" cuando
`factura.cae` existe.

#### Scenario: Segunda emisión de la misma factura

- **GIVEN** una factura ya emitida con `cae`
- **WHEN** se invoca la emisión de nuevo
- **THEN** la Edge Function responde `409` con código `YA_EMITIDA` sin llamar al miniserver
- **AND** no se genera un segundo CAE

### Requirement: Armado del payload fiscal con defaults documentados

El sistema SHALL derivar `cbteTipo` de `factura.tipoComprobante` (`'A'`→`FACTURA_A`,
`'B'`→`FACTURA_B`), el receptor de la obra social del paciente (`docTipo: 'CUIT'`, `docNro` desde
`obraSocial.cuit` — el CUIT de la obra social pagadora —, `condicionIva` desde
`obraSocial.condicionIva`, que ya es uno de los ocho códigos de ARCA y viaja sin transformar), el
`servicio` del período de la factura, y un único `item` con IVA. La regla de IVA por defecto SHALL
ser **21 % "por dentro"**: `neto = redondear(factura.monto / 1.21, 2)` con `iva: 'IVA_21'`, de modo
que el total del comprobante coincida con `factura.monto`. El código de alícuota y el modo (por
dentro / por fuera) SHALL ser overrideables por secret (`ARCA_IVA_CODIGO`, `ARCA_IVA_MODO`) sin
cambiar código. Un `tipoComprobante` `'C'` MUST producir un error `EMISION_TIPO_NO_SOPORTADO`. Una
Factura A sin condición IVA del receptor MUST producir un error `EMISION_SIN_CONDICION_IVA`.

#### Scenario: Factura C no es soportada

- **WHEN** se intenta emitir una factura con `tipoComprobante = 'C'`
- **THEN** la Edge Function responde `422` con código `EMISION_TIPO_NO_SOPORTADO`
- **AND** el frontend explica que solo se admiten comprobantes A y B

#### Scenario: Factura A sin condición IVA del receptor

- **GIVEN** una obra social sin `condicion_iva` cargada
- **WHEN** se emite una Factura A para un paciente de esa obra social
- **THEN** la Edge Function responde `422` con código `EMISION_SIN_CONDICION_IVA`

#### Scenario: IVA 21 % por dentro

- **GIVEN** una factura con `monto = 121000`
- **WHEN** se arma el payload con la regla de IVA por defecto
- **THEN** el `item` lleva `neto = 100000` y `iva = 'IVA_21'`
- **AND** el total del comprobante que devuelve ARCA es `121000`

#### Scenario: El armado del payload se testea sin red

- **WHEN** se ejecutan los tests de `construirPayloadArca`
- **THEN** se invoca con objetos literales de factura, paciente, obra social y config
- **AND** no se monta ningún fake de `fetch` ni del cliente de Supabase
