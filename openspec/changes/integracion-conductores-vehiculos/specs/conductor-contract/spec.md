## MODIFIED Requirements

### Requirement: Tipos del dominio de conductores
El sistema SHALL definir los tipos TypeScript del dominio de conductores en
`frontend/src/shared/types/conductor.ts`, en modo strict y sin usar `any`. MUST incluir la interfaz
`Conductor` (id, apellido, nombre, documento, teléfono opcional, fecha de nacimiento opcional,
domicilio, CUIL, estado, `observaciones` opcional, `asignaciones`) y la sub-estructura
`AsignacionSemanal` (`04_modelo_de_datos.md §Conductor`, US-600, RN-GL-03).

`Conductor` MUST NOT tener un campo `restricciones` ni existir el tipo `RestriccionConductor`
(decisión D6, opción B): el modelo de datos real (`docs/core/Traslados-Modelo-Datos.docx`) tiene un
único campo `Notas` de texto libre donde conviven las observaciones y las restricciones de perfil, y
el docx manda en estructura. `observaciones?: string` SHALL ser el único campo libre del perfil del
conductor y MUST mapear a la columna `conductores.conductores.notas`. El nombre `observaciones` MUST
conservarse en el dominio: el renombre columna↔dominio se resuelve en el mapeo, no cambiando el tipo.

Esta decisión tiene una consecuencia conocida y asumida: la restricción de carga física (RN-GL-03,
US-600) deja de ser un dato computable y pasa a ser texto libre de lectura humana. Las hojas de ruta
(`C-10`) MUST NOT asumir que pueden filtrar conductores automáticamente por restricción; como mucho
pueden mostrar las observaciones junto al conductor para que la persona decida. Revertir esto
requiere una decisión nueva de la usuaria, no una reinterpretación en el código.

#### Scenario: El conductor no tiene campo de restricciones estructurado
- **WHEN** se declara la interfaz `Conductor`
- **THEN** no incluye ningún campo `restricciones`
- **AND** el tipo `RestriccionConductor` no existe en `shared/types/conductor.ts`

#### Scenario: Observaciones es el único campo libre del perfil
- **WHEN** se necesita registrar que un conductor no traslada pacientes con carga física
- **THEN** se escribe en `observaciones`, como texto libre
- **AND** no hay ningún otro campo del tipo donde esa información pueda ir

#### Scenario: El conductor no modela credenciales de acceso
- **WHEN** se define la interfaz `Conductor`
- **THEN** no incluye ningún campo de credencial, sesión, rol de acceso ni referencia a usuario de
  auth (RN-GL-03): es solo un registro de datos administrativos

#### Scenario: Asignación semanal referencia al vehículo por id
- **WHEN** se declara una `AsignacionSemanal`
- **THEN** contiene `vehiculoId: string` y `semana: string` (etiqueta ISO de semana), y NO embebe el
  objeto `Vehiculo` completo

### Requirement: Implementación mock con persistencia en localStorage
El sistema SHALL proveer una implementación mock de `ConductorRepository` en
`frontend/src/shared/lib/mocks/mockConductorRepository.ts` que cumpla la interfaz al pie de la letra,
persista en `localStorage` con un `schemaVersion` y devuelva promesas con latencia simulada, para
ejercitar estados de carga y error reales. El mock MUST mantener la misma semántica de error que la
implementación real (`getById` resuelve `null`; `update` de un id inexistente lanza `Error` con
`message` en castellano), porque a partir de la integración con Supabase ambas implementaciones
conviven y los tests de la feature se escriben contra el mock esperando el comportamiento de la real.
El mock SHALL seguir existiendo como doble de test y como implementación de respaldo para desarrollo
sin backend, pero MUST NOT ser la implementación inyectada por el punto de composición de la
aplicación.

#### Scenario: Siembra del fixture inicial
- **WHEN** no hay datos de conductores en `localStorage`
- **THEN** el mock siembra un fixture con 2-3 conductores de ejemplo (al menos uno con una restricción
  de perfil **redactada dentro de `observaciones`** y uno con una asignación semanal a un vehículo del
  fixture de flota) y lo persiste

#### Scenario: El schemaVersion sube al eliminarse restricciones del tipo
- **WHEN** se elimina `restricciones` de la interfaz `Conductor`
- **THEN** el `schemaVersion` del mock de conductores sube (2 → 3) y el mismatch re-siembra el fixture
- **AND** el payload guardado con la forma anterior NO se migra: es un mock, no hay dato de producción
  que preservar

#### Scenario: Persistencia entre recargas
- **WHEN** se crea o actualiza un conductor y luego se vuelve a leer tras una recarga simulada
- **THEN** el cambio persiste porque se guardó en `localStorage`

#### Scenario: Mismatch de schemaVersion
- **WHEN** el payload almacenado tiene un `schemaVersion` distinto al esperado o está corrupto
- **THEN** el mock re-siembra desde el fixture en vez de romper la deserialización

