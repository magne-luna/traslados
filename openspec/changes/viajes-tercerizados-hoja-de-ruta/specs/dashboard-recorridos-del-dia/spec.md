## MODIFIED Requirements

### Requirement: Detalle por recorrido con vehículo y conductor
El sistema SHALL listar cada recorrido de la jornada identificando su vehículo y su conductor —o, si el recorrido es tercerizado, su tipo de transporte y agencia (RN-HR-05)— y la cantidad de paradas del recorrido.

#### Scenario: Identificación legible del recorrido
- **WHEN** se lista un recorrido `propio`
- **THEN** se muestra la patente o identificación del vehículo y el nombre del conductor, resueltos desde los repositorios de vehículos y conductores por su id, no el id crudo

#### Scenario: Identificación de un recorrido tercerizado
- **WHEN** se lista un recorrido `aplicacion` o `remis`
- **THEN** se muestra "Uber / aplicación" o "Remis · <agencia>" en lugar de vehículo y conductor, sin el texto de referencia no disponible

#### Scenario: Referencia inexistente
- **WHEN** un recorrido `propio` referencia un vehículo o un conductor que no se pudo resolver
- **THEN** el recorrido se muestra igual con un texto indicando que la referencia no está disponible, sin romper el panel ni omitir el recorrido

#### Scenario: Recorrido manual señalizado
- **WHEN** un recorrido está marcado como manual
- **THEN** se identifica como tal en la lista, para distinguirlo de los recorridos con frecuencia habitual
