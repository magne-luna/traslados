## ADDED Requirements

> **⚠️ REVISIÓN (Delfina, 2026-08-11, durante §9 verificación manual en vivo).** El veredicto de
> merge/dedup registrado originalmente en `design.md` Checkpoint (c) (tasks.md 1.4) quedó
> **revertido** probando la pantalla real: cada bloque de actividad muestra **únicamente** sus
> ítems propios del tipo — **sin sumar** los de la obra social. Los requisitos de abajo reflejan el
> comportamiento revisado; el requisito "Un ítem presente en las dos listas se muestra una sola vez"
> (dedup) se eliminó por completo — ya no hay ninguna combinación de listas que deduplicar. Ver
> `design.md` Checkpoint (c) para el detalle completo de la revisión.

### Requirement: Ítems propios del tipo de actividad, exclusivos de cada bloque

El sistema SHALL permitir configurar una lista de ítems documentales **propia de cada tipo de
actividad** (escuela, escuela especial, terapia, CET, otro), independiente del checklist de la obra
social.

Cada bloque de documentación correspondiente a una actividad del paciente SHALL mostrar
**únicamente** los ítems configurados para el tipo de esa actividad — nunca los ítems del checklist
de la obra social asignada al paciente. Las dos listas son **conjuntos separados**: el sistema MUST
NOT unirlas, fusionarlas ni deduplicarlas entre sí.

Esta lista SHALL ser configurable por el usuario a través de la interfaz. El sistema MUST NOT
derivarla de valores fijos escritos en el código.

#### Scenario: Una actividad muestra solo los ítems configurados para su tipo

- **GIVEN** un paciente cuya obra social exige un checklist de ítems, y una actividad de tipo escuela
  con ítems propios configurados para ese tipo
- **WHEN** el usuario abre la sección de documentación del paciente
- **THEN** el bloque de esa actividad muestra únicamente los ítems configurados para el tipo escuela
- **AND** ningún ítem del checklist de la obra social aparece en ese bloque

#### Scenario: Dos actividades de tipos distintos muestran listas distintas

- **GIVEN** un paciente con una actividad de tipo escuela y otra de tipo terapia, cada tipo con ítems
  propios distintos configurados
- **WHEN** el usuario abre la sección de documentación
- **THEN** el bloque de la escuela muestra los ítems propios de escuela y el bloque de la terapia los
  de terapia
- **AND** ninguno de los dos bloques muestra los ítems propios del otro tipo

#### Scenario: Dos actividades del mismo tipo muestran la misma lista de ítems

- **GIVEN** un paciente con dos actividades del mismo tipo, diferenciadas por su descripción
- **WHEN** el usuario abre la sección de documentación
- **THEN** ambos bloques muestran la misma lista de ítems
- **AND** los documentos cargados en cada uno siguen siendo independientes entre sí

### Requirement: Sin configuración por tipo de actividad, el bloque de esa actividad queda vacío

Cuando no hay ningún ítem configurado para el tipo de una actividad, el bloque de esa actividad SHALL
mostrar una lista vacía (0 de 0 ítems), sin estados de error y sin avisos de configuración faltante.
El sistema MUST NOT mostrar los ítems del checklist de la obra social como valor de reemplazo en ese
bloque.

La ausencia de configuración por tipo de actividad SHALL ser un estado válido y esperado del sistema,
no una condición a corregir. Este es un efecto colateral aceptado explícitamente por la usuaria
(2026-08-11): un tipo de actividad sin ítems propios configurados queda vacío hasta que alguien lo
configure en la pantalla de administración correspondiente.

#### Scenario: Tipo de actividad sin ítems configurados

- **GIVEN** un paciente con una actividad cuyo tipo no tiene ningún ítem propio configurado
- **WHEN** el usuario abre la sección de documentación
- **THEN** el bloque de esa actividad muestra una lista vacía
- **AND** no se muestra ningún error, aviso de configuración incompleta, ni los ítems del checklist de
  la obra social

#### Scenario: Ninguna configuración por tipo existe en el sistema

- **GIVEN** que no se configuró ningún ítem para ningún tipo de actividad
- **WHEN** el usuario abre la sección de documentación de cualquier paciente
- **THEN** todos los bloques de actividad muestran una lista vacía
- **AND** el bloque "General" sigue mostrando los ítems del checklist de la obra social, sin cambios

