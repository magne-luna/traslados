## ADDED Requirements

### Requirement: Pantalla propia de administración de ítems por tipo de actividad

El sistema SHALL ofrecer una pantalla propia — independiente de la ficha de cualquier obra social
puntual — para administrar la lista de ítems documentales requeridos por cada tipo de actividad
(escuela, escuela especial, terapia, CET, otro). La configuración SHALL ser **global por tipo**: no
existe una lista por combinación de obra social y tipo (`design.md` Checkpoint (e), veredicto A).

La pantalla SHALL reusar los componentes ya existentes de edición de checklist
(`ChecklistEditor`/`ChecklistItemRow`) y el design system (`Card`, `SectionBadge`, `Button`, `Input`).
El sistema MUST NOT introducir markup ad-hoc ni estilos inline para esta pantalla.

#### Scenario: El usuario administra la lista de un tipo de actividad

- **GIVEN** un usuario con permiso de escritura sobre el módulo `obra_social`
- **WHEN** abre la pantalla de administración de documentación por tipo de actividad y selecciona un
  tipo (por ejemplo, escuela)
- **THEN** puede agregar, quitar, marcar como requerido y reordenar los ítems de esa lista

#### Scenario: La configuración es independiente entre tipos de actividad

- **GIVEN** ítems configurados para el tipo escuela
- **WHEN** el usuario abre la lista del tipo terapia
- **THEN** ve una lista distinta, sin los ítems de escuela

### Requirement: Acceso gateado por el módulo `obra_social`

El acceso de lectura y escritura a esta pantalla SHALL estar gateado por el mismo módulo del backend
que gatea el checklist por obra social (`obra_social`, `design.md` Checkpoint (a), sub-pregunta de
schema — veredicto: `obra_social`). Un usuario sin permiso de lectura sobre ese módulo MUST NOT poder
ver la pantalla ni alcanzarla por URL directa; sin permiso de escritura, la pantalla SHALL mostrarse
en modo solo lectura.

La autorización efectiva SHALL exigirse también del lado del servidor, vía Row Level Security sobre la
tabla que persiste esta configuración — el gateo de la interfaz es una conveniencia de UX, nunca la
única frontera de seguridad.

#### Scenario: Un usuario sin permiso de lectura no accede a la pantalla

- **GIVEN** un usuario sin permiso de lectura sobre el módulo `obra_social`
- **WHEN** intenta abrir la pantalla de administración por tipo de actividad, incluso por URL directa
- **THEN** el sistema le deniega el acceso

#### Scenario: Un usuario con solo lectura ve la configuración sin poder editarla

- **GIVEN** un usuario con permiso de lectura pero no de escritura sobre el módulo `obra_social`
- **WHEN** abre la pantalla
- **THEN** ve la lista de ítems de cada tipo de actividad
- **AND** los controles de alta, baja, reordenamiento y marcado de requerido están deshabilitados

#### Scenario: La RLS rechaza la escritura del lado del servidor

- **GIVEN** un usuario sin permiso de escritura sobre el módulo `obra_social`
- **WHEN** se intenta escribir contra la tabla de configuración directamente, sin pasar por la UI
- **THEN** la escritura es rechazada por la Row Level Security del servidor

### Requirement: El nombre de cada ítem se resuelve contra el catálogo compartido

El sistema SHALL resolver el nombre de cada ítem configurado por tipo de actividad contra el mismo
catálogo compartido de tipos de documento (`obra_social.tipos_documento`) que usa el checklist por
obra social — reutilizando la entrada existente si el nombre ya está (comparación normalizada,
espacios recortados e insensible a mayúsculas), y creándola solo mediante el camino de get-or-create ya
establecido, nunca con un `INSERT` paralelo desde el frontend (`design.md` D5). El sistema SHALL
advertir esto en pantalla con `AvisoModeloDatos`, siguiendo el mismo criterio que ya usa
`ChecklistEditor.tsx` para el checklist por obra social.

#### Scenario: Un nombre ya existente en el catálogo se reutiliza

- **GIVEN** que "Autorización" ya existe en el catálogo de tipos de documento (por ejemplo, cargado
  desde el checklist de una obra social)
- **WHEN** el usuario agrega un ítem llamado "autorización" a un tipo de actividad
- **THEN** se reutiliza la entrada existente del catálogo
- **AND** NO se crea una segunda entrada

#### Scenario: La pantalla advierte sobre el catálogo compartido

- **WHEN** el usuario abre la pantalla de administración por tipo de actividad
- **THEN** hay un `AvisoModeloDatos` visible que explica que el nombre de cada ítem se guarda en un
  catálogo de tipos de documento compartido con Pacientes y Facturación
