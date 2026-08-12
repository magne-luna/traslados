# Documento Avisos Modelo de Datos

## Purpose

Define los carteles `AvisoModeloDatos` que señalizan, en las pantallas de documentos, el alcance
real del swap parcial de `integracion-documentos` (solo Pacientes conectado a Storage/Postgres
reales) y la corrección de un aviso desactualizado en Facturación. Cubre también la obligación de
documentar por triplicado toda discrepancia nueva descubierta por el change (código, knowledge-base,
`CHANGES.md`), regla dura ya establecida en `CLAUDE.md`.

---

## Requirements

### Requirement: Las tres entidades que siguen simulando el upload lo dicen en pantalla

El sistema SHALL mostrar un `AvisoModeloDatos` (componente ya existente en
`frontend/src/design-system/components.tsx`) en las pantallas de documentos de **Vehículos**,
**Conductores** y **Facturación**, indicando que la subida de archivos **sigue siendo simulada** —
el archivo elegido no se guarda en ningún lado y desaparece al recargar— y por qué: la entidad dueña
todavía se sirve de un repository mock, así que su `entidadId` no existe en la base y la FK lo
rechazaría (`integracion-documentos/design.md` Checkpoint 0).

El aviso MUST usar el componente del design system, sin markup nuevo y sin `style={{}}` (regla dura
del proyecto). Es una limitación **transitoria y documentada**, no comportamiento final: cuando
`integracion-conductores-vehiculos` e `integracion-facturacion` aterricen, el aviso se retira junto
con el swap de una línea en cada composition root.

#### Scenario: Vehículos avisa que el upload es simulado
- **GIVEN** la pestaña de documentos de un vehículo
- **WHEN** se renderiza
- **THEN** muestra un `AvisoModeloDatos` explicando que la subida es simulada mientras Vehículos siga
  en mock

#### Scenario: Conductores complementa su aviso existente, no lo duplica
- **GIVEN** `ConductorDocumentos.tsx`, que ya muestra un `Chip kind="warning"` sobre qué documentos
  precargar
- **WHEN** se agrega el aviso de upload simulado
- **THEN** los dos coexisten
- **AND** ninguno repite el texto del otro (dicen cosas distintas: qué documentos van vs. si se
  guardan de verdad)

#### Scenario: Pacientes NO muestra el aviso
- **GIVEN** la pestaña de documentos de un paciente, ya cableada al repository real
- **WHEN** se renderiza
- **THEN** no muestra ningún `AvisoModeloDatos` sobre upload simulado

### Requirement: El aviso desactualizado de Facturación se corrige

`FacturaDocumentos.tsx` mostraba, antes de `integracion-documentos`, un `AvisoModeloDatos` que decía
*"El docx no modela ninguna tabla de documentos por Factura (Discrepancia 2). El backend `C-07` debe
crear `documento_factura`"*. **Esa tabla ya existe**: la creó `C-03`
(`20260729100000_schema_documento_factura.sql`) y está verificada en vivo, con RLS y trigger de
auditoría.

El sistema SHALL mostrar en su lugar el estado real: la discrepancia contra el docx **sigue
vigente** (el docx no modela documentos por factura), pero la tabla ya no falta — lo que falta es que
`Factura` deje de ser mock. El aviso MUST NOT omitir la mención a la discrepancia con el docx: sigue
siendo cierta y sigue pendiente de confirmar con su dueño.

#### Scenario: El aviso ya no pide una tabla que existe
- **GIVEN** `FacturaDocumentos.tsx`
- **WHEN** se lee su `AvisoModeloDatos`
- **THEN** no dice que `C-07` deba crear `documento_factura`
- **AND** sí menciona que el docx no modela documentos por factura (discrepancia vigente)
- **AND** sí menciona que la subida sigue simulada porque `Factura` sigue en mock

### Requirement: Las discrepancias nuevas se documentan por triplicado

Toda discrepancia descubierta por `integracion-documentos` SHALL documentarse en los dos lugares que
exige `CLAUDE.md` —`knowledge-base/04_modelo_de_datos.md` §Discrepancias y el bullet correspondiente
de `CHANGES.md`— y, cuando aplique a una pantalla, con `AvisoModeloDatos`. MUST NOT resolverse
unilateralmente en el código.

Las discrepancias documentadas por este change son:
1. `archivo_url` (4 tablas) **no guarda una URL**, guarda la clave del objeto dentro del bucket.
2. El bucket `documentos-vehiculos` estuvo gateado por el módulo `conductores` mientras su tabla
   `conductores.documentacion_vehiculo` pide `vehiculos` (desfasaje introducido por
   `20260730140000_split_modulos_permisos.sql`, que no tocó `storage.objects`) — repunteado a
   `vehiculos` (Checkpoint 3).
