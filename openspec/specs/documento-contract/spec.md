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

### Requirement: El contrato incluye la reasignación de agrupación de un documento cargado

`DocumentoRepository` SHALL exponer una operación que reasigne la agrupación de un documento ya
cargado, identificándolo por su identificador propio, e indicando la agrupación de destino o su
ausencia explícita.

La operación SHALL devolver el documento con su agrupación actualizada, para que la interfaz pueda
reflejarlo sin volver a listar la entidad completa.

Toda implementación —real o mock— SHALL cumplir la misma semántica: la reasignación cambia únicamente
la agrupación. El identificador del documento, su ítem de checklist, su nombre de archivo, su fecha de
subida, su vigencia y su contenido MUST permanecer sin cambios.

La ausencia de agrupación de destino SHALL expresarse de forma explícita y significar "sin agrupación"
—el bloque general—, y MUST NOT ser indistinguible de omitir el dato por descuido.

#### Scenario: La reasignación conserva la identidad del documento

- **GIVEN** un documento cargado en una agrupación
- **WHEN** se reasigna a otra agrupación
- **THEN** el documento devuelto conserva su identificador, su ítem de checklist, su nombre de archivo
  y su fecha de subida, y solo cambia su agrupación

#### Scenario: Reasignar a "sin agrupación"

- **GIVEN** un documento cargado en una agrupación
- **WHEN** se reasigna indicando explícitamente la ausencia de agrupación de destino
- **THEN** el documento pasa a figurar entre los documentos sin agrupación de esa entidad

#### Scenario: Las dos implementaciones coinciden en la semántica de reasignación

- **GIVEN** un documento cargado, en cualquiera de las dos implementaciones
- **WHEN** se lo reasigna a otra agrupación
- **THEN** deja de figurar al listar la agrupación de origen y figura al listar la de destino, con
  idéntico resultado en ambas implementaciones

#### Scenario: Un fallo de reasignación deja el documento intacto

- **GIVEN** una reasignación que falla en la implementación real
- **WHEN** el error llega a la interfaz
- **THEN** es un `Error` con mensaje en castellano, sin texto crudo de PostgREST ni de Storage, y el
  documento sigue en su agrupación original

### Requirement: La reasignación de agrupación no altera el almacenamiento del archivo

La clave del objeto en el bucket se compone de la entidad y del ítem de checklist, y **no** contiene la
agrupación. En consecuencia, la reasignación de agrupación SHALL resolverse como un cambio de metadato
del documento, y MUST NOT copiar, mover, recrear ni eliminar el objeto almacenado.

Ninguna implementación MUST implementar la reasignación como una copia seguida de un borrado.

Si en el futuro la clave del objeto pasara a incluir la agrupación, este requisito queda invalidado y
la reasignación SHALL rediseñarse: la dependencia MUST quedar registrada junto a la construcción de la
clave.

#### Scenario: El objeto almacenado no cambia de ubicación

- **GIVEN** un documento cargado, con su objeto en el bucket
- **WHEN** se reasigna su agrupación
- **THEN** la clave del objeto en el bucket es exactamente la misma que antes de la reasignación

#### Scenario: La previsualización y la descarga siguen resolviendo al mismo archivo

- **GIVEN** un documento reasignado de una agrupación a otra
- **WHEN** se resuelve su previsualización o su descarga
- **THEN** se obtiene el mismo archivo que antes de la reasignación

### Requirement: La reasignación no afecta a los dominios documentales sin agrupaciones

De los cuatro dominios que comparten este contrato, solo la documentación del paciente usa
agrupaciones. La incorporación de la reasignación MUST NOT modificar las firmas ya existentes del
contrato, y MUST NOT alterar el comportamiento observable de los dominios de vehículos, conductores y
facturas.

El componente de checklist documental compartido SHALL exponer la acción de reasignación de forma
opcional, de modo que los puntos de montaje que no la habiliten se comporten exactamente igual que
antes de este cambio.

#### Scenario: Las firmas existentes no cambian

- **GIVEN** el contrato `DocumentoRepository` después de este cambio
- **WHEN** se comparan sus operaciones ya existentes con las anteriores
- **THEN** ninguna cambió de firma, de orden de parámetros ni de semántica

#### Scenario: Los otros tres dominios no muestran la acción

- **GIVEN** la documentación de un vehículo, de un conductor o de una factura
- **WHEN** se la consulta
- **THEN** no aparece ninguna acción de reasignación, y el resto de la interfaz es idéntico al de antes
  de este cambio
