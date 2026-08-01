## MODIFIED Requirements

### Requirement: Registro de gastos del vehículo
El sistema SHALL permitir registrar gastos de un vehículo como eventos con fecha y monto, sin frecuencia fija (US-500, RF-508). Cada gasto MUST persistirse asociado a su vehículo vía `VehiculoRepository.update()`.

El gasto MUST registrarse **sin categoría estructurada**: la entidad Gastos de Vehículo del modelo de datos real (`docs/core/Traslados-Modelo-Datos.docx`) tiene exactamente Vehículo, Monto y Fecha. La enumeración informal del docx ("combustible, peajes, reparaciones menores, entre otros") MUST tratarse como texto libre en la descripción opcional del gasto, y MUST NOT convertirse en un campo de opciones. El formulario de alta MUST NOT ofrecer ningún selector de categoría o clasificación del gasto.

La clasificación de una intervención por tipo (gasto / preventivo / correctivo) y por sub-tipo pertenece a la capability `vehiculo-mantenimiento-historial`, que modela la entidad Mantenimiento — una entidad distinta del docx. Registrar el importe de una intervención de mantenimiento MUST hacerse como un gasto acá, y la intervención en sí como un registro de mantenimiento allá.

> ⚠️ **SUPERSEDED (2026-08-01) — ver `design.md` §Reconciliación con C-08-vehiculos-mantenimiento,
> D9/D11.** El párrafo siguiente describe la decisión original de este documento
> (`facturacion.gastos_vehiculos`, gateo por el módulo `facturacion`). El backend real, ya mergeado
> (`C-08-vehiculos-mantenimiento`, Enzo), implementó otra cosa: el gasto es una fila de
> `conductores.mantenimiento` con `categoria = 'gasto'` (columnas `monto`, `descripcion`,
> `categoria_gasto`, agregadas por `20260730110000_schema_vehiculo_gaps.sql`), gateada por el mismo
> módulo `vehiculos`/`conductores` que el resto de esa tabla. `facturacion.gastos_vehiculos` queda
> **abandonada, no dropeada** — ningún gasto nuevo se persiste ahí. Se conserva el párrafo original
> como registro de la decisión que este documento tomó sin conocer el backend real, no como
> comportamiento vigente.

Con la decisión original de este documento (superada, ver nota de arriba), el gasto MUST persistirse en `facturacion.gastos_vehiculos` — **otro schema y otro módulo de permisos** (`facturacion`, no `vehiculos`), confirmado con la usuaria en `permisos-modulos-granulares`: *"es un gasto, no una operación sobre el vehículo en sí"*. En consecuencia, dar de alta un gasto MUST requerir `facturacion: write` además de (o en vez de, según cómo esté logueada la cuenta) `vehiculos: write`, y una cuenta con `vehiculos: write` pero sin `facturacion: write` MUST poder seguir editando el resto del vehículo — el fallo del gasto MUST NOT bloquear el guardado de los demás datos del vehículo en la misma pantalla.

**Con la implementación real (vigente):** el gasto MUST persistirse en `conductores.mantenimiento` con `categoria = 'gasto'`, gateado por el mismo módulo (`vehiculos`) que el resto de los datos del vehículo. No existe ningún requisito de permiso adicional de `facturacion` para dar de alta un gasto: un usuario con `vehiculos: write` MUST poder registrar y editar gastos sin ningún permiso cruzado. El campo `categoria_gasto` (`'mantenimiento'|'reparacion'|'service'`) que expone la Edge Function real es un **gap abierto** con el tipo `GastoVehiculo` del frontend (que no lo modela desde que se eliminó `CategoriaGasto` por no tener fuente) — no se resuelve en este documento, ver `design.md` §Reconciliación D9/D11.

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

#### Scenario: Alta de un gasto sin permiso de facturación falla sin bloquear el resto del vehículo — ⚠️ SUPERSEDED
> No aplica con la implementación real: no hay ningún gateo de `facturacion` para gastos, así que
> no hay ningún escenario de "falla por falta de `facturacion: write`" que probar. Se conserva el
> texto original como registro de la decisión superada (ver design.md D9/D11).
- **GIVEN** una cuenta con `vehiculos: write` y sin `facturacion: write` que edita la patente del vehículo y agrega un gasto en la misma pantalla
- **WHEN** confirma el guardado
- **THEN** el sistema muestra un mensaje propio (`No tenés permiso para registrar gastos del vehículo.`) para el gasto
- **AND** si el guardado se hace sin la clave `gastos` en el payload, el resto de los cambios del vehículo (patente incluida) se persiste igual

