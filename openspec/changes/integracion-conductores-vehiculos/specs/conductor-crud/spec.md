## REMOVED Requirements

### Requirement: Selector tipado de restricciones de perfil

**Razón**: el checkpoint de governance de este change (`tasks.md` §0.1, resuelto el 2026-07-31)
cerró el pendiente #1 de `C-09` a favor del modelo de datos real: el docx tiene un único campo
`Notas` de texto libre donde conviven las observaciones y las restricciones de perfil, y el docx
manda en estructura. El conjunto cerrado `RestriccionConductor` deja de existir en el dominio
(ver `conductor-contract`), así que no hay catálogo sobre el cual multi-seleccionar.

**Migración**: la capacidad de anotar una restricción de perfil **no se pierde**, cambia de forma —
pasa al campo libre `observaciones`, que ya existía en el mismo formulario y ahora es el único lugar
donde va. La multi-selección de checkboxes, sus etiquetas
(`features/conductores/restriccionConductorOptions.ts`) y el chip de "pendiente de confirmar con el
cliente" se eliminan de `ConductorForm.tsx`, `ConductorDetail.tsx` y `ConductoresList.tsx`. El
scenario de validación de campos obligatorios que vivía bajo este requirement **no se pierde**: se
reubica en el requirement agregado más abajo.

**Consecuencia asumida**: la restricción de carga física deja de ser un dato computable. `C-10`
(hojas de ruta) no va a poder excluir conductores automáticamente por RN-GL-03; pasa a ser lectura
humana del texto libre. Es una decisión explícita de la usuaria, no una limitación técnica: revertirla
requiere una decisión nueva, no una reinterpretación en el código.

## ADDED Requirements

### Requirement: Observaciones como único campo libre del perfil del conductor

El sistema SHALL ofrecer un único campo de texto libre —`observaciones`— para todo lo que no entra en
los campos estructurados del conductor, incluidas las restricciones de perfil (por ejemplo, que no
traslada pacientes con carga física). El formulario MUST NOT ofrecer ningún selector, checkbox ni
catálogo de restricciones, y la ficha y el listado MUST NOT mostrar restricciones como dato
estructurado aparte de las observaciones.

El sistema MUST NOT intentar inferir valores estructurados a partir del texto de `observaciones`
(parseo de palabras clave, etiquetas implícitas ni similares): es texto para que lo lea una persona.

La pantalla MUST señalizar, con el componente de aviso de modelo de datos del proyecto, que las
restricciones de perfil se anotan en Observaciones —alineado con el modelo de datos real— y que en
consecuencia no se aplican como filtro automático en el armado de hojas de ruta. El aviso MUST NOT
seguir presentando esto como una divergencia pendiente de coordinar: está resuelto.

#### Scenario: El formulario no ofrece catálogo de restricciones
- **WHEN** la administradora abre el alta o la edición de un conductor
- **THEN** no hay ningún checkbox, selector ni lista de restricciones de perfil
- **AND** el campo Observaciones es el único lugar donde puede anotar una

#### Scenario: Una restricción de perfil se registra como texto libre
- **WHEN** la administradora anota en Observaciones que el conductor no traslada pacientes con carga
  física y guarda
- **THEN** el texto se persiste tal cual vía `ConductorRepository`
- **AND** se muestra tal cual en la ficha del conductor, sin convertirse en ninguna etiqueta ni chip
  derivado

#### Scenario: El listado no muestra una columna de restricciones
- **WHEN** se muestra el listado de conductores
- **THEN** ninguna fila presenta chips ni un estado "Sin restricciones de perfil"
- **AND** el listado sigue mostrando documento, CUIL, domicilio, teléfono y estado como antes

#### Scenario: Validación de campos obligatorios
- **WHEN** se intenta guardar un conductor sin apellido, nombre o documento
- **THEN** una función pura de validación bloquea el guardado y señala los campos faltantes

#### Scenario: El aviso explica la consecuencia, no una discrepancia pendiente
- **WHEN** la administradora abre la ficha de un conductor
- **THEN** el aviso de modelo de datos indica que las restricciones se anotan en Observaciones como
  texto libre, igual que el modelo de datos real
- **AND** indica que por eso no se pueden filtrar automáticamente al armar hojas de ruta
- **AND** NO dice que la forma del campo esté pendiente de confirmar con el cliente o con backend
