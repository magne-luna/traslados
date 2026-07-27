# Paciente Contract

## Purpose

Define the core data model and interfaces for the Paciente entity, including type definitions, repository abstraction, and mock implementation for the frontend UI. Covers patient identity (DNI, CUIL, affiliation), medical information (CUD, condition), mobility accessories, associated social work, addresses, dependent persons, and judicial protection flags.

---

## Requirements

### Requirement: Tipo de dominio Paciente
El sistema SHALL definir un tipo TypeScript `Paciente` en `frontend/src/shared/types/` que modele: identificador, apellido(s), nombre(s), fecha de nacimiento, DNI, CUIL del titular, diagnóstico/condición, accesorio de movilidad, obra social asignada (por referencia de id, no embebida), CUD, identificador de afiliado adaptable, direcciones múltiples, personas a cargo, teléfono alternativo del responsable y flag de amparo judicial. El tipo MUST estar en modo strict sin uso de `any`; donde el accesorio de movilidad ya esté tipado (FE-2) el tipo MUST reutilizar `AccesorioMovilidad` de `shared/types/vehiculo.ts` en vez de redefinirlo.

#### Scenario: El CUIL del titular es un campo propio, distinto del identificador de afiliado
- **WHEN** se modela un `Paciente`
- **THEN** el `cuil` del titular (RN-ID-01) es un campo separado del identificador de afiliado y del DNI, y NO se unifican

#### Scenario: La obra social se referencia, no se embebe
- **WHEN** un `Paciente` tiene una obra social asignada
- **THEN** se guarda una referencia (`obraSocialId`) y no una copia embebida de la obra social, para que el checklist y la plantilla se lean siempre del maestro de FE-2

### Requirement: Identificador de afiliado adaptable
El sistema SHALL modelar el identificador de afiliado del paciente como una estructura `{ formato, valor }` donde `formato` es una unión cerrada de literales que cubra al menos: número de documento, alfanumérico y CUIL del titular con sufijo (RN-ID-02, IN-01). El sistema MUST NOT usar `string` libre para el formato ni atar el identificador a una sola forma fija en el código.

#### Scenario: Distintos formatos coexisten sin cambiar el tipo
- **WHEN** dos pacientes de obras sociales distintas tienen identificadores de afiliado con formatos diferentes (p. ej. uno alfanumérico y otro CUIL con sufijo /01)
- **THEN** ambos se representan con el mismo tipo `Paciente`, variando solo el campo `formato`, sin ramas de tipo distintas ni casts

#### Scenario: Formato por defecto documentado, nunca hardcodeado
- **WHEN** se crea un paciente sin confirmación del cliente sobre el formato del identificador (IN-01 abierta)
- **THEN** el formato inicial es el default documentado en la KB y queda editable por el usuario, no fijado como constante en el código

### Requirement: CUD con estado de vencimiento
El sistema SHALL modelar el CUD (Certificado Único de Discapacidad) con número, fecha de emisión y fecha de vencimiento, y SHALL proveer una función pura que derive el estado de vigencia (`vigente | por-vencer | vencido`) a partir del CUD y una fecha de referencia, para la alerta de vencimiento próximo (RF-104). La función MUST ser pura (sin efectos ni lectura de reloj global) y determinística respecto de la fecha de referencia que recibe.

#### Scenario: CUD vencido
- **WHEN** la fecha de vencimiento del CUD es anterior a la fecha de referencia
- **THEN** el estado derivado es `vencido`

#### Scenario: CUD por vencer dentro del umbral
- **WHEN** la fecha de vencimiento cae dentro del umbral de alerta (p. ej. próximos 60 días) respecto de la fecha de referencia
- **THEN** el estado derivado es `por-vencer`

#### Scenario: CUD vigente fuera del umbral
- **WHEN** la fecha de vencimiento es posterior al umbral de alerta
- **THEN** el estado derivado es `vigente`

### Requirement: Interfaz PacienteRepository
El sistema SHALL definir una interfaz `PacienteRepository` con los métodos `list(): Promise<Paciente[]>`, `getById(id): Promise<Paciente | null>`, `create(data): Promise<Paciente>` y `update(id, data): Promise<Paciente>`. La UI MUST consumir esta interfaz por inyección y NUNCA acceder a Supabase directamente ni importar el mock concreto.

#### Scenario: La UI depende de la interfaz, no de la implementación
- **WHEN** una pantalla de pacientes necesita datos
- **THEN** recibe un `PacienteRepository` por inyección y no importa ningún cliente Supabase ni fixture concreto

#### Scenario: getById de un id inexistente
- **WHEN** se llama `getById` con un id que no existe
- **THEN** la promesa resuelve a `null` (no lanza excepción)

### Requirement: Implementación mock del repository
El sistema SHALL proveer una implementación mock de `PacienteRepository` en `frontend/src/shared/lib/mocks/` que persista fixtures en `localStorage` (con `schemaVersion`) y devuelva promesas con latencia simulada, para ejercitar estados de carga y error reales. El mock MUST cumplir la interfaz al pie de la letra para que el reemplazo por `SupabasePacienteRepository` (FE-8) sea mecánico.

#### Scenario: Persistencia entre recargas
- **WHEN** el usuario crea o edita un paciente y recarga la página
- **THEN** los cambios siguen disponibles al releer desde el mock (persistidos en localStorage)

#### Scenario: Fixture con formatos de afiliado distintos
- **WHEN** no hay datos previos en localStorage
- **THEN** el mock siembra 2-3 pacientes cuyos identificadores de afiliado usan formatos diferentes (número de documento, alfanumérico y CUIL con sufijo), y al menos uno con amparo judicial y otro sin él

#### Scenario: Latencia simulada para loading states
- **WHEN** la UI invoca `list()` u otro método del mock
- **THEN** la promesa resuelve tras una demora simulada, permitiendo mostrar un estado de carga