#### Scenario: Documentos ya cargados contra un ítem que sale de la lista del bloque no se pierden

- **GIVEN** documentos de un paciente cargados en ítems de una actividad bajo el comportamiento
  anterior a esta revisión (ítems de la obra social visibles en ese bloque)
- **WHEN** se aplica el comportamiento exclusivo y ese `itemId` ya no forma parte de la lista
  configurada para el tipo de esa actividad
- **THEN** el documento sigue existiendo y sigue asociado a su actividad
- **AND** aparece en la sección de documentos huérfanos ("Otros documentos") del checklist compartido,
  no desaparece de la vista

### Requirement: El bloque general no recibe ítems por tipo de actividad

El bloque de documentación del paciente no asociada a ninguna actividad ("General") SHALL mostrar
únicamente los ítems del checklist de la obra social asignada. El sistema MUST NOT agregarle ítems
provenientes de la configuración por tipo de actividad de ninguna de las actividades del paciente.

#### Scenario: El bloque general ignora la configuración por tipo

- **GIVEN** un paciente con actividades cuyos tipos tienen ítems propios configurados
- **WHEN** el usuario abre la sección de documentación
- **THEN** el bloque General muestra solo los ítems del checklist de la obra social
- **AND** ninguno de los ítems propios de los tipos de actividad aparece en el bloque General

### Requirement: El progreso de cada actividad se calcula sobre su propia lista

El indicador de avance de cada actividad SHALL calcularse sobre la lista de ítems configurada para su
tipo — nunca sobre los ítems del checklist de la obra social. El total agregado del paciente SHALL
sumar el total de cada bloque (General + una por actividad), incluidos los bloques cuya lista está
vacía (que aportan 0 de 0 a la suma, sin producir un total inválido ni un porcentaje indefinido).

#### Scenario: El total de una actividad refleja únicamente sus ítems propios

- **GIVEN** una actividad cuyo tipo tiene ítems propios configurados
- **WHEN** el usuario consulta el avance de esa actividad
- **THEN** el total de ítems del avance es exactamente la cantidad de ítems configurados para ese tipo
- **AND** el total agregado del paciente refleja ese mismo total, sumado al de los demás bloques

#### Scenario: Un bloque sin configurar no rompe el total agregado

- **GIVEN** un paciente con una actividad cuyo tipo no tiene ítems configurados, y otros bloques con
  ítems
- **WHEN** el usuario consulta el total agregado de documentación
- **THEN** el total agregado suma correctamente los demás bloques, sin incluir un denominador
  fantasma por el bloque vacío
- **AND** el porcentaje mostrado nunca es indefinido ni inválido por causa de ese bloque

#### Scenario: Los documentos ya cargados conservan su ítem

- **GIVEN** un paciente con documentos ya cargados en ítems de una actividad, cargados antes de que
  existiera configuración por tipo (o bajo el comportamiento de unión anterior a esta revisión)
- **WHEN** se configuran ítems propios para el tipo de esa actividad, y esa configuración ya no
  incluye el `itemId` contra el que se cargó el documento
- **THEN** los documentos ya cargados no se pierden ni se reasignan a otro ítem
- **AND** quedan visibles en la sección de documentos huérfanos del checklist compartido

### Requirement: La regla de ítems por tipo de actividad está señalizada como no confirmada

Mientras la regla de negocio "cada tipo de actividad exige documentación propia" no esté confirmada
por el cliente, el sistema SHALL mostrar en la sección de documentación del paciente un aviso visible
de discrepancia de modelo de datos que lo indique, siguiendo el mismo mecanismo usado para las demás
discrepancias señalizadas del proyecto.

El sistema MUST NOT presentar esta regla como una exigencia confirmada del negocio en la interfaz.

#### Scenario: El usuario ve que la regla no está confirmada

- **WHEN** el usuario abre la sección de documentación de un paciente
- **THEN** un aviso visible indica que la exigencia de documentación propia por tipo de actividad es
  un supuesto del equipo, todavía no confirmado con el cliente

## MODIFIED Requirements

### Requirement: Ítems filtrados por la obra social del paciente
El sistema SHALL derivar los ítems del checklist documental del paciente del checklist configurado en su obra social asignada (leído vía `ObraSocialRepository` de FE-2), respetando el orden de los ítems tal como los exige esa obra social (RN-FA-08). El sistema MUST NOT usar una lista de documentos genérica única.