#### Scenario: El mock ya no es la implementación de la aplicación
- **WHEN** se inspecciona el punto de composición de la feature (`ConductoresRoute.tsx`)
- **THEN** inyecta la implementación real contra Supabase
- **AND** el mock solo aparece en tests y en configuraciones explícitas de desarrollo sin backend

#### Scenario: El mock rechaza con el mismo tipo de error que la implementación real
- **WHEN** el mock falla en `create` o `update` (por ejemplo, DNI duplicado dentro del propio
  fixture)
- **THEN** la promesa rechaza con una instancia de `Error`
- **AND** su `message` está en castellano y es apto para mostrarse tal cual, sin objeto `{ ok, error
  }` ni tipo de error propio

### Requirement: Interfaz ConductorRepository
El sistema SHALL definir la interfaz `ConductorRepository` en
`frontend/src/shared/lib/conductores/ConductorRepository.ts` con las operaciones `list()`,
`getById(id)`, `create(data)` y `update(id, data)`, de modo que ninguna pantalla hable con la fuente
de datos directamente. El contrato de error SHALL ser normativo y común a toda implementación: los
métodos rechazan con una instancia de `Error` cuyo `message` es texto en castellano apto para
mostrarse al usuario tal cual, porque la capa de estado (`useConductores`) lo renderiza sin
transformarlo. Ninguna implementación MUST introducir un tipo de error propio, un objeto de resultado
`{ ok, error }` ni un cambio de firma.

#### Scenario: getById de un conductor inexistente
- **WHEN** se invoca `getById(id)` con un id que no existe
- **THEN** la promesa resuelve `null` en vez de lanzar un error

#### Scenario: Tipos de entrada sin id
- **WHEN** se invoca `create(data)`
- **THEN** el tipo del payload (`NuevoConductor`) no incluye `id`, y el `id` lo asigna la
  implementación del repository

#### Scenario: Toda implementación rechaza con Error y mensaje mostrable
- **WHEN** cualquier implementación de `ConductorRepository` falla en `list`, `create` o `update`
- **THEN** la promesa rechaza con una instancia de `Error`
- **AND** su `message` está en castellano y puede mostrarse al usuario sin post-procesamiento

#### Scenario: Agregar una implementación no cambia la interfaz
- **WHEN** se suma una implementación nueva (contra Supabase)
- **THEN** `ConductorRepository.ts` queda sin modificar y `shared/types/conductor.ts` no cambia **por
  causa de esa implementación** (los cambios que sí tiene vienen de la decisión de modelo D6)
- **AND** solo cambia el archivo que elige qué implementación inyectar

#### Scenario: Los tipos de payload no llevan instrucciones de escritura
- **WHEN** se declaran `NuevoConductor` y `ActualizacionConductor`
- **THEN** contienen únicamente datos del conductor (`Omit`/`Partial` de `Conductor` sin `id`)
- **AND** no declaran ningún flag que instruya a la implementación sobre esa escritura en particular
  —en especial, ningún `permitirMultiple`: la colisión de asignación semanal se bloquea siempre y la
  garantiza un constraint de la base

## ADDED Requirements

### Requirement: Una única implementación activa elegida en el punto de composición
El sistema SHALL concentrar en un solo archivo por feature (`ConductoresRoute.tsx`) la decisión de
qué implementación de `ConductorRepository` (y de `VehiculoRepository`, que la misma pantalla también
monta para el selector de vehículo) usa la aplicación. Ese archivo MUST ser el único de
`features/conductores/` que importa implementaciones concretas; el resto de la feature MUST conocer
únicamente las interfaces. Cambiar de implementación (mock ↔ Supabase) MUST ser posible modificando
solo ese archivo, sin tocar componentes, hooks ni contexts.

#### Scenario: Cambiar de implementación es un cambio acotado al composition root
- **WHEN** se reemplaza la implementación de `ConductorRepository` (o de `VehiculoRepository`)
  inyectada en `ConductoresRoute.tsx`
- **THEN** el diff se limita al composition root
- **AND** ningún componente ni test de comportamiento de la feature necesita reescribirse

#### Scenario: Las dos implementaciones montadas cambian juntas
- **WHEN** `ConductoresRoute.tsx` pasa a inyectar `SupabaseConductorRepository`
- **THEN** en el mismo cambio pasa a inyectar también `SupabaseVehiculoRepository` para el
  `VehiculoRepositoryProvider` que monta
- **AND** no queda, salvo la fase transitoria documentada en D2 del design, una combinación donde uno
  de los dos providers siga apuntando al mock mientras el otro ya apunta a Supabase

#### Scenario: Rollback inmediato al mock
- **WHEN** la implementación real presenta un problema en producción
- **THEN** revertir el composition root a los mocks de `ConductorRepository` y `VehiculoRepository`
  restaura la aplicación
- **AND** los archivos de las implementaciones reales quedan inertes porque nadie más los importa
