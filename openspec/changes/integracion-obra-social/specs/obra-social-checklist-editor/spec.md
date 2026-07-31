## MODIFIED Requirements

### Requirement: Reordenamiento de ítems del checklist
El sistema SHALL permitir reordenar los ítems del checklist mediante drag-and-drop, y el orden
resultante MUST preservarse tal como cada obra social lo exige (RN-FA-08). El orden SHALL persistirse
en una **columna explícita** del registro de vínculo, no como posición implícita en un array ni como
orden físico de las filas devueltas por la base. La lectura MUST ordenar por esa columna con un
desempate determinista.

#### Scenario: Reordenar por arrastre
- **WHEN** el usuario arrastra un ítem a otra posición
- **THEN** el checklist se reordena y el nuevo orden se persiste con la obra social

#### Scenario: El orden persiste entre sesiones
- **WHEN** se reordena el checklist y luego se recarga la obra social
- **THEN** los ítems se muestran en el orden guardado

#### Scenario: El orden sobrevive al viaje al servidor
- **GIVEN** un checklist guardado contra la base real
- **WHEN** se vuelve a leer en otra sesión y desde otra cuenta
- **THEN** los ítems vuelven en el mismo orden
- **AND** el orden NO depende del orden físico en que Postgres devuelva las filas

#### Scenario: Un reordenamiento parcial no puede quedar persistido
- **GIVEN** un reordenamiento que reescribe varias filas de vínculo
- **WHEN** cualquiera de esas escrituras falla
- **THEN** la transacción hace rollback completo y el checklist queda con el orden anterior
- **AND** NO queda un orden a medio aplicar

## ADDED Requirements

### Requirement: El nombre de un ítem se resuelve contra un catálogo compartido
El sistema SHALL resolver el nombre de cada ítem del checklist contra el catálogo compartido de tipos
de documento (`obra_social.tipos_documento`), reutilizando la entrada existente si el nombre ya está
—comparación con espacios recortados e insensible a mayúsculas— y creándola dentro de la misma
transacción si no. Dado que ese catálogo también es referenciado por los documentos de paciente con
`ON DELETE RESTRICT`, el sistema SHALL advertir al usuario, con `AvisoModeloDatos`, que el nombre que
escribe se guarda en un catálogo compartido. El sistema MUST NOT crear entradas duplicadas del
catálogo por diferencias de mayúsculas o espacios.

#### Scenario: Un nombre ya existente reutiliza la entrada del catálogo
- **GIVEN** que "CBU" ya existe en el catálogo de tipos de documento
- **WHEN** el usuario agrega un ítem llamado " cbu " a otra obra social
- **THEN** se reutiliza la entrada existente
- **AND** NO se crea una segunda entrada en el catálogo

#### Scenario: El editor advierte sobre el catálogo compartido
- **WHEN** el usuario abre el editor de checklist
- **THEN** hay un `AvisoModeloDatos` visible que explica que el nombre del ítem se guarda en un
  catálogo de tipos de documento compartido con Pacientes
- **AND** el aviso usa el componente del design system, sin estilos inline

#### Scenario: Un ítem sin nombre bloquea el guardado con un mensaje claro
- **WHEN** el usuario intenta guardar un checklist con un ítem de nombre vacío
- **THEN** el guardado se rechaza con un mensaje que indica que todos los ítems necesitan un nombre
- **AND** ninguna fila queda escrita

#### Scenario: Quitar un ítem usado por documentos de paciente se explica
- **GIVEN** un tipo de documento ya referenciado por documentos de pacientes
- **WHEN** una operación intentaría eliminarlo del catálogo
- **THEN** la base lo rechaza y el usuario ve un mensaje que explica que hay documentos de pacientes
  que lo usan
- **AND** el mensaje no expone nombres de tablas ni códigos de Postgres

### Requirement: La obligatoriedad de cada ítem se persiste por obra social
El sistema SHALL persistir el flag `requerido` de cada ítem en el registro de vínculo de esa obra
social, no en el catálogo compartido, de modo que el mismo tipo de documento pueda ser obligatorio
para una obra social y opcional para otra (RF-305, RN-FA-08). El valor por defecto de un ítem nuevo
SHALL ser "requerido".

#### Scenario: El mismo documento es obligatorio para una obra social y opcional para otra
- **GIVEN** dos obras sociales que exigen "Presupuesto"
- **WHEN** una lo marca obligatorio y la otra opcional
- **THEN** cada una conserva su propio valor al releer
- **AND** el catálogo compartido no guarda ninguna obligatoriedad

#### Scenario: Un ítem nuevo nace requerido
- **WHEN** el usuario agrega un ítem sin tocar el flag
- **THEN** queda marcado como requerido
- **AND** puede alternarse a opcional sin afectar a otras obras sociales
