## MODIFIED Requirements

### Requirement: Alerta al superar el cupo autorizado
El sistema SHALL alertar cuando los días o los kilómetros a facturar superen el cupo mensual autorizado del paciente (RN-FA-02, RN-PA-03), mediante una **función pura** `validarCupoFacturacion({ diasFacturados, kmFacturados, cupo })` que devuelva un resultado explícito indicando si se excede el cupo de días, el de kilómetros o ambos, con un mensaje comparativo (por ejemplo "tenés autorizados 20 días, estás facturando 22"). El cupo MUST provenir de la proyección `CupoAutorizado` que expone el dominio de Presupuestos/Autorizaciones, sin que Facturación reimplemente su derivación.

Mientras las facturas se persistan contra el almacenamiento real y las autorizaciones sigan proviniendo de una implementación de desarrollo, la validación de cupo opera sobre **fuente mixta**. El sistema SHALL hacer visible esa condición en la pantalla donde se muestra la alerta, con una señalización explícita. El sistema MUST NOT presentar la alerta como si ambos lados del cálculo provinieran de datos reales, y MUST NOT desactivar la validación en silencio.

#### Scenario: La fuente mixta es visible, no silenciosa
- **GIVEN** que las facturas se leen del almacenamiento real y las autorizaciones de una implementación de desarrollo
- **WHEN** se muestra el formulario de factura con su alerta de cupo
- **THEN** se señaliza que el cupo autorizado todavía no proviene de datos reales
- **AND** la señalización remite al change de integración de Presupuestos/Autorizaciones

#### Scenario: La validación no se apaga
- **GIVEN** la condición de fuente mixta
- **WHEN** los días o kilómetros a facturar superan el cupo del dato disponible
- **THEN** la alerta se muestra igual
- **AND** la confirmación explícita se sigue pidiendo antes de emitir

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

#### Scenario: Cero autorizaciones visibles no equivale a "sin cupo cargado"
- **GIVEN** un usuario cuyo perfil no tiene permiso de lectura sobre el módulo que gobierna las autorizaciones
- **WHEN** la consulta de autorizaciones devuelve cero filas por control de acceso
- **THEN** el sistema NO trata ese resultado como "el paciente no tiene autorización"
- **AND** avisa que no pudo determinarse el cupo, en vez de dar por válido un cupo inexistente
