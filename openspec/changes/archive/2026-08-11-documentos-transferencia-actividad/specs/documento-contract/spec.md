## ADDED Requirements

> **Nota de estado.** Depende del **Checkpoint (c)** de `design.md` (¿dónde vive la acción en la UI
> compartida?), sin veredicto (`tasks.md` §0). No depende del Checkpoint (a) —el del video—: el
> contrato de reasignación es independiente de cómo se resuelva la navegación.
>
> **Deuda detectada, no resuelta acá.** El requisito ya vigente *"El contrato `DocumentoRepository`
> pasa a tener dos implementaciones"* quedó **desactualizado** respecto del código: habla de *"las
> mismas **tres** firmas"* (hoy son cuatro, desde `documentos-previsualizacion`) y de *"la misma
> semántica de **reemplazo**"* (hoy es acumulación sin sobrescritura, desde
> `pacientes-documentos-multiples`; ese mismo requisito exige *"existe exactamente **un**
> `DocumentoAdjunto` para ese `itemId`"*, que el sistema ya no cumple ni debe cumplir). Corregirlo es
> una edición del spec principal, **no** un delta de este change, y se anota como tarea aparte en
> `tasks.md`. Este delta **no** lo toca para no arrastrar una corrección ajena dentro de un change
> CRÍTICO.

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
