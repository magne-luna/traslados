## MODIFIED Requirements

### Requirement: Validación RN-PA-01 como función pura (autorización nunca mayor al presupuesto)
El sistema SHALL implementar una función pura `validarAutorizacion` que reciba el monto autorizado y el monto del presupuesto y devuelva un resultado ok/error, rechazando o alertando cuando `montoAutorizado > presupuesto.monto` ("la autorización puede coincidir con el presupuesto o ser menor, nunca mayor", RN-PA-01). Esta función SHALL ser explícitamente un **espejo de interfaz**: el control real de la regla vive en el servidor. La función pura MUST NOT tratarse como el mecanismo que hace cumplir RN-PA-01, dado que es evitable desde el cliente.

#### Scenario: Autorización mayor al presupuesto se rechaza
- **WHEN** `montoAutorizado` es mayor que `presupuesto.monto`
- **THEN** `validarAutorizacion` devuelve un error (RN-PA-01) y el formulario bloquea/alerta el guardado con un mensaje visible

#### Scenario: Autorización igual o menor al presupuesto se acepta
- **WHEN** `montoAutorizado` es igual o menor que `presupuesto.monto`
- **THEN** `validarAutorizacion` devuelve ok y el guardado procede

#### Scenario: Autorización sin monto (estado pendiente) no dispara el error de monto
- **WHEN** el `montoAutorizado` está ausente (por ejemplo, estado `pendiente`)
- **THEN** `validarAutorizacion` no reporta el error de RN-PA-01 por comparación de montos (no hay monto que comparar todavía)

#### Scenario: La validación es una función pura testeable
- **WHEN** se invoca `validarAutorizacion` con distintos pares de montos
- **THEN** el resultado depende solo de sus argumentos (sin efectos de red ni de `localStorage`), permitiendo tests deterministas de RN-PA-01

#### Scenario: La validación de interfaz no es el control de la regla
- **GIVEN** la función pura del frontend
- **WHEN** se documenta su rol
- **THEN** queda escrito que es un espejo de interfaz para dar retroalimentación temprana
- **AND** que el rechazo definitivo lo aplica el servidor

## ADDED Requirements

### Requirement: RN-PA-01 se aplica en el servidor y su rechazo se traduce a lenguaje de dominio

El sistema SHALL apoyarse en el control de RN-PA-01 que aplica el servidor sobre
`facturacion.autorizacion` en cada inserción y actualización, comparando el monto autorizado contra el
monto del presupuesto referenciado. El sistema MUST traducir ese rechazo a un `Error` con un mensaje
en castellano que explique la regla en términos de negocio, y MUST NOT mostrar al usuario el texto
crudo del motor de base de datos, que incluye el nombre de la columna y el identificador interno de la
regla. El sistema MUST NOT reimplementar la comparación en el repository como si fuera el control.

#### Scenario: El servidor rechaza una autorización mayor al presupuesto

- **GIVEN** un presupuesto con un monto determinado
- **WHEN** se intenta persistir una autorización con un monto autorizado mayor
- **THEN** el servidor rechaza la escritura
- **AND** ninguna fila queda creada ni modificada

#### Scenario: El rechazo llega a la interfaz en castellano y sin jerga

- **GIVEN** un rechazo de RN-PA-01 devuelto por el servidor
- **WHEN** el repository lo traduce
- **THEN** el `message` del `Error` indica que la autorización no puede superar el monto del
  presupuesto
- **AND** NO contiene el nombre de la columna, el identificador interno de la regla ni los montos
  crudos del motor

#### Scenario: La regla se aplica aunque se saltee la validación de la interfaz

- **GIVEN** una escritura emitida sin pasar por `validarAutorizacion`
- **WHEN** el monto autorizado supera el del presupuesto
- **THEN** el servidor la rechaza igualmente
- **AND** la regla queda cumplida sin depender del cliente

#### Scenario: Editar un presupuesto a la baja no puede dejar autorizaciones inconsistentes sin aviso

- **GIVEN** un presupuesto que ya tiene una autorización con monto autorizado
- **WHEN** se reduce el monto del presupuesto por debajo del monto ya autorizado
- **THEN** queda documentado si el sistema lo permite y qué ocurre con la autorización existente
- **AND** el comportamiento observado se registra en la verificación manual, en lugar de asumirse

#### Scenario: La traducción del rechazo está cubierta por un test

- **GIVEN** el texto literal del rechazo tal como lo emite el servidor
- **WHEN** se ejercita la traducción de errores
- **THEN** existe un test que usa ese texto literal, no una paráfrasis
- **AND** el test verifica que el texto original no aparece en el mensaje resultante
