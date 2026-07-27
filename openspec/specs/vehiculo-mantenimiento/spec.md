## ADDED Requirements

### Requirement: Cálculo del estado de mantenimiento preventivo
El sistema SHALL calcular client-side, mediante funciones puras y parametrizadas por el "ahora" y el kilometraje actual, el estado del mantenimiento preventivo (cambio de aceite) de cada vehículo: cada 10.000 km o ~3 meses desde el último service, lo que ocurra primero, con alerta intermedia a los 5.000 km (RN-VE-03, US-500). Los umbrales MUST vivir como constantes configurables documentadas, no como números mágicos dispersos.

#### Scenario: Service al día
- **WHEN** el vehículo recorrió menos de 5.000 km desde el último service y pasaron menos de 3 meses
- **THEN** la función pura devuelve estado `ok`

#### Scenario: Alerta intermedia a los 5.000 km
- **WHEN** el vehículo recorrió 5.000 km o más (pero menos de 10.000) desde el último service
- **THEN** la función pura devuelve estado `alerta-intermedia`

#### Scenario: Service vencido por kilometraje
- **WHEN** el vehículo recorrió 10.000 km o más desde el último service
- **THEN** la función pura devuelve estado `vencido`

#### Scenario: Service vencido por antigüedad
- **WHEN** pasaron 3 meses o más desde la fecha del último service, aunque el kilometraje no haya llegado a 10.000 km
- **THEN** la función pura devuelve estado `vencido` (lo que ocurra primero entre km y tiempo)

### Requirement: Cálculo del vencimiento de habilitaciones VTV y RTO
El sistema SHALL calcular client-side, mediante funciones puras, el estado de vencimiento de las habilitaciones VTV (cada 6 meses) y RTO de forma independiente entre sí (RN-VE-04, US-500), a partir de la fecha de vencimiento registrada de cada una.

#### Scenario: Habilitación vigente
- **WHEN** la fecha de vencimiento de la VTV (o RTO) es posterior a la fecha de referencia y no está próxima
- **THEN** la función pura devuelve estado `vigente` para esa habilitación

#### Scenario: Habilitación próxima a vencer
- **WHEN** la fecha de vencimiento de la VTV (o RTO) cae dentro de la ventana de aviso configurada
- **THEN** la función pura devuelve estado `por-vencer` para esa habilitación

#### Scenario: Habilitación vencida
- **WHEN** la fecha de vencimiento de la VTV (o RTO) es anterior a la fecha de referencia
- **THEN** la función pura devuelve estado `vencida` para esa habilitación

#### Scenario: VTV y RTO evaluadas de forma independiente
- **WHEN** un vehículo tiene la VTV vigente pero la RTO vencida
- **THEN** cada habilitación reporta su propio estado sin que una afecte a la otra

### Requirement: Vista de mantenimiento con alertas visuales accesibles
El sistema SHALL mostrar, en la vista de mantenimiento del vehículo, alertas visuales del estado del service preventivo y de las habilitaciones VTV/RTO, comunicando cada estado con texto e ícono además de color (no solo color) y con contraste suficiente (WCAG AA).

#### Scenario: Alerta de service vencido visible
- **WHEN** el estado calculado del service es `vencido`
- **THEN** la vista muestra una alerta con texto e ícono (no dependiente solo del color) indicando que corresponde el cambio de aceite

#### Scenario: Alerta de habilitación por vencer visible
- **WHEN** el estado calculado de la VTV o la RTO es `por-vencer` o `vencida`
- **THEN** la vista muestra la alerta correspondiente con texto e ícono, identificando cuál habilitación y su estado
