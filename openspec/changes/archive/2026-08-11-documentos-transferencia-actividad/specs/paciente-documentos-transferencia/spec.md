## Purpose

Permite corregir un error de carga de documentación del paciente reasignando un documento ya subido de
una actividad a otra (o al bloque general) sin volver a subirlo, conservando su identidad y su archivo
original.

## ADDED Requirements

> **Nota de estado.** Los checkpoints (c), (d), (f), (g) y (h) de `design.md` condicionan estos
> requisitos y **no tienen veredicto todavía** (`tasks.md` §0). El texto de abajo refleja los
> **defaults recomendados**; si un veredicto sale distinto, el requisito afectado se reescribe antes
> de implementar. El **Checkpoint (a)** —el del video pendiente de la clienta— **no** afecta a esta
> capacidad: transferir es independiente de cómo se resuelva la navegación.

### Requirement: Un documento cargado se puede reasignar a otra actividad del mismo paciente

El sistema SHALL permitir reasignar un documento ya cargado de la actividad en la que está a otra
actividad del **mismo paciente**, o al bloque de documentación general, sin requerir que el usuario
vuelva a subir el archivo.

La reasignación SHALL conservar la identidad del documento: su identificador, el ítem del checklist al
que corresponde, su nombre de archivo, su fecha de subida y su contenido MUST permanecer sin cambios.

El sistema MUST NOT ofrecer como destino a otro paciente. La reasignación SHALL estar acotada a las
actividades del paciente al que el documento ya pertenece.

El sistema MUST NOT alterar el ítem del checklist del documento como parte de la reasignación: cambiar
de ítem es una operación distinta y no forma parte de esta capacidad.

#### Scenario: Corregir un documento subido en la actividad equivocada

- **GIVEN** un paciente con dos actividades registradas, y un documento cargado por error en la primera
- **WHEN** el usuario reasigna ese documento a la segunda actividad
- **THEN** el documento deja de figurar en la primera actividad y pasa a figurar en la segunda, bajo el
  mismo ítem del checklist, con el mismo nombre de archivo y la misma fecha de subida

#### Scenario: El contenido del documento sigue siendo el mismo después de reasignarlo

- **GIVEN** un documento reasignado de una actividad a otra
- **WHEN** el usuario lo previsualiza o lo descarga desde su nueva actividad
- **THEN** obtiene exactamente el mismo archivo que antes de la reasignación

#### Scenario: No se ofrece ningún destino fuera del paciente

- **GIVEN** un usuario reasignando un documento de un paciente
- **WHEN** consulta los destinos disponibles
- **THEN** solo se ofrecen actividades de ese mismo paciente y su bloque general, y ningún otro
  paciente aparece como destino posible

### Requirement: El bloque general es origen y destino válido de una reasignación

El sistema SHALL permitir reasignar un documento **desde** el bloque de documentación general **hacia**
una actividad, y **desde** una actividad **hacia** el bloque general.

Este requisito existe porque el bloque general es el destino por defecto de toda la documentación
cargada antes de que existiera la separación por actividad, y por lo tanto es el origen más probable de
una corrección.

#### Scenario: Mover un documento general a la actividad que le corresponde

- **GIVEN** un documento en el bloque de documentación general del paciente
- **WHEN** el usuario lo reasigna a una de las actividades del paciente
- **THEN** el documento pasa a figurar en esa actividad y deja de figurar en el bloque general

#### Scenario: Devolver un documento al bloque general

- **GIVEN** un documento cargado en una actividad
- **WHEN** el usuario lo reasigna al bloque de documentación general
- **THEN** el documento pasa a figurar en el bloque general y deja de figurar en esa actividad

### Requirement: La reasignación exige confirmación explícita antes de ejecutarse

El sistema SHALL pedir una confirmación explícita antes de ejecutar la reasignación, indicando qué
documento se mueve, desde dónde y hacia dónde.

Si el usuario cancela, el sistema MUST NOT modificar nada.

Este requisito aplica el mismo criterio ya vigente para quitar una actividad con documentación cargada:
toda operación que cambia la ubicación de documentación clínica se confirma antes de ejecutarse.

#### Scenario: El usuario cancela la reasignación

- **GIVEN** un usuario que inició la reasignación de un documento
- **WHEN** cancela la confirmación
- **THEN** el documento permanece exactamente donde estaba, sin ningún cambio

#### Scenario: La confirmación identifica origen y destino

- **GIVEN** un usuario reasignando un documento de una actividad a otra
- **WHEN** el sistema pide confirmación
- **THEN** el pedido identifica el documento, la actividad de origen y la actividad de destino de forma
  legible, sin ambigüedad entre dos actividades del mismo tipo

### Requirement: La reasignación es visible de inmediato en los dos bloques afectados

Una reasignación afecta a dos bloques a la vez. El sistema SHALL reflejar el resultado en **ambos** —
el de origen y el de destino — sin requerir que el usuario recargue la pantalla ni navegue fuera de
ella.

El progreso documental de las dos instancias afectadas, y el total agregado del paciente, SHALL quedar
consistentes con el nuevo estado.

#### Scenario: Los dos bloques se actualizan tras la reasignación

- **GIVEN** un paciente con dos actividades, la primera con un documento cargado en un ítem y la
  segunda con ese ítem vacío
- **WHEN** el usuario reasigna ese documento de la primera actividad a la segunda
- **THEN** el bloque de la primera actividad deja de mostrar el documento y su progreso baja, y el
  bloque de la segunda lo muestra y su progreso sube, sin recargar la pantalla

