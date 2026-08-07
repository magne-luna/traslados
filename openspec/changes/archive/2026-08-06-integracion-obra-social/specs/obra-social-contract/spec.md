## MODIFIED Requirements

### Requirement: Tipo de dominio ObraSocial
El sistema SHALL definir un tipo TypeScript `ObraSocial` en `frontend/src/shared/types/` que modele:
identificador, nombre, CUIT (campo distinto del CUIL del paciente, RN-ID-01), plazo de cobro en días
(configurable), tipo de comprobante (`'A' | 'B' | 'C'`, RN-FA-07), modalidad de facturación
(`'por-prestacion' | 'general'`), flag de si admite pagos parciales/por lote, checklist documental
configurable y plantilla de descripción de factura. El tipo SHALL modelar además los cuatro campos
que el modelo de datos real ya tiene y que el frontend no podía completar: **código, dirección,
teléfono y condición frente al IVA**, los cuatro **opcionales** (las columnas son nullables y ninguna
fuente los declara obligatorios). El tipo MUST estar en modo strict sin uso de `any`.

#### Scenario: El CUIT de la obra social es distinto del CUIL del paciente
- **WHEN** se modela una `ObraSocial`
- **THEN** el campo fiscal de la obra social es `cuit` y NO reutiliza ni se unifica con el `cuil` del
  titular/paciente (RN-ID-01)

#### Scenario: A qué entidad pertenece el CUIT queda como pregunta abierta
- **GIVEN** que el modelo real tiene `obra_social.cuit` y `obra_social.prestadores.cuit` como
  columnas distintas de tablas distintas
- **WHEN** se documenta el campo `cuit` del tipo
- **THEN** NO se afirma unilateralmente que es el del prestador
- **AND** la ambigüedad queda registrada como pregunta abierta y señalizada en la ficha con
  `AvisoModeloDatos`

#### Scenario: Campos con valores por defecto configurables, nunca hardcodeados
- **WHEN** una obra social se crea sin confirmación del cliente sobre plazo de cobro o tipo de
  comprobante
- **THEN** el valor por defecto documentado en la KB se persiste como dato editable de esa obra
  social, no como constante fija en el código del frontend

#### Scenario: Los cuatro campos del modelo real son completables desde la app
- **WHEN** el usuario da de alta o edita una obra social
- **THEN** puede cargar código, dirección, teléfono y condición frente al IVA
- **AND** dejarlos vacíos es válido: el alta no se bloquea por ellos

#### Scenario: La condición frente al IVA no se modela como unión cerrada
- **GIVEN** que ninguna fuente (docx ni KB) enumera los valores admitidos
- **WHEN** se modela `condicionIva`
- **THEN** es texto libre opcional, sin una unión de literales inventada
- **AND** la pregunta de qué valores admite queda registrada como abierta

### Requirement: Checklist documental configurable por obra social
El sistema SHALL modelar el checklist de documentación como una lista ordenada de ítems configurable
por obra social (RN-FA-08), reutilizando el tipo `ChecklistItem` ya definido en
`frontend/src/shared/types/documento.ts` (con `id`, `nombre`, `requerido`). El orden de los ítems
MUST preservarse tal como lo exige cada obra social. La **persistencia** de ese checklist SHALL ser
relacional —filas de vínculo contra un catálogo compartido de tipos de documento— y el `id` de cada
`ChecklistItem` SHALL corresponder al del tipo de documento, no al de la fila de vínculo, para que
`DocumentoAdjunto.itemId` pueda resolverse contra el mismo catálogo que usan los documentos de
paciente.

#### Scenario: No se asume un checklist genérico único
- **WHEN** se crea una obra social distinta de OSECAC
- **THEN** su checklist nace vacío y editable, sin ítems predefinidos heredados de otra obra social

#### Scenario: El orden de los ítems es significativo
- **WHEN** se persiste un checklist con sus ítems en un orden dado
- **THEN** al releer la obra social los ítems se devuelven en el mismo orden

#### Scenario: La forma del tipo no cambia por la persistencia relacional
- **WHEN** el checklist pasa a persistirse como tabla de vínculo
- **THEN** `ObraSocial.checklist` sigue siendo `ChecklistItem[]` y `ChecklistItem` conserva sus tres
  campos
- **AND** toda la traducción vive en el mapeo, no en el tipo del dominio

### Requirement: Contrato de errores del repository
El contrato de errores de `ObraSocialRepository` SHALL ser **normativo**, porque a partir de este
change existen dos implementaciones que deben comportarse igual. Toda implementación MUST rechazar
sus promesas con instancias de `Error` cuyo `message` esté en castellano y sea apto para mostrarse
tal cual al usuario, y MUST NOT propagar texto crudo del motor de base de datos. `getById()` con un
id inexistente MUST resolver a `null` sin lanzar; `update()` con un id inexistente MUST lanzar.

#### Scenario: Las dos implementaciones lanzan la misma forma de error
- **WHEN** el mock y la implementación real fallan por un id inexistente en `update()`
- **THEN** ambas rechazan con un `Error` cuyo `message` indica que no existe una obra social con ese
  id
- **AND** la UI no necesita distinguir cuál implementación está inyectada

#### Scenario: getById nunca lanza por ausencia
- **WHEN** cualquiera de las dos implementaciones recibe un id que no existe
- **THEN** la promesa resuelve a `null`
- **AND** no se lanza ninguna excepción

### Requirement: Implementación mock del repository
El sistema SHALL conservar la implementación mock de `ObraSocialRepository` en
`frontend/src/shared/lib/mocks/` como **doble de test y modo de desarrollo sin backend**. El mock
MUST seguir cumpliendo la interfaz al pie de la letra y MUST subir su `SCHEMA_VERSION` cuando cambia
la forma persistida. El mock MUST NOT seguir siendo la implementación inyectada por el punto de
composición de la aplicación.

#### Scenario: El mock deja de ser la implementación inyectada
- **WHEN** se completa este change
- **THEN** `ObraSocialesRoute.tsx` inyecta la implementación real
- **AND** el mock sigue existiendo y sus tests siguen pasando

#### Scenario: El cambio de forma persistida sube la versión de esquema
- **WHEN** el tipo `ObraSocial` gana los cuatro campos del modelo real
- **THEN** `SCHEMA_VERSION` del mock sube de 1 a 2
- **AND** un payload de la versión anterior en `localStorage` se descarta y se resiembra el fixture,
  sin romper la pantalla

#### Scenario: OSECAC precargado como fixture de desarrollo, no como seed de producción
- **WHEN** no hay datos previos en localStorage
- **THEN** el mock siembra al menos la obra social OSECAC con su checklist de documentación de RF-305,
  y ninguna otra obra social con checklist predefinido
- **AND** ese fixture NO se convierte en una migración de seed contra la base real