El checklist de la obra social SHALL seguir siendo la **única** fuente de ítems del bloque General.
En los bloques por actividad, el checklist de la obra social NO es la base: cada bloque de actividad
muestra únicamente los ítems configurados para su tipo (ver "Ítems propios del tipo de actividad,
exclusivos de cada bloque") — **⚠️ revisado 2026-08-11**, ver la nota al inicio de "ADDED
Requirements" de este archivo.

#### Scenario: El checklist depende de la obra social asignada
- **WHEN** el paciente tiene una obra social asignada con su checklist configurado
- **THEN** la pestaña de documentación muestra los ítems de ese checklist, en el orden configurado en la obra social, en todos sus bloques

#### Scenario: Paciente sin obra social o sin checklist
- **WHEN** el paciente no tiene obra social asignada, o su obra social no tiene ítems de checklist
- **THEN** la pestaña muestra un estado vacío explícito en vez de un checklist genérico o una pantalla en blanco

#### Scenario: Estado de carga al resolver la obra social
- **WHEN** la pestaña está resolviendo la obra social y sus documentos
- **THEN** se muestra un estado de carga durante la latencia, sin pantalla en blanco ni loading infinito ante error

### Requirement: La multiplicidad por actividad se compone con la multiplicidad por ítem

El sistema SHALL mantener, **dentro de cada actividad**, todo el comportamiento documental ya especificado: los ítems que le corresponden a esa actividad (los propios de su tipo de actividad, o los del checklist de la obra social en el bloque General), la cardinalidad múltiple sin sobrescritura por ítem, la distinción del documento vigente, y la previsualización por documento puntual.

Subir un documento en un ítem de una actividad MUST NOT reemplazar ni eliminar documentos de ese mismo ítem en otra actividad, ni siquiera cuando ese ítem provenga de la configuración compartida del mismo tipo de actividad.

#### Scenario: Dos documentos del mismo ítem, en dos actividades distintas

- **GIVEN** un paciente con dos actividades, y un documento cargado para el ítem "presupuesto" en la primera
- **WHEN** el usuario carga un documento para el ítem "presupuesto" en la segunda actividad
- **THEN** ambos documentos coexisten, cada uno dentro de su propia actividad, y ninguno reemplaza al otro

#### Scenario: Varias versiones de un mismo ítem dentro de una misma actividad

- **GIVEN** un ítem del checklist de una actividad con un documento ya cargado
- **WHEN** el usuario carga un segundo documento para ese mismo ítem de esa misma actividad (por ejemplo, la renovación del período siguiente)
- **THEN** ambos quedan visibles dentro de esa actividad, con la distinción entre el vigente y el siguiente, sin afectar a ninguna otra actividad

#### Scenario: Dos actividades del mismo tipo no comparten documentos aunque compartan ítems

- **GIVEN** dos actividades del mismo tipo, que por lo tanto muestran la misma lista de ítems
- **WHEN** el usuario carga un documento en un ítem propio de ese tipo, en una de las dos
- **THEN** ese documento aparece solo en esa actividad, y el ítem correspondiente de la otra sigue figurando como no cargado

### Requirement: La separación por actividad no altera los demás dominios documentales

La documentación de Vehículos, Conductores y Facturas MUST NOT quedar dividida por actividad ni requerir un nivel de agrupación para funcionar, y MUST NOT recibir ítems provenientes de la configuración por tipo de actividad. El comportamiento observable de esas tres pantallas SHALL ser idéntico al anterior a este change.

#### Scenario: Un dominio sin actividades sigue con un único checklist

- **GIVEN** un vehículo, un conductor o una factura con su checklist documental
- **WHEN** el usuario abre su pantalla de documentación
- **THEN** se muestra un único checklist, sin bloques por actividad y sin pasos adicionales respecto del comportamiento anterior a este change

#### Scenario: La configuración por tipo de actividad no llega a los otros dominios

- **GIVEN** ítems configurados para uno o más tipos de actividad
- **WHEN** el usuario abre la documentación de un vehículo, un conductor o una factura
- **THEN** su checklist muestra exactamente los ítems que mostraba antes de que existiera esa configuración
