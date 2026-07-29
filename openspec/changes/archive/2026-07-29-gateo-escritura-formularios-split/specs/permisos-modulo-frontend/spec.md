## ADDED Requirements

### Requirement: Permiso de escritura derivado de la ruta activa

El sistema SHALL derivar, en un único punto de verdad para toda la pantalla activa, si la cuenta en sesión puede escribir en el módulo al que pertenece la ruta actual, cruzando el módulo que resuelve el mapeo declarativo ruta→módulo con la comprobación de nivel mínimo `write`. Ningún componente de pantalla MUST declarar contra qué módulo se gatea: eso lo determina la ruta.

Las rutas declaradas sin módulo propio (Dashboard, gestión de cuentas, vitrina del design system) MUST resolverse como escritura permitida, porque no hay módulo del backend contra el cual gatear — el acceso a esas rutas ya está gobernado por sesión activa o por rol.

#### Scenario: Cuenta con nivel de escritura sobre el módulo de la ruta

- **GIVEN** una cuenta con permiso `write` sobre `pacientes`
- **WHEN** la cuenta está en la ruta `/pacientes`
- **THEN** el permiso de escritura de la pantalla es verdadero

#### Scenario: Cuenta con solo lectura sobre el módulo de la ruta

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta está en la ruta `/pacientes`
- **THEN** el permiso de escritura de la pantalla es falso

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta está en cualquier ruta de módulo
- **THEN** el permiso de escritura de la pantalla es verdadero, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Ruta agrupada bajo un módulo compartido

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta está en la ruta `/vehiculos` o en `/hojas-de-ruta`
- **THEN** el permiso de escritura de la pantalla es falso en ambas, porque las dos rutas pertenecen al módulo `conductores` según la agrupación del backend

#### Scenario: Ruta sin módulo propio

- **WHEN** la cuenta está en la ruta `/` (Dashboard)
- **THEN** el permiso de escritura de la pantalla es verdadero, sin consultar la matriz de permisos

#### Scenario: Consumo fuera de una pantalla con módulo resuelto

- **WHEN** un componente consulta el permiso de escritura sin que exista un punto de derivación por encima suyo en el árbol
- **THEN** obtiene verdadero, preservando el comportamiento previo al gateo, dado que este control es de experiencia de uso y no una frontera de seguridad

### Requirement: Acciones de escritura deshabilitadas sin permiso

El sistema SHALL impedir que una cuenta sin nivel `write` sobre el módulo de la pantalla active los controles que crean, editan o eliminan datos de ese módulo, en los listados, en las pantallas de detalle y en los formularios de alta y edición.

La declaración de que un control requiere escritura MUST ser explícita en cada control. El sistema MUST NOT deducir automáticamente que todo control de una pantalla requiere escritura.

#### Scenario: Punto de entrada de alta en un listado

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el listado de pacientes
- **THEN** la acción de crear un paciente no se puede activar

#### Scenario: Punto de entrada de edición en un detalle

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el detalle de una obra social
- **THEN** la acción de editar no se puede activar

#### Scenario: Guardado de un formulario

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de una factura
- **THEN** la acción de guardar no se puede activar y no se emite ninguna escritura al repositorio

#### Scenario: Cuenta con permiso de escritura

- **GIVEN** una cuenta con permiso `write` sobre `conductores`
- **WHEN** la cuenta abre el listado de conductores
- **THEN** la acción de crear un conductor se puede activar con normalidad

### Requirement: Acciones sin escritura preservadas en modo solo lectura

El sistema SHALL mantener plenamente operativos, para una cuenta sin nivel `write`, todos los controles que no escriben datos: cancelar una edición, volver al listado, conmutar entre vistas de una misma pantalla, reintentar una carga fallida, buscar y navegar a un detalle.

Una cuenta en modo solo lectura MUST NOT quedar sin forma de salir de una pantalla de formulario.

#### Scenario: Cancelar un formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un paciente y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Conmutar vistas en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `conductores` y ningún otro nivel
- **WHEN** la cuenta conmuta entre las vistas de la pantalla de hojas de ruta
- **THEN** la vista cambia con normalidad

#### Scenario: Navegar a un detalle en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `facturacion` y ningún otro nivel
- **WHEN** la cuenta selecciona una fila del listado de facturas
- **THEN** se abre el detalle correspondiente

### Requirement: Campos de formulario no editables sin permiso de escritura

El sistema SHALL presentar los campos de los formularios de un módulo como no editables cuando la cuenta activa no tiene nivel `write` sobre ese módulo, incluidos los campos de los editores anidados dentro del formulario. El estado no editable MUST comunicarse a la capa de accesibilidad como tal, no solo mediante apariencia visual.

#### Scenario: Campos del formulario principal

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un paciente
- **THEN** ninguno de los campos del formulario acepta entrada

#### Scenario: Campos de un editor anidado

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un paciente, que contiene el editor de direcciones
- **THEN** los campos del editor de direcciones tampoco aceptan entrada, sin que ese editor tenga que conocer el módulo de la pantalla

#### Scenario: Campos con permiso de escritura

- **GIVEN** una cuenta con permiso `write` sobre `pacientes`
- **WHEN** la cuenta tiene abierto el formulario de un paciente
- **THEN** todos los campos aceptan entrada con normalidad

### Requirement: Modo solo lectura visible para la cuenta activa

El sistema SHALL indicar en pantalla que la cuenta está en modo solo lectura sobre el módulo actual, de modo que los controles no activables tengan una explicación visible en vez de leerse como un fallo de la aplicación. El indicador MUST reutilizar el componente de aviso del design system, y MUST NOT aparecer cuando la cuenta sí tiene nivel `write`.

#### Scenario: Cuenta sin permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de obras sociales
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo

#### Scenario: Cuenta con permiso de escritura

- **GIVEN** una cuenta con permiso `write` sobre `obra_social`
- **WHEN** la cuenta abre la pantalla de obras sociales
- **THEN** la pantalla no muestra ningún aviso de solo lectura

### Requirement: El gateo de escritura del cliente no sustituye a la RLS

El sistema SHALL tratar el gateo de escritura de la interfaz como una mejora de experiencia de uso, no como frontera de autorización. La documentación del código MUST dejar constancia de que la autorización efectiva de escritura la impone la Row Level Security del servidor mediante `modulos.tiene_permiso(modulo, 'write')`.

La jerarquía de niveles usada por el cliente para este gateo MUST ser exactamente la misma función pura `tienePermiso` ya especificada por esta capability, sin reimplementarla ni derivar una variante propia, de modo que no pueda divergir de la semántica del servidor.

#### Scenario: Escritura forzada sorteando el gateo del cliente

- **WHEN** una escritura alcanza una tabla de dominio sobre la que la cuenta no tiene nivel `write`, sorteando el gateo de la interfaz
- **THEN** la RLS del servidor rechaza la operación, independientemente de lo que haya decidido el frontend

#### Scenario: Una sola implementación de la jerarquía de niveles

- **WHEN** se audita cómo la interfaz decide si una acción de escritura está permitida
- **THEN** la decisión proviene de la misma función `tienePermiso` que ya usan el guard de ruta y el filtrado de navegación, sin una segunda implementación de la jerarquía `read < write < admin`
