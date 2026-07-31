## MODIFIED Requirements

### Requirement: Registro de gastos del vehículo
El sistema SHALL permitir registrar gastos de un vehículo como eventos con fecha y monto, sin frecuencia fija (US-500, RF-508). Cada gasto MUST persistirse asociado a su vehículo vía `VehiculoRepository.update()`.

El gasto MUST registrarse **sin categoría estructurada**: la entidad Gastos de Vehículo del modelo de datos real (`docs/core/Traslados-Modelo-Datos.docx`) tiene exactamente Vehículo, Monto y Fecha. La enumeración informal del docx ("combustible, peajes, reparaciones menores, entre otros") MUST tratarse como texto libre en la descripción opcional del gasto, y MUST NOT convertirse en un campo de opciones. El formulario de alta MUST NOT ofrecer ningún selector de categoría o clasificación del gasto.

La clasificación de una intervención por tipo (gasto / preventivo / correctivo) y por sub-tipo pertenece a la capability `vehiculo-mantenimiento-historial`, que modela la entidad Mantenimiento — una entidad distinta del docx. Registrar el importe de una intervención de mantenimiento MUST hacerse como un gasto acá, y la intervención en sí como un registro de mantenimiento allá.

Con la implementación real, el gasto MUST persistirse en `facturacion.gastos_vehiculos` — **otro schema y otro módulo de permisos** (`facturacion`, no `vehiculos`), confirmado con la usuaria en `permisos-modulos-granulares`: *"es un gasto, no una operación sobre el vehículo en sí"*. En consecuencia, dar de alta un gasto MUST requerir `facturacion: write` además de (o en vez de, según cómo esté logueada la cuenta) `vehiculos: write`, y una cuenta con `vehiculos: write` pero sin `facturacion: write` MUST poder seguir editando el resto del vehículo — el fallo del gasto MUST NOT bloquear el guardado de los demás datos del vehículo en la misma pantalla.

#### Scenario: Alta de un gasto
- **WHEN** el usuario ingresa la fecha y el monto de un gasto y confirma
- **THEN** el gasto se agrega a la lista de gastos del vehículo y se persiste

#### Scenario: Validación de monto
- **WHEN** el usuario intenta registrar un gasto con monto vacío o no positivo
- **THEN** el formulario bloquea el registro y señala el campo inválido

#### Scenario: El formulario de gasto no pide categoría
- **WHEN** el usuario abre el formulario de alta de gasto
- **THEN** los campos son fecha, monto y descripción opcional, y no hay ningún selector de categoría del gasto

#### Scenario: Gasto de combustible o peaje descripto en texto libre
- **WHEN** el usuario registra un gasto de combustible o de peaje
- **THEN** puede describirlo en el campo de descripción, sin tener que elegir una categoría de una lista

#### Scenario: Alta de un gasto sin permiso de facturación falla sin bloquear el resto del vehículo
- **GIVEN** una cuenta con `vehiculos: write` y sin `facturacion: write` que edita la patente del vehículo y agrega un gasto en la misma pantalla
- **WHEN** confirma el guardado
- **THEN** el sistema muestra un mensaje propio (`No tenés permiso para registrar gastos del vehículo.`) para el gasto
- **AND** si el guardado se hace sin la clave `gastos` en el payload, el resto de los cambios del vehículo (patente incluida) se persiste igual

#### Scenario: La descripción del gasto se persiste en la columna real
- **GIVEN** un gasto con descripción "Cambio de cubierta delantera"
- **WHEN** se guarda vía `VehiculoRepository.update()`
- **THEN** el valor viaja hasta la columna `facturacion.gastos_vehiculos.descripcion` y sobrevive a una relectura

#### Scenario: El gasto vive en otro schema, gateado por otro módulo
- **GIVEN** una cuenta con `vehiculos: read` y sin `facturacion: read`
- **WHEN** abre la ficha de un vehículo con gastos registrados
- **THEN** la sección de gastos no se llena con los datos reales del vehículo (RLS los filtra), y NO se interpreta como "el vehículo no tiene gastos"

### Requirement: Listado de gastos por vehículo
El sistema SHALL mostrar la tabla de gastos de un vehículo con fecha y monto de cada evento, obtenida del vehículo cargado.

La tabla MUST NOT tener columna de categoría del gasto. Los totales del registro de gastos (total gastado, total del mes en curso, fecha del último gasto) MUST seguir calculándose sobre todos los gastos del vehículo, sin agrupar ni filtrar por ninguna clasificación.

Con la implementación real, la lectura de los gastos de un vehículo (o de N vehículos en el listado) MUST resolverse con **una sola** consulta a `facturacion.gastos_vehiculos`, nunca una consulta por vehículo (patrón N+1), dado que la tabla vive en un schema distinto del de `conductores.vehiculo` y no puede resolverse en el mismo embed de PostgREST. Sin `facturacion: read`, la tabla de gastos MUST mostrarse vacía con un cartel explícito que indique que los gastos no se muestran por falta de ese permiso, y MUST NOT mostrarse como si el total fuera "$0" o como si no hubiera gastos registrados.

#### Scenario: Tabla de gastos poblada
- **WHEN** el vehículo tiene gastos registrados
- **THEN** se muestran en una tabla con fecha y monto por fila, sin columna de categoría

#### Scenario: Sin gastos registrados
- **WHEN** el vehículo no tiene gastos
- **THEN** se muestra un estado vacío indicando que aún no hay gastos registrados

#### Scenario: Totales sin agrupación por categoría
- **WHEN** el vehículo tiene varios gastos registrados
- **THEN** el resumen muestra el total gastado, el total del mes en curso y la fecha del último gasto, calculados sobre el conjunto completo de gastos

#### Scenario: Sin facturacion:read, los gastos se degradan señalizados, nunca como "$0"
- **GIVEN** una cuenta con `vehiculos: read` y sin `facturacion: read`
- **WHEN** abre la ficha de un vehículo que sí tiene gastos cargados en la base
- **THEN** la sección de gastos se muestra vacía con un cartel que explica que no se muestran por falta de permiso de facturación
- **AND** el resumen de totales NO se presenta como "$0" ni como "sin gastos registrados"

#### Scenario: La lectura de gastos de N vehículos es una sola consulta
- **GIVEN** un listado con 5 vehículos, cada uno con gastos propios
- **WHEN** se invoca `list()` sobre `VehiculoRepository`
- **THEN** se emite exactamente una consulta a `facturacion.gastos_vehiculos` filtrada por los 5 `vehiculo_id`
- **AND** cada vehículo del listado muestra únicamente sus propios gastos, agrupados client-side
