## MODIFIED Requirements

### Requirement: Alerta al superar el cupo autorizado
El sistema SHALL alertar cuando los días o los kilómetros a facturar superen el cupo mensual autorizado del paciente (RN-FA-02, RN-PA-03), mediante una **función pura** `validarCupoFacturacion({ diasFacturados, kmFacturados, cupo })` que devuelva un resultado explícito indicando si se excede el cupo de días, el de kilómetros o ambos, con un mensaje comparativo (por ejemplo "tenés autorizados 20 días, estás facturando 22"). El cupo MUST provenir de la proyección `CupoAutorizado` que expone el dominio de Presupuestos/Autorizaciones, sin que Facturación reimplemente su derivación. El `CupoAutorizado` que alimenta esta validación MUST derivarse de la autorización **explícitamente elegida** por el usuario en el paso 2 del wizard (`values.autorizacionId`), nunca de una heurística que adivine cuál autorización usar entre las varias que un paciente puede tener vigentes al mismo tiempo.

(Previously: el `CupoAutorizado` se resolvía con `resolverCupoAutorizado(pacienteId)`, que listaba todas las autorizaciones del paciente y devolvía la primera con cupo cargado, sin considerar cuál autorización el usuario había elegido para esa factura.)

#### Scenario: Exceso de días
- **WHEN** el cupo autorizado es de 20 días y se están facturando 22
- **THEN** la validación devuelve un resultado que marca el exceso de días con los valores autorizado y facturado

#### Scenario: Exceso de kilómetros
- **WHEN** el cupo autorizado de kilómetros se supera
- **THEN** la validación devuelve un resultado que marca el exceso de kilómetros, de forma independiente del exceso de días

#### Scenario: Dentro del cupo
- **WHEN** los días y los kilómetros a facturar están dentro del cupo autorizado
- **THEN** la validación devuelve un resultado sin excesos y la interfaz no muestra ninguna alerta

#### Scenario: Sin autorización o sin cupos cargados
- **WHEN** el paciente no tiene una autorización autorizada, o su autorización no tiene cupos de días ni de kilómetros
- **THEN** la interfaz avisa que no hay cupo contra el cual validar, y no bloquea ni reporta un exceso inexistente

#### Scenario: El cupo se deriva de la autorización elegida, no de la primera con cupo cargado
- **GIVEN** un paciente con varias autorizaciones vigentes simultáneas, cada una con cupos distintos
- **WHEN** el usuario elige una autorización específica en el paso 2 del wizard
- **THEN** el `CupoAutorizado` usado por `AlertaCupo` se deriva de esa autorización elegida (`autorizacionId`), no de la primera autorización con cupo cargado que devuelva el listado del paciente

#### Scenario: Factura sin autorización elegida no reporta cupo
- **GIVEN** una factura sin `autorizacionId` (por ejemplo una factura previa a este change)
- **WHEN** se calcula el `CupoAutorizado` para esa factura
- **THEN** el resultado es `undefined`, y `validarCupoFacturacion` no bloquea ni reporta un exceso inexistente
