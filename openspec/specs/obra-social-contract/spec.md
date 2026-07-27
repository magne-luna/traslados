## Requirements

### Requirement: Tipo de dominio ObraSocial
El sistema SHALL definir un tipo TypeScript `ObraSocial` en `frontend/src/shared/types/` que modele: identificador, nombre, CUIT del prestador (campo distinto del CUIL del paciente, RN-ID-01), plazo de cobro en días (configurable), tipo de comprobante (`'A' | 'B' | 'C'`, RN-FA-07), modalidad de facturación (`'por-prestacion' | 'general'`), flag de si admite pagos parciales/por lote, checklist documental configurable y plantilla de descripción de factura. El tipo MUST estar en modo strict sin uso de `any`.

#### Scenario: El CUIT del prestador es distinto del CUIL del paciente
- **WHEN** se modela una `ObraSocial`
- **THEN** el campo fiscal de la obra social es `cuit` (prestador) y NO reutiliza ni se unifica con el `cuil` del titular/paciente (RN-ID-01)

#### Scenario: Campos con valores por defecto configurables, nunca hardcodeados
- **WHEN** una obra social se crea sin confirmación del cliente sobre plazo de cobro o tipo de comprobante
- **THEN** el tipo permite persistir el valor por defecto documentado en la KB como dato editable, no como constante fija en el código

### Requirement: Checklist documental configurable por obra social
El sistema SHALL modelar el checklist de documentación como una lista ordenada de ítems configurable por obra social (RN-FA-08), reutilizando el tipo `ChecklistItem` ya definido en `frontend/src/shared/types/documento.ts` (con `id`, `nombre`, `requerido`). El orden de los ítems MUST preservarse tal como lo exige cada obra social.

#### Scenario: No se asume un checklist genérico único
- **WHEN** se crea una obra social distinta de OSECAC
- **THEN** su checklist nace vacío y editable, sin ítems predefinidos heredados de otra obra social

#### Scenario: El orden de los ítems es significativo
- **WHEN** se persiste un checklist con sus ítems en un orden dado
- **THEN** al releer la obra social los ítems se devuelven en el mismo orden

### Requirement: Interfaz ObraSocialRepository
El sistema SHALL definir una interfaz `ObraSocialRepository` con los métodos `list(): Promise<ObraSocial[]>`, `getById(id): Promise<ObraSocial | null>`, `create(data): Promise<ObraSocial>` y `update(id, data): Promise<ObraSocial>`. La UI MUST consumir esta interfaz y NUNCA acceder a Supabase directamente.

#### Scenario: La UI depende de la interfaz, no de la implementación
- **WHEN** una pantalla necesita datos de obras sociales
- **THEN** recibe un `ObraSocialRepository` por inyección y no importa ningún cliente Supabase ni fixture concreto

#### Scenario: getById de un id inexistente
- **WHEN** se llama `getById` con un id que no existe
- **THEN** la promesa resuelve a `null` (no lanza excepción)

### Requirement: Implementación mock del repository
El sistema SHALL proveer una implementación mock de `ObraSocialRepository` en `frontend/src/shared/lib/mocks/` que persista fixtures en `localStorage` y devuelva promesas con latencia simulada, para ejercitar estados de carga y error reales en la UI. El mock MUST cumplir la interfaz al pie de la letra para que el reemplazo por `SupabaseObraSocialRepository` (FE-8) sea mecánico.

#### Scenario: Persistencia entre recargas
- **WHEN** el usuario crea una obra social y recarga la página
- **THEN** la obra social sigue disponible al releer desde el mock (persistida en localStorage)

#### Scenario: Latencia simulada para loading states
- **WHEN** la UI invoca `list()` u otro método del mock
- **THEN** la promesa resuelve tras una demora simulada, permitiendo que la UI muestre un estado de carga

#### Scenario: OSECAC precargado como fixture inicial
- **WHEN** no hay datos previos en localStorage
- **THEN** el mock siembra al menos la obra social OSECAC con su checklist de documentación de RF-305, y ninguna otra obra social con checklist predefinido
