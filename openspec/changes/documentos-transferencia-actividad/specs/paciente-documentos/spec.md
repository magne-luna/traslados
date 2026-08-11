## ADDED Requirements

> **Nota de estado.** Estos requisitos dependen del **Checkpoint (a)** de `design.md` — el checkpoint
> del **video pendiente de la clienta**, sin veredicto (`tasks.md` §0). Están redactados sobre el
> default elegido (opción A: acción explícita por actividad que enfoca su bloque, conservando los N
> bloques simultáneos). Si el video muestra un modelo de "una actividad por vez", estos requisitos se
> reescriben **y** el requisito ya vigente *"Checklist documental instanciado por actividad del
> paciente"* pasa a MODIFIED. Se redactaron deliberadamente como **aditivos** para que ese escenario
> no obligue a revertir nada de lo ya aprobado por la clienta.

### Requirement: Navegación dirigida desde una actividad hacia su documentación

El sistema SHALL ofrecer, para cada actividad registrada del paciente, una forma explícita de llegar a
su bloque de documentación desde el lugar donde esa actividad se lista.

Al usarla, el sistema SHALL dejar el bloque documental de **esa** actividad visible, expandido y
enfocado, sin que el usuario tenga que buscarlo entre los demás bloques.

La correspondencia entre la actividad elegida y el bloque al que se llega MUST ser exacta, incluso
cuando el paciente tiene varias actividades del mismo tipo.

#### Scenario: Ir a la documentación de una actividad puntual

- **GIVEN** un paciente con varias actividades registradas, cuya documentación está más abajo en la
  pantalla
- **WHEN** el usuario usa la acción de ver la documentación de una de esas actividades
- **THEN** el bloque documental de esa actividad queda visible y expandido, y la vista se desplaza
  hasta él

#### Scenario: Dos actividades del mismo tipo llevan a bloques distintos

- **GIVEN** un paciente con dos terapias distintas, diferenciadas por su descripción
- **WHEN** el usuario pide ver la documentación de la segunda
- **THEN** llega al bloque de la segunda, no al de la primera

#### Scenario: Un bloque colapsado se expande al navegar hacia él

- **GIVEN** una actividad cuyo bloque documental está colapsado por tener el checklist completo
- **WHEN** el usuario pide ver la documentación de esa actividad
- **THEN** el bloque se expande y queda visible

### Requirement: La navegación dirigida no altera el modelo de bloques simultáneos

Llegar a la documentación de una actividad MUST NOT ocultar, colapsar ni filtrar los bloques de las
demás actividades. El paciente SHALL seguir mostrando un bloque documental por actividad, más el
bloque general, simultáneamente.

El auto-colapso inicial de los bloques ya completos SHALL seguir vigente y SHALL seguir decidiéndose
una sola vez: si el usuario abre un bloque —a mano o mediante la navegación dirigida—, el sistema MUST
NOT volver a cerrarlo por su cuenta.

#### Scenario: Los demás bloques siguen presentes

- **GIVEN** un paciente con tres actividades
- **WHEN** el usuario navega a la documentación de una de ellas
- **THEN** los bloques de las otras dos siguen presentes en la pantalla, en el mismo estado en que
  estaban

#### Scenario: Un bloque abierto por navegación no se vuelve a cerrar solo

- **GIVEN** un bloque completo que se abrió mediante la navegación dirigida
- **WHEN** cambia el progreso documental de cualquier bloque de la pantalla
- **THEN** el bloque abierto permanece abierto

### Requirement: La navegación dirigida es utilizable sin ver la pantalla

Con varios bloques documentales estructuralmente idénticos en la misma pantalla, un desplazamiento
visual no comunica nada a quien navega por teclado o con lector de pantalla. El sistema SHALL, además
de desplazar la vista, mover el foco al bloque de destino, de modo que su identificación sea anunciada
y la navegación por teclado continúe desde ahí.

El desplazamiento animado SHALL respetar la preferencia del sistema de movimiento reducido.

#### Scenario: El foco acompaña a la navegación

- **GIVEN** un usuario navegando por teclado
- **WHEN** activa la acción de ver la documentación de una actividad
- **THEN** el foco queda dentro del bloque de esa actividad, y la siguiente pulsación de tabulación
  continúa desde ahí

#### Scenario: Movimiento reducido

- **GIVEN** un usuario con la preferencia de movimiento reducido activada
- **WHEN** navega a la documentación de una actividad
- **THEN** llega al bloque correspondiente sin desplazamiento animado

### Requirement: La documentación de una actividad se puede exportar desde su propio bloque

Cada bloque documental de actividad SHALL ofrecer la exportación de **su** documentación, acotada a esa
actividad, sin abarcar las demás.

El comportamiento y el contenido de esa exportación se especifican en la capacidad
`paciente-documentos-exportacion`.

#### Scenario: Exportar desde el bloque de una actividad

- **GIVEN** un paciente con varias actividades documentadas
- **WHEN** el usuario usa la acción de exportar del bloque de una de ellas
- **THEN** obtiene la exportación de esa actividad, y no de las demás

### Requirement: Un documento cargado se puede reasignar desde su propio bloque

Cada documento cargado SHALL ofrecer, dentro del bloque documental donde figura, la acción de
reasignarlo a otra actividad del mismo paciente o al bloque general.

El comportamiento de esa reasignación se especifica en la capacidad
`paciente-documentos-transferencia`.

#### Scenario: Reasignar desde el listado de documentos de un ítem

- **GIVEN** un ítem del checklist de una actividad con un documento cargado
- **WHEN** el usuario usa la acción de reasignar de ese documento
- **THEN** puede elegir a qué otra actividad del paciente —o al bloque general— moverlo

### Requirement: El estado provisorio de este flujo es visible en la pantalla

Mientras el flujo pedido por la clienta no esté confirmado —el requerimiento de origen quedó
explícitamente abierto a la espera de un video que la clienta enviaría—, la pantalla de documentación
del paciente SHALL exhibir un aviso visible que declare que la vinculación entre actividad y
documentación está implementada según la lectura literal del requerimiento y puede cambiar.

El aviso MUST distinguirse de los avisos de discrepancia con el modelo de datos: acá no hay divergencia
con el modelo, hay un requerimiento incompleto pendiente de confirmación del cliente.

#### Scenario: El aviso está visible mientras el checkpoint sigue abierto

- **GIVEN** que el video de la clienta no llegó y el flujo sigue sin confirmarse
- **WHEN** un usuario abre la sección de documentación de un paciente
- **THEN** ve un aviso que indica que este flujo es provisorio y está pendiente de confirmación de la
  clienta