3. El modelo documental es **heterogéneo**: `pacientes.documentos` y `facturacion.documento_factura`
   referencian el catálogo compartido `obra_social.tipos_documento` por UUID, mientras
   `conductores.documentacion_*` usan un `tipo_documento TEXT` libre sin catálogo.
4. `conductores.documentacion_conductores` era la única de las 4 tablas **sin `created_at`**, un gap
   de trazabilidad (RN-GL-02) que existía desde `20260724100006_schema_conductores.sql` — cerrado por
   la migración aditiva del Checkpoint 2.

#### Scenario: Cada discrepancia queda en los dos documentos
- **GIVEN** las cuatro discrepancias listadas
- **WHEN** `integracion-documentos` se completa
- **THEN** las cuatro aparecen en `knowledge-base/04_modelo_de_datos.md` §Discrepancias
- **AND** las cuatro aparecen resumidas en el bullet de `CHANGES.md` §C-03
- **AND** ninguna fue resuelta cambiando el schema sin veredicto de la usuaria/Enzo

#### Scenario: CHANGES.md deja de afirmar algo que dejó de ser cierto
- **GIVEN** el texto de `CHANGES.md` §C-03, que decía *"documentos-vehiculos cae bajo conductores, no
  un módulo propio"* — cierto al 2026-07-29, falso desde el split del 2026-07-30
- **WHEN** el change se completa
- **THEN** ese texto queda corregido con el estado real y con el veredicto del Checkpoint 3

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

### Requirement: La exigencia de documentación propia por tipo de actividad se documenta como discrepancia no confirmada

La regla *"cada tipo de actividad exige documentación propia, además de la que exige la obra social"*
NO proviene del cliente: es un supuesto del equipo. Mientras no haya confirmación del cliente, el
sistema SHALL tratarla como discrepancia abierta y documentarla en los tres lugares que exige el
proyecto, sin resolverla unilateralmente en el código:

1. `knowledge-base/04_modelo_de_datos.md` §Discrepancias — bullet propio que describa el supuesto, su
   origen (equipo, no cliente), la forma de la configuración introducida y su default vacío.
2. `knowledge-base/05_reglas_de_negocio.md` — nota `⚠️` en RN-FA-08 y RN-FA-10 indicando que existe un
   segundo eje de configuración documental todavía **no confirmado**, con referencia a la
   discrepancia. El sistema MUST NOT reescribir el texto normativo de esas reglas, ni redactar una
   regla nueva marcada como feedback del cliente, mientras el supuesto no esté confirmado.
3. `CHANGES.md` — bullet de refinamiento en `C-03` (dueño del componente/tipo/repository documental
   compartido) y en `C-05` (dueño de la pantalla Pacientes → Documentos), siguiendo el formato de los
   tres refinamientos anteriores de este mismo dominio.

Además, la sección de documentación del paciente SHALL mostrar un `AvisoModeloDatos` que lo indique en
pantalla, usando el componente del design system, sin markup ad-hoc ni estilos inline.

Cuando el cliente confirme la regla, la documentación SHALL actualizarse: la regla pasa a la
knowledge-base con su marca de procedencia real y las notas `⚠️` se cierran.

#### Scenario: La discrepancia queda documentada en los tres lugares

- **WHEN** el change se completa sin confirmación del cliente
- **THEN** el supuesto aparece descrito en `knowledge-base/04_modelo_de_datos.md` §Discrepancias
- **AND** RN-FA-08 y RN-FA-10 llevan una nota `⚠️` que apunta a esa discrepancia
- **AND** `CHANGES.md` lo refleja en los bullets de `C-03` y `C-05`

#### Scenario: Las reglas de negocio no se reescriben sobre un supuesto

- **WHEN** se documenta la discrepancia
- **THEN** el texto normativo de RN-FA-08 y RN-FA-10 permanece sin cambios
- **AND** no se agrega ninguna regla nueva marcada como feedback confirmado del cliente

#### Scenario: El aviso distingue supuesto de exigencia confirmada

- **WHEN** el usuario abre la sección de documentación de un paciente
- **THEN** el `AvisoModeloDatos` indica explícitamente que la documentación propia por tipo de
  actividad es un supuesto del equipo pendiente de confirmar con el cliente
- **AND** el aviso no presenta esa exigencia como una regla ya validada del negocio

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
