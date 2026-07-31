## MODIFIED Requirements

### Requirement: Registro de cobros y pagos parciales por factura
El sistema SHALL permitir registrar N cobros por factura, cada uno con fecha y monto pagado (docx §Cobros, US-400: "se registran cobros y pagos parciales asociados a una o varias facturas"), persistidos vía `CobroRepository` y listados en el detalle de la factura ordenados por fecha.

La persistencia de los cobros SHALL realizarse contra el almacenamiento real, en la misma fuente que las facturas. El sistema MUST NOT combinar facturas del almacenamiento real con cobros de una implementación de desarrollo: los identificadores de factura de una fuente no resuelven contra los de la otra, y esa combinación haría que toda factura emitida se viera como impaga sin que nada falle.

El alta y la baja de cobros SHALL estar gobernadas por el mismo control de acceso del módulo de facturación que gobierna las facturas. Un rechazo por permisos MUST producir un mensaje en castellano, no un fallo silencioso.

#### Scenario: Cobros y facturas comparten fuente
- **WHEN** se inspecciona el punto de composición de la feature de facturación
- **THEN** el repository de cobros y el de facturas provienen de la misma implementación
- **AND** los cobros listados para una factura resuelven contra el identificador real de esa factura

#### Scenario: Alta de un cobro
- **WHEN** el usuario registra un cobro con fecha y monto para una factura emitida
- **THEN** el cobro se persiste vía `CobroRepository.create()` y aparece en la lista de cobros de esa factura

#### Scenario: Varios cobros parciales sobre la misma factura
- **WHEN** se registran dos o más cobros parciales sobre una misma factura
- **THEN** todos quedan listados de forma independiente, sin reemplazarse entre sí

#### Scenario: Baja de un cobro
- **WHEN** el usuario elimina un cobro registrado por error
- **THEN** el cobro desaparece de la lista y el saldo y el estado de la factura se recalculan
- **AND** la fila deja de existir en el almacenamiento, no solo en la vista

#### Scenario: Sin permiso de escritura el cobro no se registra y se explica por qué
- **GIVEN** un usuario con permiso de lectura pero no de escritura sobre facturación
- **WHEN** intenta registrar o eliminar un cobro
- **THEN** la operación se rechaza en el servidor
- **AND** la interfaz muestra un mensaje en castellano indicando la falta de permiso

#### Scenario: Borrar la factura arrastra sus cobros
- **GIVEN** una factura con cobros registrados
- **WHEN** la factura se elimina del almacenamiento
- **THEN** sus cobros se eliminan con ella
- **AND** no quedan cobros huérfanos referenciando una factura inexistente

#### Scenario: No se registran cobros sobre facturas no emitidas
- **WHEN** la factura está en estado `a-facturar`
- **THEN** la interfaz no ofrece registrar cobros, porque todavía no hay comprobante emitido que cobrar