#### Scenario: El total agregado del paciente no cambia por una reasignación

- **GIVEN** un paciente con documentación cargada en varias actividades
- **WHEN** el usuario reasigna un documento de una actividad a otra
- **THEN** la cantidad total de documentos cargados del paciente sigue siendo la misma: un documento
  cambió de lugar, no se creó ni se eliminó ninguno

### Requirement: La reasignación no duplica, no borra y no puede perder el documento

El sistema MUST NOT implementar la reasignación como una copia seguida de un borrado. La operación
SHALL ser un único cambio de ubicación, sin ningún estado intermedio en el que el documento exista dos
veces o no exista en ninguna parte.

Si la reasignación falla, el documento MUST permanecer íntegro en su ubicación original y el sistema
SHALL informar el error, sin dejar el documento en un estado ambiguo.

#### Scenario: Una reasignación fallida no altera nada

- **GIVEN** un documento cargado en una actividad
- **WHEN** el usuario intenta reasignarlo y la operación falla
- **THEN** el documento sigue estando completo en su actividad original, el sistema informa el fallo, y
  no aparece ninguna copia en la actividad de destino

#### Scenario: El documento nunca aparece en dos actividades a la vez

- **GIVEN** un documento reasignado de una actividad a otra
- **WHEN** el usuario consulta la documentación completa del paciente
- **THEN** el documento aparece exactamente una vez, en su nueva actividad

### Requirement: Reasignar exige permiso de escritura sobre el módulo de pacientes

El sistema SHALL exigir el mismo permiso de escritura que ya exigen la carga y la eliminación de
documentos del paciente. En modo de solo lectura, la acción de reasignar MUST NOT estar disponible.

La restricción MUST estar respaldada por el control de acceso del backend, y no depender únicamente de
que la interfaz oculte la acción.

#### Scenario: En modo solo lectura no se puede reasignar

- **GIVEN** un usuario sin permiso de escritura sobre el módulo de pacientes
- **WHEN** consulta la documentación de un paciente
- **THEN** puede ver y previsualizar los documentos, pero no se le ofrece ninguna acción de reasignación

#### Scenario: El backend rechaza la reasignación sin permiso

- **GIVEN** un usuario sin permiso de escritura sobre el módulo de pacientes
- **WHEN** se intenta reasignar un documento salteando la interfaz
- **THEN** la operación es rechazada y el documento permanece sin cambios

### Requirement: Un documento reasignado a un bloque cuyo checklist no incluye su ítem sigue siendo visible

> **Nota de estado (2026-08-11).** Este requisito documenta el Checkpoint (e) de `design.md`, cuyo
> veredicto se revisó el 2026-08-11: pasa de "opción C acá + B como forma futura" a **opción B
> implementada en este mismo change**, antes de archivarlo. La guardia es genérica del componente
> compartido `DocumentChecklist.tsx` (`openspec/changes/.../tasks.md` §10) — no depende de que
> `openspec/changes/documentos-checklist-items-por-actividad/` (en curso en otra línea de trabajo,
> no editado por este change) esté aplicado, y protege también a ese change cuando cablee
> `combinarItemsDeActividad()`.

El sistema MUST NOT ocultar un documento porque el ítem de checklist al que pertenece no forma parte
de la lista de ítems vigente del bloque donde está. Esto puede ocurrir tras una reasignación (este
change) hacia una actividad cuyo checklist no incluye ese ítem, o por cualquier otro drift entre el
`itemId` de un documento y la lista de ítems configurada (por ejemplo, un ítem borrado del checklist
de una obra social con documentos ya cargados contra él).

El sistema SHALL mostrar ese documento en una sección separada de los ítems del checklist, y SHALL
permitir previsualizarlo y descargarlo con el mismo criterio que cualquier otro documento (no
restringido por `readOnly`). Si el bloque tiene habilitada la reasignación, el sistema SHALL permitir
reasignar también ese documento — es la vía para corregirlo, moviéndolo a un bloque cuyo checklist sí
incluya su ítem, o al bloque general.

Ese documento MUST NOT contar para el progreso "cargados/total" del checklist: el progreso sigue
siendo por ítem vigente.

#### Scenario: Un documento transferido a una actividad sin ese ítem en su checklist sigue visible

- **GIVEN** un documento reasignado a una actividad cuyo checklist no incluye el ítem al que ese
  documento pertenece
- **WHEN** el usuario consulta la documentación de esa actividad
- **THEN** el documento sigue apareciendo, en una sección aparte de los ítems del checklist, nunca
  oculto

#### Scenario: Un documento sin ítem correspondiente se puede corregir reasignándolo

- **GIVEN** un documento visible en la sección de documentos sin ítem correspondiente de una
  actividad
- **WHEN** el usuario lo reasigna a un bloque cuyo checklist sí incluye su ítem
- **THEN** el documento pasa a figurar como un documento normal de ese ítem en el bloque destino

### Requirement: La reasignación es específica de la documentación del paciente

Los demás dominios documentales del sistema (vehículos, conductores y facturas) no agrupan su
documentación por actividad. La incorporación de la reasignación MUST NOT alterar el comportamiento ni
la interfaz de esos dominios.

#### Scenario: Los otros dominios documentales no ofrecen reasignación

- **GIVEN** la documentación de un vehículo, de un conductor o de una factura
- **WHEN** el usuario la consulta
- **THEN** se comporta exactamente igual que antes de este cambio, sin ninguna acción de reasignación
  ni ninguna noción de actividad
