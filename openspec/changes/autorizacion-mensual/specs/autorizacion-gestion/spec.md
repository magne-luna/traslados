## MODIFIED Requirements

### Requirement: Formulario de autorización ligado a un presupuesto, uno de N por mes

El sistema SHALL proveer un formulario de autorización asociado a un presupuesto existente (por `presupuestoId`) y a un mes calendario (`periodoMes`), con selector de estado, monto autorizado, cupo mensual de días y de km editables, fecha de respuesta, fecha de vigencia, mes (`<input type="month">`, con rótulo "Mes N" derivado) y archivo único adjunto. Contra la implementación real, un presupuesto MUST poder tener múltiples autorizaciones (una por mes), y la resolución de las autorizaciones de un presupuesto MUST tratar la lista vacía como un estado normal —no como un error—. El estado inicial de cada autorización MUST provenir del default del servidor.

(Previously: el formulario asumía una única autorización por presupuesto, resuelta con `getByPresupuestoId` a `Autorizacion | null`, sin ningún campo de mes.)

#### Scenario: La autorización se crea sobre un presupuesto existente, para un mes concreto
- **WHEN** se crea una autorización
- **THEN** referencia un `presupuestoId` de un presupuesto que existe y un `periodoMes` (o ninguno, si se deja sin cargar), y el detalle del presupuesto la lista entre las autorizaciones de ese presupuesto vía `AutorizacionRepository.listByPresupuestoId`

#### Scenario: Un presupuesto sin ninguna autorización muestra el alta, no un error
- **GIVEN** un presupuesto recién creado, todavía sin autorizaciones
- **WHEN** se abre su detalle contra la implementación real
- **THEN** `listByPresupuestoId` resuelve `[]`
- **AND** la pantalla ofrece cargar la primera autorización, sin mostrar ningún mensaje de error

#### Scenario: Selector de estado con los cuatro valores
- **WHEN** se edita el estado de una autorización
- **THEN** el selector ofrece exactamente `pendiente`, `autorizada`, `judicializada` y `rechazada` (unión cerrada `EstadoAutorizacion`), y el flujo esperado `pendiente → autorizada → judicializada → rechazada` está documentado

#### Scenario: El estado inicial lo define el servidor
- **GIVEN** una autorización recién creada sin estado explícito
- **WHEN** se lee desde el servidor
- **THEN** su estado es `pendiente`, por el valor por defecto declarado en la columna
- **AND** el frontend NO define ese default por su cuenta

#### Scenario: Cambiar el estado no toca los cupos ya cargados
- **GIVEN** una autorización con cupo mensual de días y de km cargados
- **WHEN** el usuario cambia únicamente el estado y guarda
- **THEN** los cupos quedan exactamente como estaban
- **AND** la actualización enviada al servidor no incluye esos campos

#### Scenario: Cupo mensual de días/km visible y editable
- **WHEN** se carga o edita una autorización
- **THEN** los campos `cupoMensualDias` y `cupoMensualKm` son visibles y editables (RN-PA-03), y quedan persistidos en la autorización

#### Scenario: El campo de mes es la identidad de esta fila (nuevo)
- **WHEN** se carga o edita una autorización
- **THEN** el campo de mes (`<input type="month">`) es visible y, en alta, se prellena con el primer mes no cargado del presupuesto
- **AND** en edición queda editable, con re-chequeo de unicidad contra las demás autorizaciones del mismo presupuesto

#### Scenario: Mensaje de dominio al intentar cargar un mes duplicado (nuevo)
- **GIVEN** un presupuesto con una autorización ya cargada para abril de 2026
- **WHEN** se intenta guardar otra autorización con el mismo mes para el mismo presupuesto
- **THEN** el formulario bloquea el guardado con el mismo mensaje de dominio que traduce el `23505` real ("Ya existe una autorización para ese mes en este presupuesto.")

> Nota: se retira el escenario "Un presupuesto sin autorización muestra el alta, no un error" en su
> forma singular (`getByPresupuestoId` a `null`); reemplazado arriba por su equivalente plural
> (`listByPresupuestoId` a `[]`). Reason: D5 de `autorizacion-mensual/design.md`. Migration:
> ninguna — cambio de contrato de frontend, sin migración de datos. Los Requirements "Carga
> retroactiva con fecha de vigencia independiente" y "Archivo único adjunto de la autorización" de
> esta capability **no cambian** por este change — no se repiten acá para no duplicar contenido que
> no se modifica.
