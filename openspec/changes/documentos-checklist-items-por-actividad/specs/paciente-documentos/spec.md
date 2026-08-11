## ADDED Requirements

### Requirement: Ítems propios del tipo de actividad, sumados a los de la obra social

El sistema SHALL permitir configurar una lista de ítems documentales **propia de cada tipo de
actividad** (escuela, escuela especial, terapia, CET, otro), independiente del checklist de la obra
social.

Cada bloque de documentación correspondiente a una actividad del paciente SHALL mostrar la **unión**
de dos listas: los ítems del checklist de la obra social asignada al paciente, y los ítems
configurados para el tipo de esa actividad. La relación entre ambas listas es **aditiva y
complementaria**: los ítems del tipo de actividad MUST NOT reemplazar, ocultar ni reordenar los ítems
de la obra social.

El orden de los ítems provenientes de la obra social SHALL preservarse tal como esa obra social los
exige (RN-FA-08); los ítems propios del tipo de actividad se presentan a continuación.

Esta lista SHALL ser configurable por el usuario a través de la interfaz. El sistema MUST NOT
derivarla de valores fijos escritos en el código.

#### Scenario: Una actividad muestra los ítems de su obra social más los de su tipo

- **GIVEN** un paciente cuya obra social exige un checklist de ítems, y una actividad de tipo escuela
  con ítems propios configurados para ese tipo
- **WHEN** el usuario abre la sección de documentación del paciente
- **THEN** el bloque de esa actividad muestra los ítems de la obra social **y además** los ítems
  configurados para el tipo escuela, en una sola lista
- **AND** ningún ítem de la obra social desaparece ni cambia de posición relativa respecto de los demás
  ítems de la obra social

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

### Requirement: Sin configuración por tipo de actividad, el comportamiento no cambia

Cuando no hay ningún ítem configurado para el tipo de una actividad, el bloque de esa actividad SHALL
mostrar exactamente los ítems del checklist de la obra social asignada al paciente, en su orden, sin
ítems adicionales, sin estados de error y sin avisos de configuración faltante.

La ausencia de configuración por tipo de actividad SHALL ser un estado válido y esperado del sistema,
no una condición a corregir.

#### Scenario: Tipo de actividad sin ítems configurados

- **GIVEN** un paciente con una actividad cuyo tipo no tiene ningún ítem propio configurado
- **WHEN** el usuario abre la sección de documentación
- **THEN** el bloque de esa actividad muestra únicamente los ítems del checklist de la obra social, en
  el orden configurado en ella
- **AND** no se muestra ningún error ni aviso de configuración incompleta

#### Scenario: Ninguna configuración por tipo existe en el sistema

- **GIVEN** que no se configuró ningún ítem para ningún tipo de actividad
- **WHEN** el usuario abre la sección de documentación de cualquier paciente
- **THEN** todos los bloques muestran las mismas listas que mostraban antes de este change

### Requirement: El bloque general no recibe ítems por tipo de actividad

El bloque de documentación del paciente no asociada a ninguna actividad ("General") SHALL mostrar
únicamente los ítems del checklist de la obra social asignada. El sistema MUST NOT agregarle ítems
provenientes de la configuración por tipo de actividad de ninguna de las actividades del paciente.

#### Scenario: El bloque general ignora la configuración por tipo

- **GIVEN** un paciente con actividades cuyos tipos tienen ítems propios configurados
- **WHEN** el usuario abre la sección de documentación
- **THEN** el bloque General muestra solo los ítems del checklist de la obra social
- **AND** ninguno de los ítems propios de los tipos de actividad aparece en el bloque General

### Requirement: Un ítem presente en las dos listas se muestra una sola vez

Cuando un mismo ítem documental está configurado tanto en el checklist de la obra social como en la
lista propia del tipo de una actividad, el bloque de esa actividad SHALL mostrarlo **una sola vez**.
El sistema MUST NOT presentar dos filas que representen el mismo ítem dentro de un mismo bloque.

Si las dos listas difieren en si ese ítem es requerido, el sistema SHALL aplicar el criterio más
estricto: el ítem se considera requerido si cualquiera de las dos listas lo exige. El sistema MUST NOT
relajar una exigencia documental como efecto colateral de combinar listas.

#### Scenario: Ítem coincidente entre obra social y tipo de actividad

- **GIVEN** un ítem documental configurado a la vez en el checklist de la obra social del paciente y
  en la lista propia del tipo de una de sus actividades
- **WHEN** el usuario abre el bloque de esa actividad
- **THEN** ese ítem aparece una única vez en la lista

#### Scenario: Exigencia en conflicto entre las dos listas

- **GIVEN** un ítem que la obra social no marca como requerido y el tipo de actividad sí
- **WHEN** se muestra el bloque de esa actividad
- **THEN** el ítem figura como requerido

### Requirement: El progreso de cada actividad se calcula sobre su lista combinada

El indicador de avance de cada actividad SHALL calcularse sobre la lista de ítems efectivamente
mostrada en ese bloque, incluyendo los ítems propios de su tipo de actividad. El total agregado del
paciente SHALL reflejar esos mismos totales por bloque.

El sistema MUST NOT contar dos veces un ítem que esté presente en las dos listas de origen.

#### Scenario: El total de una actividad incluye sus ítems por tipo

- **GIVEN** una actividad cuyo tipo agrega ítems propios a los de la obra social
- **WHEN** el usuario consulta el avance de esa actividad
- **THEN** el total de ítems del avance incluye los ítems propios del tipo
- **AND** el total agregado del paciente refleja ese mismo total

#### Scenario: Los documentos ya cargados conservan su ítem

- **GIVEN** un paciente con documentos ya cargados en ítems de una actividad, cargados antes de que
  existiera configuración por tipo
- **WHEN** se configuran ítems propios para el tipo de esa actividad
- **THEN** los documentos ya cargados siguen apareciendo en el mismo ítem en el que se cargaron
- **AND** ninguno se pierde ni se reasigna a otro ítem

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

El checklist de la obra social SHALL seguir siendo la **única** fuente de ítems del bloque General, y
la **base** de la lista de cada bloque por actividad. En los bloques por actividad esa base puede
ampliarse con los ítems propios del tipo de esa actividad (ver "Ítems propios del tipo de actividad,
sumados a los de la obra social"), sin que ningún ítem de la obra social se pierda, se reemplace ni
cambie de orden relativo.

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

El sistema SHALL mantener, **dentro de cada actividad**, todo el comportamiento documental ya especificado: los ítems que le corresponden a esa actividad (los del checklist de la obra social asignada, ampliados con los propios de su tipo de actividad), la cardinalidad múltiple sin sobrescritura por ítem, la distinción del documento vigente, y la previsualización por documento puntual.

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
