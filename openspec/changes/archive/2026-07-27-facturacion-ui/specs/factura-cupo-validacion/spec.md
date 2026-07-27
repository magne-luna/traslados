## ADDED Requirements

### Requirement: Cálculo del cupo consumido del período
El sistema SHALL calcular el cupo ya consumido por un paciente en un período mediante una **función pura** `cupoConsumido(facturas, pacienteId, mes, anio)` que sume los días y los kilómetros de las facturas de ese paciente y período que ya salieron del estado `a-facturar` (es decir, en estado `facturado`, `cobrado` o `pagado-parcialmente`), excluyendo la factura que se está editando.

#### Scenario: Solo cuentan las facturas ya emitidas
- **WHEN** el paciente tiene una factura del período en estado `a-facturar` y otra en estado `facturado`
- **THEN** el cupo consumido suma únicamente la factura `facturado`

#### Scenario: La factura en edición no se cuenta a sí misma
- **WHEN** se recalcula el cupo consumido mientras se edita una factura ya emitida de ese período
- **THEN** esa factura queda excluida de la suma, para no computarla dos veces al validar

#### Scenario: Aislamiento por paciente y por período
- **WHEN** existen facturas de otros pacientes o de otros meses del mismo paciente
- **THEN** no se suman al cupo consumido del período consultado (el cupo autorizado es mensual, RN-PA-03)

### Requirement: Alerta al superar el cupo autorizado
El sistema SHALL alertar cuando los días o los kilómetros a facturar superen el cupo mensual autorizado del paciente (RN-FA-02, RN-PA-03), mediante una **función pura** `validarCupoFacturacion({ diasFacturados, kmFacturados, cupo })` que devuelva un resultado explícito indicando si se excede el cupo de días, el de kilómetros o ambos, con un mensaje comparativo (por ejemplo "tenés autorizados 20 días, estás facturando 22"). El cupo MUST provenir de la proyección `CupoAutorizado` que expone el dominio de Presupuestos/Autorizaciones, sin que Facturación reimplemente su derivación.

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

### Requirement: La alerta de cupo avisa y pide confirmación, sin bloquear la emisión
El sistema SHALL mostrar la alerta de cupo excedido de forma visible en el formulario y SHALL requerir una confirmación explícita del usuario para continuar con la emisión, pero MUST NOT impedir la emisión, dado que RN-FA-02 y US-400 exigen alertar antes de continuar, no prohibir.

#### Scenario: Alerta visible con confirmación explícita
- **WHEN** el usuario intenta emitir una factura que excede el cupo autorizado
- **THEN** se muestra la alerta con el detalle del exceso y se pide una confirmación explícita antes de continuar

#### Scenario: La emisión es posible tras confirmar
- **WHEN** el usuario confirma la alerta
- **THEN** la factura se emite normalmente, quedando registrado el exceso como información visible en el detalle

#### Scenario: La alerta no es un aviso efímero
- **WHEN** la factura en edición excede el cupo
- **THEN** la alerta permanece visible en el formulario mientras la condición se mantenga, en vez de desaparecer sola
