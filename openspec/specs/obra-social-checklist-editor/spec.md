## Requirements

### Requirement: Edición del checklist documental por obra social
El sistema SHALL permitir configurar, por obra social, la lista de ítems de documentación requerida: agregar ítem, quitar ítem, renombrar ítem y marcar cada ítem como requerido u opcional (US-300, RF-305, RN-FA-08). Los cambios MUST persistirse en la obra social vía `ObraSocialRepository.update()`.

#### Scenario: Agregar un ítem al checklist
- **WHEN** el usuario agrega un ítem con nombre a una obra social
- **THEN** el ítem se incorpora al final del checklist y queda editable

#### Scenario: Marcar un ítem como opcional
- **WHEN** el usuario alterna el flag requerido de un ítem
- **THEN** el ítem refleja el nuevo estado (requerido/opcional) al guardar

### Requirement: Reordenamiento de ítems del checklist
El sistema SHALL permitir reordenar los ítems del checklist mediante drag-and-drop, y el orden resultante MUST preservarse tal como cada obra social lo exige (RN-FA-08).

#### Scenario: Reordenar por arrastre
- **WHEN** el usuario arrastra un ítem a otra posición
- **THEN** el checklist se reordena y el nuevo orden se persiste con la obra social

#### Scenario: El orden persiste entre sesiones
- **WHEN** se reordena el checklist y luego se recarga la obra social
- **THEN** los ítems se muestran en el orden guardado

### Requirement: OSECAC precargado, resto vacío
El sistema SHALL precargar únicamente el checklist de OSECAC (RF-305) como fixture; cualquier otra obra social nueva MUST comenzar con checklist vacío y editable, sin heredar un checklist genérico.

#### Scenario: Obra social nueva sin checklist heredado
- **WHEN** el usuario crea una obra social distinta de OSECAC
- **THEN** su editor de checklist se muestra vacío, listo para configurarse desde cero

### Requirement: Reutilización del renderer de FE-1
El sistema SHALL reutilizar el tipo `ChecklistItem` y el componente/renderer de checklist configurable introducido en FE-1 (`frontend/src/shared/components/DocumentChecklist.tsx`) para la vista del checklist, sin duplicar su modelo de datos.

#### Scenario: Modelo de checklist compartido
- **WHEN** se define el checklist de una obra social
- **THEN** se usa el tipo `ChecklistItem` existente y no se crea un tipo paralelo con la misma forma
