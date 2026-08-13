## MODIFIED Requirements

### Requirement: Mapeo en funciones puras y aisladas
El sistema SHALL implementar toda la traducción entre filas de Postgres y los tipos `Factura`,
`AsistenciaPrestacion` y `Cobro` en funciones puras exportadas desde
`frontend/src/shared/lib/facturacion/facturaMapping.ts`, sin efectos, sin lectura de reloj global y
sin acceso a red. Las funciones de parseo MUST angostar `unknown` con type guards explícitos, nunca
con `as`. Los repositories MUST quedar como cáscaras de I/O que solo arman la consulta, chequean
`error` y delegan en el mapeo. El mapeo MUST leer y escribir la columna `autorizacion_id`
(nullable) de `facturacion.facturas` hacia/desde `Factura.autorizacionId`, tanto en la lectura
(`parseFacturaRow`) como en los payloads de escritura (`toCrearFacturaPayload`,
`toActualizarFacturaPayload`).

(Previously: el mapeo no contemplaba ningún vínculo entre `Factura` y `Autorizacion`; la columna
`autorizacion_id` no existía en `facturacion.facturas` ni en el `select` de
`SupabaseFacturaRepository.ts`, ni en `CrearFacturaPayload`.)

#### Scenario: El mapeo se testea sin red ni mocks
- **WHEN** se ejecutan los tests de `facturaMapping.ts`
- **THEN** no se monta ningún fake del cliente de Supabase
- **AND** las funciones se invocan con objetos literales

#### Scenario: Una fila hija malformada no rompe la factura
- **GIVEN** una fila de `asistencia_prestacion` sin `fecha` o con una forma inesperada
- **WHEN** se ensambla la factura
- **THEN** esa asistencia se descarta
- **AND** la factura se devuelve con el resto de sus asistencias, sin lanzar

#### Scenario: Las columnas nullables se resuelven con defaults documentados
- **GIVEN** una fila de `facturas` con columnas nullables en `NULL` (por ejemplo `monto`,
  `prestacion` o `dependencia_y_retorno`)
- **WHEN** se ensambla la factura
- **THEN** los campos textuales quedan como cadena vacía y los numéricos como `0`
- **AND** la factura resultante es coherente con el tipo `Factura`, sin `undefined` filtrándose a la UI

#### Scenario: El identificador congelado se arma desde dos columnas
- **GIVEN** una fila con `identificador_origen` e `identificador_valor` cargados
- **WHEN** se ensambla la factura
- **THEN** `identificadorFactura` es un objeto `{ origen, valor }`
- **AND** si cualquiera de las dos columnas es `NULL`, `identificadorFactura` queda ausente

#### Scenario: `autorizacion_id` NULL se lee como `autorizacionId` ausente
- **GIVEN** una fila de `facturas` con `autorizacion_id` en `NULL` (factura previa a este change o
  emitida sin autorización elegida)
- **WHEN** se ensambla la factura
- **THEN** `Factura.autorizacionId` queda `undefined`, sin lanzar ni inventar un valor

#### Scenario: `autorizacion_id` se persiste en el alta
- **WHEN** se arma el payload de `toCrearFacturaPayload` para una factura con `autorizacionId`
  elegido
- **THEN** el payload incluye `autorizacion_id` con ese valor, para que la RPC de creación lo
  persista en `facturacion.facturas`

#### Scenario: `autorizacion_id` ausente en la edición no borra el vínculo existente
- **WHEN** se arma el payload de `toActualizarFacturaPayload` para una edición que no toca la
  autorización (por ejemplo, solo cambia el estado)
- **THEN** la clave `autorizacion_id` está ausente del payload, distinguiéndose de un valor `null`
  explícito, de modo que la RPC de actualización no sobrescribe el vínculo ya persistido
