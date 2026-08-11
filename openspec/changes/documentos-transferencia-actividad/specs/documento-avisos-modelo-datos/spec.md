## ADDED Requirements

### Requirement: Los requerimientos incompletos del cliente se declaran en pantalla, distinguidos de las discrepancias de modelo

El sistema ya declara en pantalla las **discrepancias con el modelo de datos real**. Este requisito
cubre un caso distinto y hasta ahora no especificado: un **requerimiento del cliente que quedó
incompleto** y sobre el cual se implementó un default provisorio.

Cuando una funcionalidad se construye sobre una lectura no confirmada de un requerimiento —porque el
cliente dejó el punto explícitamente abierto—, la pantalla donde esa funcionalidad vive SHALL exhibir
un aviso que lo declare, indicando qué se asumió y que puede cambiar.

Ese aviso MUST distinguirse visual y textualmente del aviso de discrepancia con el modelo de datos: no
son la misma clase de problema. Una discrepancia es una divergencia entre dos fuentes de verdad
existentes; un requerimiento incompleto es la ausencia de una de ellas.

El aviso SHALL retirarse cuando el requerimiento quede confirmado y la implementación se ajuste a la
confirmación.

#### Scenario: La vinculación entre actividad y documentación se declara provisoria

- **GIVEN** que el flujo de vinculación, exportación y transferencia de la documentación por actividad
  se implementó sobre la lectura literal del requerimiento, a la espera de un video que la clienta
  enviaría para precisarlo
- **WHEN** un usuario abre la sección de documentación de un paciente
- **THEN** ve un aviso que declara que ese flujo es provisorio y está pendiente de confirmación de la
  clienta

#### Scenario: El aviso no se confunde con una discrepancia de modelo

- **GIVEN** una pantalla que exhibe a la vez un aviso de discrepancia con el modelo de datos y un aviso
  de requerimiento pendiente de confirmación
- **WHEN** el usuario los lee
- **THEN** puede distinguir cuál es cuál sin ambigüedad

#### Scenario: El aviso desaparece al confirmarse el requerimiento

- **GIVEN** un aviso de requerimiento provisorio en pantalla
- **WHEN** el cliente confirma el flujo y la implementación se ajusta a esa confirmación
- **THEN** el aviso se retira de la pantalla

### Requirement: Un requerimiento incompleto se documenta por triplicado, igual que una discrepancia

Todo requerimiento del cliente que quede incompleto y se resuelva con un default provisorio SHALL
documentarse en los mismos tres lugares que ya exige una discrepancia: `knowledge-base/` en su sección
de discrepancias o preguntas abiertas, el bullet correspondiente del change en `CHANGES.md`, y el aviso
en la pantalla donde aplica.

El registro SHALL incluir qué se asumió, por qué se eligió ese default, y qué evidencia se está
esperando para cerrarlo. MUST NOT resolverse unilateralmente en el código sin dejar registro.

El checkpoint documentado por este change es: **el flujo de vinculación de la actividad seleccionada
con su documentación, su exportación y la transferencia de documentos entre actividades**, cuya
descripción de origen se cierra con la indicación de que el cliente enviaría un video mostrando el
flujo, y de que el punto puede refinarse cuando llegue. El video no llegó al momento de proponer este
change.

#### Scenario: El checkpoint del video queda en los tres lugares

- **GIVEN** el checkpoint abierto del flujo de vinculación y transferencia
- **WHEN** el change se completa
- **THEN** figura en `knowledge-base/`, en el bullet de `CHANGES.md` y como aviso en la pantalla de
  documentación del paciente

#### Scenario: El registro dice qué se asumió y qué se espera

- **GIVEN** el registro del checkpoint en la base de conocimiento
- **WHEN** alguien lo lee sin conocer la conversación original
- **THEN** entiende cuál fue la lectura elegida, por qué se la eligió por sobre las alternativas, y qué
  hace falta para cerrar el punto
