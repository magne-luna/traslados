# Spec: Selección de autorización mensual en el Paso 2 de facturación

> **Nota de reconciliación (para quien archive este change).** Esta capability lógica
> (`factura-autorizacion-seleccion`, nombrada así en `proposal.md`/`design.md` de este change y ya
> referenciada con ese mismo nombre por `facturacion-seleccion-autorizacion/specs/factura-crud/spec.md`)
> todavía no tiene su propio `spec.md` bajo `openspec/specs/`: hoy vive dentro del Requirement
> "Formulario de carga de factura" de la capability `factura-crud`, y ese Requirement en sí es un
> delta **sin archivar** (`facturacion-seleccion-autorizacion` sigue activo — `tasks.md` Fase 0.1 de
> este change registró la decisión explícita de la usuaria de **no** archivarlo todavía). Este delta
> modifica la misma superficie —la selección de autorización del Paso 2— **por encima** de un delta
> que aún no se fusionó a `openspec/specs/`. Al archivar `autorizacion-mensual`, reconciliar contra
> el estado real de `factura-crud/spec.md` en ese momento (que a esa altura debería incluir ya el
> Requirement de selección de autorización de `facturacion-seleccion-autorizacion`), no contra el
> `openspec/specs/factura-crud/spec.md` actual (que todavía tiene los campos
> `prestadorNombre`/`prestadorDomicilio` viejos, sin ninguna autorización).

## MODIFIED Requirements

### Requirement: Selector de autorización del Paso 2 muestra N meses por presupuesto, ordenados y distinguibles

El sistema SHALL mostrar, en el selector de autorizaciones pendientes del Paso 2 del wizard de facturación, una opción por cada mes de cada presupuesto del paciente (no una por presupuesto), etiquetada con `{prestación o fallback} · {etiqueta del mes}` y ordenada por `periodoMes` ascendente (las filas legacy sin mes, primero). El sistema SHALL preseleccionar la autorización cuyo `periodoMes` coincide con `(mesFacturado, anioFacturado)` únicamente cuando exista **exactamente una** coincidencia, sin bloquear el cambio manual, y SHALL mostrar un aviso no bloqueante cuando el mes elegido no coincida con el período facturado (detalle de preselección y aviso en la capability `factura-coherencia-periodo`).

(Previously: el selector mostraba una opción por presupuesto, asumiendo que cada presupuesto tenía a lo sumo una autorización pendiente — con el modelo mensual, N autorizaciones del mismo presupuesto se etiquetaban de forma idéntica, indistinguibles entre sí en el `<select>`.)

#### Scenario: Selección de autorización obligatoria en el alta
- **GIVEN** un paciente elegido en el paso 1 con al menos una autorización pendiente de facturar
- **WHEN** el usuario llega al paso 2 ("Autorización") del formulario
- **THEN** se muestra un selector de las autorizaciones pendientes de ese paciente, y el avance al resto del formulario queda bloqueado hasta que el usuario elige una

#### Scenario: Avance bloqueado sin autorizaciones pendientes
- **GIVEN** un paciente elegido sin ninguna autorización en estado `autorizada`
- **WHEN** el usuario llega al paso 2 del formulario
- **THEN** se muestra un estado vacío con mensaje y link a Presupuestos, y el botón "Siguiente" queda bloqueado hasta que el paciente tenga alguna autorización pendiente

#### Scenario: Autorización de solo lectura en edición
- **GIVEN** una factura existente con una `autorizacionId` ya persistida
- **WHEN** el usuario abre esa factura en modo edición
- **THEN** la autorización se muestra de solo lectura y no puede recambiarse — la edición no bifurca

#### Scenario: Tres meses del mismo presupuesto son distinguibles entre sí (nuevo, requisito obligatorio)
- **GIVEN** un presupuesto con autorizaciones para enero, febrero y marzo de 2026, misma prestación
- **WHEN** se muestran como opciones del selector
- **THEN** las tres etiquetas son distintas entre sí (incluyen el mes), nunca tres opciones idénticas

#### Scenario: Orden cronológico entre presupuestos distintos (nuevo)
- **GIVEN** autorizaciones pendientes de dos presupuestos distintos del mismo paciente, insertadas fuera de orden cronológico
- **WHEN** se muestran como opciones del selector
- **THEN** aparecen ordenadas por `periodoMes` ascendente, y las filas legacy (sin mes) aparecen primero

> Nota: se retiran los escenarios "Nombre y domicilio del prestador en modalidad por-prestación",
> "Avance bloqueado sin completar ambos campos del prestador" y "Sin campos de prestador en
> modalidad general" (ya retirados por `facturacion-seleccion-autorizacion`, no reintroducidos por
> este change). Los escenarios "El domicilio se elige entre las direcciones del paciente", "Total
> propuesto y editable", "Validación de campos obligatorios antes de guardar", "Persistencia vía
> repository inyectado", "El valor del km se carga a mano, sin automatización" y "Tipo de
> comprobante siempre manual, sin auto-completar ni bloquearse" del Requirement "Formulario de carga
> de factura" **no cambian** por este change — no se repiten acá para no duplicar contenido que no
> se modifica; siguen vigentes tal como los dejó `facturacion-seleccion-autorizacion`. La
> preselección automática y el aviso de coherencia/convivencia de modelos se especifican en la
> capability nueva `factura-coherencia-periodo`, no acá, para no mezclar "qué opciones muestra el
> selector" con "qué hace el sistema con la elección".
