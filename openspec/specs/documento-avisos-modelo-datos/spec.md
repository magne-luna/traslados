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
