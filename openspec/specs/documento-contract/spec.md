# Documento Contract

## Purpose

Define el contrato normativo de `DocumentoRepository` una vez que deja de tener una única
implementación (`mockDocumentoRepository`). A partir de `integracion-documentos`, toda
implementación real o mock SHALL cumplir la misma forma, la misma semántica de reemplazo, la misma
idempotencia de `remove` y el mismo contrato de error — y ni la interfaz ni el contrato de UI del
checklist documental compartido cambian por tener una segunda implementación.

---

## Requirements

### Requirement: El contrato `DocumentoRepository` pasa a tener dos implementaciones

Hasta `integracion-documentos`, `DocumentoRepository` tenía **una sola** implementación
(`mockDocumentoRepository`, en memoria), y su comportamiento *era* el contrato. A partir de acá hay
dos, y el contrato pasa a ser **normativo**: toda implementación de `DocumentoRepository` SHALL
cumplir las mismas tres firmas, la misma semántica de reemplazo, la misma idempotencia de `remove` y
la misma forma de error.

La interfaz `frontend/src/shared/lib/documentos/DocumentoRepository.ts` y los tipos de
`frontend/src/shared/types/documento.ts` MUST NOT modificarse por el agregado de una segunda
implementación: es un reemplazo de la capa de datos, no un cambio de contrato.

#### Scenario: El mock sigue existiendo y sigue siendo válido
- **GIVEN** `mockDocumentoRepository`
- **WHEN** `integracion-documentos` se completa
- **THEN** el mock no fue eliminado ni modificado
- **AND** sigue inyectado en 4 de los 5 composition roots
- **AND** sigue siendo el doble usado por los tests de feature que lo requieren

#### Scenario: Las dos implementaciones coinciden en la semántica de reemplazo
- **GIVEN** un ítem del checklist que ya tiene un documento cargado
- **WHEN** se invoca `upload` con un archivo nuevo, en cualquiera de las dos implementaciones
- **THEN** al terminar existe exactamente **un** `DocumentoAdjunto` para ese `itemId`
- **AND** es el nuevo, no el anterior

#### Scenario: Las dos implementaciones coinciden en la idempotencia de remove
- **GIVEN** un `itemId` sin documento cargado
- **WHEN** se invoca `remove` en cualquiera de las dos implementaciones
- **THEN** la promesa resuelve sin error

#### Scenario: El contrato de error es uniforme
- **GIVEN** cualquier fallo de la implementación real
- **WHEN** llega a la UI
- **THEN** es un `Error` con mensaje en castellano
- **AND** nunca contiene el texto crudo de PostgREST ni de Storage

### Requirement: El contrato de UI del checklist documental no cambia

`DocumentChecklist.tsx`, `useDocumentChecklist.ts` y los cuatro wrappers de feature
(`PacienteDocumentosChecklist`, `VehiculoDocumentos`, `ConductorDocumentos`, `FacturaDocumentos`)
MUST conservar sus firmas y su forma. El único cambio admitido en los wrappers por
`integracion-documentos` es el agregado de un `AvisoModeloDatos` (ver capability
`documento-avisos-modelo-datos`).

El gateo de escritura por permiso (`readOnly={!puedeEscribir}`) SHALL conservarse tal como está: la
**consulta** del checklist sigue disponible con solo `read`, porque el gateo del cliente nunca debe
ser más restrictivo que la RLS del servidor.

#### Scenario: Ningún componente compartido cambia de forma
- **GIVEN** el diff completo de `integracion-documentos`
- **WHEN** se revisa
- **THEN** `DocumentChecklist.tsx`, `useDocumentChecklist.ts`, `DocumentoRepository.ts` y
  `shared/types/documento.ts` no aparecen modificados

#### Scenario: Una cuenta con solo lectura sigue viendo el checklist
- **GIVEN** una cuenta con `pacientes: read` y sin `write`
- **WHEN** abre la ficha de un paciente con documentos cargados
- **THEN** ve la lista de documentos y su estado de completitud
- **AND** Subir / Reemplazar / Quitar están deshabilitados

### Requirement: `archivo_url` almacena la clave del bucket, no una URL

Toda implementación real SHALL persistir en `archivo_url` la **clave del objeto dentro de su bucket**
(`{entidadId}/{itemId}/{uuid}-{nombreSeguro}`), nunca una URL pública ni una URL firmada. El bucket
se resuelve desde `CONFIG_ENTIDAD`, no desde la columna.

Esta es una **discrepancia de nombre conocida** contra el schema real (`C-03`) y contra
`docs/core/Traslados-Modelo-Datos.docx`: SHALL documentarse en
`knowledge-base/04_modelo_de_datos.md` §Discrepancias y con `COMMENT ON COLUMN` en la migración, y
MUST NOT resolverse unilateralmente renombrando la columna.

#### Scenario: Nunca se persiste una URL
- **GIVEN** cualquier `upload` exitoso
- **WHEN** se inspecciona la fila insertada
- **THEN** `archivo_url` no contiene `http://` ni `https://`
- **AND** su valor es una clave relativa dentro del bucket

#### Scenario: Los buckets siguen siendo privados
- **GIVEN** los 4 buckets de documentos
- **WHEN** `integracion-documentos` se completa
- **THEN** los 4 siguen con `public = false`
- **AND** el change no generó ninguna URL pública ni firmada
