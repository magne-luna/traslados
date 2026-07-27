## ADDED Requirements

### Requirement: Pantalla de alta, edición y listado de conductores
El sistema SHALL proveer una pantalla en `frontend/src/features/conductores/` que liste los conductores y permita darlos de alta y editarlos, consumiendo `ConductorRepository` vía context (nunca el mock directamente), con estados de carga, vacío y error. El listado SHALL seguir el patrón de fila clickeable + detalle ya usado en Vehículos / Obras Sociales (`08_arquitectura_propuesta.md`).

#### Scenario: Listado con estado vacío
- **WHEN** el repository resuelve una lista sin conductores
- **THEN** la pantalla muestra un estado vacío explícito, no una tabla en blanco ni un loading infinito

#### Scenario: Fila de listado clickeable
- **WHEN** la administradora hace click sobre la fila de un conductor
- **THEN** se abre/expande su detalle; el botón "Editar" dentro de la fila usa `stopPropagation` para no colisionar con el click de la fila

#### Scenario: Alta de conductor con datos personales
- **WHEN** la administradora completa apellido, nombre y documento y guarda
- **THEN** el conductor se crea vía `ConductorRepository.create` y aparece en el listado

#### Scenario: Error del repository visible
- **WHEN** una operación de create o update falla en el repository
- **THEN** la pantalla muestra un mensaje de error visible y no queda en estado de carga infinito

### Requirement: Alta sin cuenta de acceso
El sistema SHALL registrar al conductor únicamente como datos administrativos. El flujo de alta MUST NOT crear ninguna cuenta de usuario, sesión, credencial ni referencia al sistema de autenticación (RN-GL-03, US-600).

#### Scenario: El alta no toca el sistema de auth
- **WHEN** se da de alta un conductor
- **THEN** no se crea usuario de auth ni sesión, y la pantalla no ofrece ningún campo de contraseña, email de acceso ni rol del sistema

### Requirement: Selector tipado de restricciones de perfil
El sistema SHALL permitir asignar a un conductor cero o más restricciones de perfil mediante una multi-selección sobre el conjunto cerrado `RestriccionConductor`, más un campo libre de `observaciones`.

#### Scenario: Selección de restricción documentada
- **WHEN** la administradora marca la restricción "no traslada pacientes con carga física" en el formulario
- **THEN** el valor tipado correspondiente (`'no-carga-fisica'`) se persiste en `restricciones` del conductor vía `update`/`create`

#### Scenario: Validación de campos obligatorios
- **WHEN** se intenta guardar un conductor sin apellido, nombre o documento
- **THEN** una función pura de validación bloquea el guardado y señala los campos faltantes
