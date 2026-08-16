# Paciente Contract

## Purpose

Define the core data model and interfaces for the Paciente entity, including type definitions, repository abstraction, and mock implementation for the frontend UI. Covers patient identity (DNI, CUIL, affiliation), medical information (CUD, condition), mobility accessories, associated social work, addresses, dependent persons, and judicial protection flags.

---
## Requirements
### Requirement: Tipo de dominio Paciente

El sistema SHALL definir un tipo TypeScript `Paciente` en `frontend/src/shared/types/` que modele:
identificador, apellido(s), nombre(s), fecha de nacimiento, DNI, CUIL del titular,
diagnóstico/condición, accesorio de movilidad, obra social asignada (por referencia de id, no
embebida), CUD, identificador de afiliado adaptable, direcciones múltiples, personas a cargo,
teléfono alternativo del responsable y flag de amparo judicial. El tipo MUST estar en modo strict
sin uso de `any`. El campo `accesorioMovilidad` MUST ser `TipoAccesorio[]`, donde `TipoAccesorio` es
`string` con valores del catálogo dinámico `pacientes.accesorios`, definido en
`shared/types/catalogoAccesorios.ts` — ya NO una unión cerrada de literales: cualquier tipo presente
en el maestro es un valor legítimo.
(Previously: el accesorio reutilizaba `AccesorioMovilidad`, una unión cerrada de 5 literales de
`shared/types/vehiculo.ts`.)

#### Scenario: El CUIL del titular es un campo propio, distinto del identificador de afiliado

- WHEN se modela un `Paciente`
- THEN el `cuil` del titular (RN-ID-01) es un campo separado del identificador de afiliado y del DNI, y NO se unifican

#### Scenario: La obra social se referencia, no se embebe

- WHEN un `Paciente` tiene una obra social asignada
- THEN se guarda una referencia (`obraSocialId`) y no una copia embebida de la obra social, para que el checklist y la plantilla se lean siempre del maestro de FE-2

#### Scenario: El accesorio de movilidad es un valor del catálogo, no un literal fijo

- WHEN se declara `Paciente.accesorioMovilidad`
- THEN su tipo es `TipoAccesorio[]` (`string` del catálogo dinámico)
- AND no existe en el código una lista cerrada de literales contra la cual validar al compilar

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
El sistema SHALL definir una interfaz `PacienteRepository` con los métodos `list(): Promise<Paciente[]>`, `getById(id): Promise<Paciente | null>`, `create(data): Promise<Paciente>` y `update(id, data): Promise<Paciente>`. La UI MUST consumir esta interfaz por inyección y NUNCA acceder a Supabase directamente ni importar el mock concreto. El contrato de error SHALL ser normativo y común a toda implementación: los métodos rechazan con una instancia de `Error` cuyo `message` es texto en castellano apto para mostrarse al usuario tal cual, porque la capa de estado (`usePacientes`) lo renderiza sin transformarlo. Ninguna implementación MUST introducir un tipo de error propio, un objeto de resultado `{ ok, error }` ni un cambio de firma.

#### Scenario: La UI depende de la interfaz, no de la implementación
- **WHEN** una pantalla de pacientes necesita datos
- **THEN** recibe un `PacienteRepository` por inyección y no importa ningún cliente Supabase ni fixture concreto

#### Scenario: getById de un id inexistente
- **WHEN** se llama `getById` con un id que no existe
- **THEN** la promesa resuelve a `null` (no lanza excepción)

#### Scenario: Toda implementación rechaza con Error y mensaje mostrable
- **WHEN** cualquier implementación de `PacienteRepository` falla en `list`, `create` o `update`
- **THEN** la promesa rechaza con una instancia de `Error`
- **AND** su `message` está en castellano y puede mostrarse al usuario sin post-procesamiento

#### Scenario: Agregar una implementación no cambia la interfaz
- **WHEN** se suma una implementación nueva (por ejemplo, contra Supabase)
- **THEN** `PacienteRepository.ts` y `shared/types/paciente.ts` quedan sin modificar
- **AND** solo cambia el archivo que elige qué implementación inyectar

### Requirement: Implementación mock del repository
El sistema SHALL proveer una implementación mock de `PacienteRepository` en
`frontend/src/shared/lib/mocks/` que persista fixtures en `localStorage` (con `schemaVersion`) y
devuelva promesas con latencia simulada, para ejercitar estados de carga y error reales. El mock
MUST cumplir la interfaz al pie de la letra y MUST mantener la misma semántica de error que la
implementación real (`getById` resuelve `null`; `update` de un id inexistente lanza `Error`), porque
a partir de la integración con Supabase ambas implementaciones conviven y los tests de la feature se
escriben contra el mock esperando el comportamiento de la real. El mock SHALL seguir existiendo como
doble de test y como implementación de respaldo para desarrollo sin backend, pero MUST NOT ser la
implementación inyectada por el punto de composición de la aplicación.

#### Scenario: Persistencia entre recargas
- **WHEN** el usuario crea o edita un paciente y recarga la página
- **THEN** los cambios siguen disponibles al releer desde el mock (persistidos en localStorage)

#### Scenario: Fixture con formatos de afiliado distintos
- **WHEN** no hay datos previos en localStorage
- **THEN** el mock siembra 2-3 pacientes cuyos identificadores de afiliado usan formatos diferentes (número de documento, alfanumérico y CUIL con sufijo), y al menos uno con amparo judicial y otro sin él

#### Scenario: Latencia simulada para loading states
- **WHEN** la UI invoca `list()` u otro método del mock
- **THEN** la promesa resuelve tras una demora simulada, permitiendo mostrar un estado de carga

#### Scenario: El mock ya no es la implementación de la aplicación
- **WHEN** se inspecciona el punto de composición de la feature (`PacientesRoute.tsx`)
- **THEN** inyecta la implementación real contra Supabase
- **AND** el mock solo aparece en tests y en configuraciones explícitas de desarrollo sin backend

### Requirement: Una única implementación activa elegida en el punto de composición
El sistema SHALL concentrar en un solo archivo por feature (`PacientesRoute.tsx`) la decisión de qué
implementación de `PacienteRepository` usa la aplicación. Ese archivo MUST ser el único de
`features/pacientes/` que importa una implementación concreta; el resto de la feature MUST conocer
únicamente la interfaz. Cambiar de implementación (mock ↔ Supabase) MUST ser posible modificando
solo ese archivo, sin tocar componentes, hooks ni contexts.

#### Scenario: Cambiar de implementación es un cambio de una línea
- **WHEN** se reemplaza la implementación inyectada
- **THEN** el diff se limita al composition root
- **AND** ningún componente ni test de comportamiento de la feature necesita reescribirse

#### Scenario: Rollback inmediato al mock
- **WHEN** la implementación real presenta un problema en producción
- **THEN** revertir el composition root al mock restaura la aplicación
- **AND** los archivos de la implementación real quedan inertes porque nadie más los importa

