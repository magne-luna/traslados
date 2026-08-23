## MODIFIED Requirements

### Requirement: listByPresupuestoId resuelve siempre a un arreglo, incluida la lista vacía

El sistema SHALL resolver `listByPresupuestoId(presupuestoId, periodoMes?)` invocando la Edge Function `autorizaciones` con el filtro `?presupuestoId=` (y `&periodoMes=` cuando se pasa), con el id **percent-encoded**. La función responde siempre `200` con un arreglo — nunca `404` — ordenado por `periodo_mes` (`NULLS FIRST`). El sistema MUST resolver a `[]` cuando el presupuesto no tiene ninguna autorización, y MUST NOT tratar esa respuesta como una condición de "no encontrado".

(Previously: el método se llamaba `getByPresupuestoId`, singular, resolvía a `Autorizacion | null`, y trataba el `404` de la Edge Function como "sin autorización" mediante `esErrorNotFound`.)

#### Scenario: Un presupuesto sin autorizaciones resuelve a una lista vacía

- **GIVEN** un presupuesto recién creado, sin autorización cargada
- **WHEN** se invoca `listByPresupuestoId(presupuestoId)`
- **THEN** la Edge Function responde `200` con `[]`
- **AND** la promesa resuelve `[]` sin lanzar
- **AND** el detalle del presupuesto muestra el formulario de alta de autorización, no un error

#### Scenario: Un presupuesto con varias autorizaciones devuelve todas, ordenadas

- **GIVEN** un presupuesto con autorizaciones para marzo, abril y una fila legacy sin período
- **WHEN** se invoca `listByPresupuestoId(presupuestoId)`
- **THEN** se emite una sola invocación con el filtro `presupuestoId`
- **AND** se devuelve el arreglo con la fila legacy primero y marzo/abril en orden ascendente

#### Scenario: Falta de permiso no se confunde con ausencia de autorizaciones

- **GIVEN** un usuario sin permiso `presupuestos: read`
- **WHEN** se invoca `listByPresupuestoId(presupuestoId)`
- **THEN** la Edge Function responde `403`
- **AND** la promesa rechaza con un error de falta de permiso
- **AND** NO resuelve a `[]`

#### Scenario: Filtrar por un mes puntual

- **GIVEN** un presupuesto con autorizaciones para marzo y abril
- **WHEN** se invoca `listByPresupuestoId(presupuestoId, '2026-03-01')`
- **THEN** la invocación incluye `&periodoMes=2026-03-01`
- **AND** se devuelve únicamente la fila de marzo

> Nota: se retira el escenario "Un presupuesto con autorización devuelve la autorización" en su
> forma singular; reemplazado arriba por su equivalente plural. `esErrorNotFound` se retira
> específicamente de esta consulta (sigue usándose en `getById`/`obtenerAutorizacion`, fuera del
> alcance de este requirement). Reason: D5 de `autorizacion-mensual/design.md` — la Edge Function ya
> no distingue "sin autorización" como error. Migration: ninguna, cambio de contrato de lectura, sin
> migración de datos.

### Requirement: El rechazo de unicidad de mes se traduce a lenguaje de dominio

El sistema SHALL traducir el `23505` crudo devuelto por el índice único parcial `(presupuesto_id, periodo_mes)` al mensaje "Ya existe una autorización para ese mes en este presupuesto.", tanto en `create` como en `update`, sin exponer el código de error de Postgres a la interfaz.

#### Scenario: Alta duplicada traducida

- **GIVEN** un presupuesto con una autorización ya cargada para abril de 2026
- **WHEN** se intenta crear otra autorización para el mismo presupuesto y mes
- **THEN** la promesa rechaza con el mensaje de dominio, no con el texto crudo de Postgres

#### Scenario: Edición que produce el mismo choque de unicidad

- **GIVEN** una autorización de marzo y otra de abril del mismo presupuesto
- **WHEN** se edita la de abril y se le cambia el mes a marzo
- **THEN** el rechazo usa el mismo mensaje de dominio, con la operación `actualizar`

> Nota: los Requirements "Implementación real SupabaseAutorizacionRepository", "Lectura del listado
> en una sola invocación", "El estado ausente adopta el default del servidor, no un valor
> inventado", "update propaga el 404 en lugar de absorberlo", "Actualización parcial que no pisa
> campos no tocados", "El rechazo de RN-PA-01 por el servidor se traduce a lenguaje de dominio", "La
> vigencia retroactiva persiste en el servidor", "El adjunto se mapea desde columnas reales de
> metadata", "Mapeo en funciones puras y aisladas" y "Contrato de errores compartido con el
> repository de presupuestos" de esta capability **no cambian** por este change — no se repiten acá.