#### Scenario: La descripción del gasto se persiste en la columna real (vigente, columna corregida)
- **GIVEN** un gasto con descripción "Cambio de cubierta delantera"
- **WHEN** se guarda vía `VehiculoRepository.update()`
- **THEN** el valor viaja hasta la columna `conductores.mantenimiento.descripcion` (fila con `categoria = 'gasto'`) y sobrevive a una relectura

#### Scenario: El gasto vive en otro schema, gateado por otro módulo — ⚠️ SUPERSEDED
> No aplica con la implementación real: el gasto vive en `conductores.mantenimiento`, el mismo
> schema y el mismo módulo (`vehiculos`) que el resto de los datos del vehículo. No hay ningún
> gateo cruzado que degradar para gastos. Se conserva como registro de la decisión superada.
- **GIVEN** una cuenta con `vehiculos: read` y sin `facturacion: read`
- **WHEN** abre la ficha de un vehículo con gastos registrados
- **THEN** la sección de gastos no se llena con los datos reales del vehículo (RLS los filtra), y NO se interpreta como "el vehículo no tiene gastos"

### Requirement: Listado de gastos por vehículo
El sistema SHALL mostrar la tabla de gastos de un vehículo con fecha y monto de cada evento, obtenida del vehículo cargado.

La tabla MUST NOT tener columna de categoría del gasto. Los totales del registro de gastos (total gastado, total del mes en curso, fecha del último gasto) MUST seguir calculándose sobre todos los gastos del vehículo, sin agrupar ni filtrar por ninguna clasificación.

> ⚠️ **SUPERSEDED en el mecanismo de acceso (2026-08-01) — ver `design.md` §Reconciliación D9/D11.**
> El párrafo siguiente asume PostgREST directo y RLS por tabla; la implementación real resuelve la
> lectura mediante la Edge Function `vehiculos`, que hace un único chequeo grueso de permiso y usa
> un cliente `service-role`. Se conserva el texto original abajo, marcado, y se agrega la versión
> vigente a continuación.

Con la decisión original de este documento (superada), la lectura de los gastos de un vehículo (o de N vehículos en el listado) MUST resolverse con **una sola** consulta a `facturacion.gastos_vehiculos`, nunca una consulta por vehículo (patrón N+1), dado que la tabla vive en un schema distinto del de `conductores.vehiculo` y no puede resolverse en el mismo embed de PostgREST. Sin `facturacion: read`, la tabla de gastos MUST mostrarse vacía con un cartel explícito que indique que los gastos no se muestran por falta de ese permiso, y MUST NOT mostrarse como si el total fuera "$0" o como si no hubiera gastos registrados.

**Con la implementación real (vigente):** los gastos de un vehículo (o de una lista completa) SHALL leerse en la misma respuesta de la Edge Function `vehiculos` que trae el resto del vehículo (`gastos` sale de `mantenimiento` filtrado a `categoria = 'gasto'` dentro de `toApi()`), sin ninguna consulta adicional del lado del frontend. No existe ningún permiso `facturacion: read` que degradar: un usuario con `vehiculos: read` SHALL ver siempre sus gastos completos.

#### Scenario: Tabla de gastos poblada
- **WHEN** el vehículo tiene gastos registrados
- **THEN** se muestran en una tabla con fecha y monto por fila, sin columna de categoría

#### Scenario: Sin gastos registrados
- **WHEN** el vehículo no tiene gastos
- **THEN** se muestra un estado vacío indicando que aún no hay gastos registrados

#### Scenario: Totales sin agrupación por categoría
- **WHEN** el vehículo tiene varios gastos registrados
- **THEN** el resumen muestra el total gastado, el total del mes en curso y la fecha del último gasto, calculados sobre el conjunto completo de gastos

#### Scenario: Sin facturacion:read, los gastos se degradan señalizados, nunca como "$0" — ⚠️ SUPERSEDED
> No aplica con la implementación real: no existe un permiso `facturacion: read` que gatee los
> gastos del vehículo. Se conserva el texto original como registro de la decisión superada.
- **GIVEN** una cuenta con `vehiculos: read` y sin `facturacion: read`
- **WHEN** abre la ficha de un vehículo que sí tiene gastos cargados en la base
- **THEN** la sección de gastos se muestra vacía con un cartel que explica que no se muestran por falta de permiso de facturación
- **AND** el resumen de totales NO se presenta como "$0" ni como "sin gastos registrados"

#### Scenario: La lectura de gastos de N vehículos viaja en la misma respuesta que el vehículo (vigente)
- **GIVEN** un listado con 5 vehículos, cada uno con gastos propios
- **WHEN** se invoca `list()` sobre `VehiculoRepository`
- **THEN** la Edge Function `vehiculos` devuelve cada vehículo con su propio array `gastos` ya resuelto, sin ninguna consulta adicional del lado del frontend
- **AND** cada vehículo del listado muestra únicamente sus propios gastos
