## ADDED Requirements

### Requirement: Carga de los permisos de la cuenta activa
El sistema SHALL cargar, al establecerse una sesión, los permisos por módulo de la cuenta activa leyendo `modulos.permisos` cruzado con `modulos.modulos`, y MUST exponerlos en `useAuth()` como una estructura tipada `Modulo -> NivelAcceso`. Los módulos válidos MUST ser exactamente los cuatro seedeados por el backend: `pacientes`, `obra_social`, `facturacion` y `conductores`.

#### Scenario: Cuenta con permisos parciales
- **WHEN** la cuenta activa tiene permiso `read` sobre `pacientes` y ninguno sobre los demás módulos
- **THEN** `useAuth()` expone un mapa con `pacientes: 'read'` y sin entradas para los otros tres módulos

#### Scenario: Cuenta sin ningún permiso
- **WHEN** la cuenta activa no tiene ninguna fila en `modulos.permisos`
- **THEN** `useAuth()` expone un mapa vacío y el sistema sigue considerando la sesión válida

### Requirement: Jerarquía de niveles de acceso
El sistema SHALL implementar la comprobación de permisos como una función pura `tienePermiso(permisos, modulo, nivelMinimo)` con la jerarquía `read < write < admin`, de modo que un nivel superior satisface cualquier requisito inferior. La función MUST devolver `true` para cualquier módulo y nivel cuando el rol de la cuenta es `admin`, replicando el short-circuit de `modulos.tiene_permiso()` del servidor.

#### Scenario: Nivel superior satisface un requisito inferior
- **WHEN** se consulta `tienePermiso` con nivel mínimo `read` sobre un módulo donde la cuenta tiene `write`
- **THEN** el resultado es verdadero

#### Scenario: Nivel insuficiente
- **WHEN** se consulta `tienePermiso` con nivel mínimo `write` sobre un módulo donde la cuenta tiene `read`
- **THEN** el resultado es falso

#### Scenario: Rol admin sobre cualquier módulo
- **WHEN** la cuenta tiene rol `admin` y se consulta cualquier módulo con cualquier nivel mínimo
- **THEN** el resultado es verdadero, aunque no exista fila alguna en la matriz de permisos

#### Scenario: Módulo sin permiso asignado
- **WHEN** se consulta un módulo que no aparece en el mapa de permisos de una cuenta con rol `empleado`
- **THEN** el resultado es falso

### Requirement: Mapeo declarativo de ruta a módulo
El sistema SHALL declarar en un único punto de verdad (`app/routes.ts`, junto a `APP_ROUTES`) a qué módulo del backend corresponde cada ruta del frontend. Las rutas que no pertenecen a ningún módulo (Dashboard, vitrina del design system) MUST declararlo explícitamente como ausencia de módulo, no por omisión.

#### Scenario: Ruta con módulo asociado
- **WHEN** se consulta el módulo de `/facturacion`
- **THEN** se obtiene `facturacion`

#### Scenario: Rutas agrupadas bajo un mismo módulo
- **WHEN** se consulta el módulo de `/vehiculos` y el de `/presupuestos`
- **THEN** se obtiene `conductores` y `facturacion` respectivamente, siguiendo la agrupación de módulos del backend

#### Scenario: Ruta sin módulo
- **WHEN** se consulta el módulo de `/`
- **THEN** se obtiene ausencia de módulo, y el acceso queda condicionado solo a estar autenticado

### Requirement: Hook de permisos para consumidores
El sistema SHALL exponer un hook `usePermiso(modulo, nivelMinimo)` que devuelva si la cuenta activa cumple ese requisito, para que cualquier pantalla pueda condicionar acciones sin reimplementar la lógica de niveles.

#### Scenario: Consulta desde una pantalla
- **WHEN** una pantalla consulta `usePermiso('pacientes', 'write')` con una cuenta que tiene `read` sobre `pacientes`
- **THEN** obtiene falso

### Requirement: Navegación filtrada por permisos
El sistema SHALL mostrar en la navegación del shell únicamente los módulos sobre los que la cuenta activa tiene al menos nivel `read`, más las rutas sin módulo asociado. La entrada de administración de cuentas MUST mostrarse solo a cuentas con rol `admin`.

#### Scenario: Navegación de una cuenta con permisos parciales
- **WHEN** la cuenta activa tiene permiso solo sobre `pacientes`
- **THEN** la navegación muestra Dashboard y Pacientes, y no muestra Obras Sociales, Conductores, Vehículos, Hojas de Ruta, Presupuestos ni Facturación

#### Scenario: Entrada de cuentas solo para admin
- **WHEN** la cuenta activa tiene rol `empleado`
- **THEN** la navegación no incluye la entrada de administración de cuentas

#### Scenario: Cuenta sin ningún módulo habilitado
- **WHEN** la cuenta activa no tiene permiso sobre ningún módulo
- **THEN** el shell muestra un mensaje indicando que hay que solicitar acceso a la administradora, en vez de una navegación vacía sin explicación

### Requirement: Permiso de escritura derivado de la ruta activa

El sistema SHALL derivar, en un único punto de verdad para toda la pantalla activa, si la cuenta en sesión puede escribir en el módulo al que pertenece la ruta actual, cruzando el módulo que resuelve el mapeo declarativo ruta→módulo con la comprobación de nivel mínimo `write`. Ningún componente de pantalla MUST declarar contra qué módulo se gatea: eso lo determina la ruta.

Las rutas declaradas sin módulo propio (Dashboard, gestión de cuentas, vitrina del design system) MUST resolverse como escritura permitida, porque no hay módulo del backend contra el cual gatear — el acceso a esas rutas ya está gobernado por sesión activa o por rol.

#### Scenario: Cuenta con nivel de escritura sobre el módulo de la ruta

- **GIVEN** una cuenta con permiso `write` sobre `obra_social`
- **WHEN** la cuenta está en la ruta `/obras-sociales`
- **THEN** el permiso de escritura de la pantalla es verdadero

#### Scenario: Cuenta con solo lectura sobre el módulo de la ruta

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta está en la ruta `/obras-sociales`
- **THEN** el permiso de escritura de la pantalla es falso

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta está en cualquier ruta de módulo
- **THEN** el permiso de escritura de la pantalla es verdadero, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Ruta sin módulo propio

- **WHEN** la cuenta está en la ruta `/` (Dashboard)
- **THEN** el permiso de escritura de la pantalla es verdadero, sin consultar la matriz de permisos

#### Scenario: Consumo fuera de una pantalla con módulo resuelto

- **WHEN** un componente consulta el permiso de escritura sin que exista un punto de derivación por encima suyo en el árbol
- **THEN** obtiene verdadero, preservando el comportamiento previo al gateo, dado que este control es de experiencia de uso y no una frontera de seguridad

### Requirement: Acciones de escritura visibles pero deshabilitadas sin permiso

El sistema SHALL impedir que una cuenta sin nivel `write` sobre el módulo de la pantalla active los controles que crean, editan o eliminan datos de ese módulo, en los listados, en las pantallas de detalle y en los formularios de alta y edición.

Los controles de escritura MUST permanecer visibles en la interfaz cuando la cuenta carece del permiso: el sistema MUST NOT quitarlos de la pantalla. Una acción que desaparece no le comunica a la cuenta qué permiso le falta.

La declaración de que un control requiere escritura MUST ser explícita en cada control. El sistema MUST NOT deducir automáticamente que todo control de una pantalla requiere escritura.

#### Scenario: Control de escritura sin permiso

- **GIVEN** una cuenta con permiso `read` sobre un módulo y ningún otro nivel
- **WHEN** la cuenta abre una pantalla de ese módulo con acciones de escritura
- **THEN** esas acciones siguen visibles y no se pueden activar

#### Scenario: Control de escritura con permiso

- **GIVEN** una cuenta con permiso `write` sobre un módulo
- **WHEN** la cuenta abre una pantalla de ese módulo
- **THEN** las acciones de escritura se pueden activar con normalidad

#### Scenario: Control que no declara requerir escritura

- **GIVEN** una cuenta con permiso `read` sobre un módulo y ningún otro nivel
- **WHEN** la pantalla contiene un control que no declara requerir escritura
- **THEN** ese control se puede activar, sin que el gateo lo alcance

#### Scenario: Control con lógica propia de deshabilitado

- **GIVEN** una cuenta con permiso `write` sobre un módulo
- **WHEN** un control que declara requerir escritura además está deshabilitado por su propia lógica
- **THEN** el control permanece deshabilitado, porque el gateo de permiso nunca habilita lo que la lógica del control quería bloquear

### Requirement: Acciones sin escritura preservadas en modo solo lectura

El sistema SHALL mantener plenamente operativos, para una cuenta sin nivel `write`, todos los controles que no escriben datos: cancelar una edición, volver al listado, conmutar entre vistas de una misma pantalla, reintentar una carga fallida, buscar y navegar a un detalle.

Una cuenta en modo solo lectura MUST NOT quedar sin forma de salir de una pantalla de formulario.

#### Scenario: Cancelar un formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de una obra social y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Volver al listado en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta está en el detalle de una obra social y activa la acción de volver al listado
- **THEN** la acción se ejecuta y vuelve al listado

#### Scenario: Navegar a un detalle en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta selecciona una fila del listado de obras sociales
- **THEN** se abre el detalle correspondiente

### Requirement: Campos de formulario no editables sin permiso de escritura

El sistema SHALL presentar los campos de los formularios de un módulo como no editables cuando la cuenta activa no tiene nivel `write` sobre ese módulo, incluidos los campos y los controles de los editores anidados dentro del formulario, sin que esos editores tengan que conocer el módulo de la pantalla.

El estado no editable MUST comunicarse a la capa de accesibilidad como tal, no solo mediante apariencia visual.

#### Scenario: Campos del formulario principal

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de una obra social
- **THEN** ninguno de sus campos acepta entrada

#### Scenario: Controles de un editor anidado

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta tiene abierta una pantalla que contiene un editor anidado con sus propios controles
- **THEN** los controles del editor anidado tampoco se pueden activar, sin que ese editor reciba el módulo de la pantalla

#### Scenario: Campos con permiso de escritura

- **GIVEN** una cuenta con permiso `write` sobre `obra_social`
- **WHEN** la cuenta tiene abierto el formulario de una obra social
- **THEN** todos los campos aceptan entrada con normalidad

### Requirement: Reordenamiento por arrastre bloqueado sin permiso de escritura

El sistema SHALL bloquear el reordenamiento por arrastre de los elementos de una lista editable cuando la cuenta activa no tiene nivel `write` sobre el módulo de la pantalla, porque reordenar persiste un cambio y por lo tanto es una escritura.

Este bloqueo MUST ser explícito: deshabilitar los controles de formulario de un bloque NO alcanza para impedir el arrastre de un elemento arrastrable contenido en ese bloque.

#### Scenario: Arrastre sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta intenta reordenar por arrastre un elemento de una lista editable
- **THEN** el elemento no es arrastrable y no se persiste ningún reordenamiento

#### Scenario: Arrastre con permiso de escritura

- **GIVEN** una cuenta con permiso `write` sobre `obra_social`
- **WHEN** la cuenta reordena por arrastre un elemento de una lista editable
- **THEN** el reordenamiento se aplica con normalidad

#### Scenario: Reordenamiento por botones sin permiso

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la lista editable ofrece además botones de subir y bajar
- **THEN** esos botones tampoco se pueden activar

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

#### Scenario: Ruta sin módulo propio

- **WHEN** la cuenta abre una ruta declarada sin módulo propio
- **THEN** la pantalla no muestra ningún aviso de solo lectura

### Requirement: Gateo de escritura en la pantalla de Obras Sociales

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `obra_social` a todas las acciones que persisten datos en la pantalla de obras sociales: alta, edición, guardado, y la administración del checklist de documentación y de la plantilla de factura. La consulta de esos mismos datos MUST seguir disponible con nivel `read`.

#### Scenario: Alta desde el listado

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el listado de obras sociales
- **THEN** la acción de crear una obra social está visible y no se puede activar, tanto en el encabezado del listado como en el atajo del estado vacío

#### Scenario: Edición desde el listado y desde el detalle

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el listado de obras sociales y luego el detalle de una de ellas
- **THEN** la acción de editar está visible y no se puede activar en los dos lugares, y la fila del listado sigue navegando al detalle

#### Scenario: Guardado del formulario

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de una obra social
- **THEN** la acción de guardar no se puede activar y no se emite ninguna escritura al repositorio

#### Scenario: Checklist de documentación

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el editor de checklist de una obra social
- **THEN** no puede agregar, renombrar, reordenar ni eliminar ítems, y el checklist sigue siendo legible

#### Scenario: Plantilla de factura

- **GIVEN** una cuenta con permiso `read` sobre `obra_social` y ningún otro nivel
- **WHEN** la cuenta abre el editor de plantilla de factura de una obra social
- **THEN** no puede agregar, editar, reordenar ni eliminar campos, y la plantilla sigue siendo legible

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `obra_social`
- **WHEN** la cuenta recorre el listado, el detalle, el formulario, el checklist y la plantilla de factura
- **THEN** todas las acciones de escritura se pueden activar con normalidad

#### Scenario: Permiso sobre otro módulo no habilita este

- **GIVEN** una cuenta con permiso `write` sobre `pacientes` y solo `read` sobre `obra_social`
- **WHEN** la cuenta abre la pantalla de obras sociales
- **THEN** queda en modo solo lectura, porque el gateo se resuelve contra el módulo de la ruta y no contra cualquier permiso de escritura de la cuenta

### Requirement: Gateo de escritura en la pantalla de Pacientes

El sistema SHALL aplicar el gateo de escritura por nivel `write` sobre el módulo `pacientes` a todas las acciones que persisten datos en la pantalla de pacientes: alta, edición y guardado de la ficha, y la administración del CUD, de las direcciones, de las personas a cargo y de los documentos del paciente.

La consulta de esos mismos datos MUST seguir disponible con nivel `read`. En particular, **descargar** un documento ya cargado MUST seguir disponible con nivel `read`: el gateo del cliente MUST NOT ser más restrictivo que la Row Level Security del servidor, que autoriza la lectura de los documentos del módulo con nivel `read`.

Los controles de escritura MUST permanecer visibles y deshabilitados, nunca quitados de la pantalla, y los editores anidados MUST resolver el permiso sin recibir el módulo de la pantalla ni declararlo por su cuenta.

#### Scenario: Alta desde el listado

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el listado de pacientes
- **THEN** la acción de crear un paciente está visible y no se puede activar, tanto en el encabezado del listado como en el atajo del estado vacío

#### Scenario: Edición desde el listado y desde el resumen

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el listado de pacientes y luego la ficha de uno de ellos
- **THEN** la acción de editar está visible y no se puede activar en los dos lugares, y la fila del listado sigue navegando a la ficha

#### Scenario: Campos y guardado del formulario

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un paciente
- **THEN** ninguno de sus campos acepta entrada, la acción de guardar no se puede activar, y no se emite ninguna escritura al repositorio

#### Scenario: Cancelar el formulario en modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta tiene abierto el formulario de un paciente y activa la acción de cancelar
- **THEN** la acción se ejecuta y el formulario se cierra

#### Scenario: Editor de CUD

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la ficha de un paciente con datos de CUD
- **THEN** no puede iniciar la edición, editar, quitar ni guardar el CUD, y los datos del CUD siguen siendo legibles

#### Scenario: Cancelar la edición interna de un editor anidado

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** un editor anidado ofrece una acción de cancelar su propia edición
- **THEN** esa acción de cancelar se puede activar, porque no persiste ningún dato

#### Scenario: Editor de direcciones

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el editor de direcciones de un paciente
- **THEN** no puede agregar, editar ni eliminar direcciones, y las direcciones existentes siguen siendo legibles

#### Scenario: Editor de personas a cargo

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre el editor de personas a cargo de un paciente
- **THEN** no puede agregar, editar ni eliminar personas a cargo, y las existentes siguen siendo legibles

#### Scenario: Documentos del paciente sin permiso de escritura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre los documentos de un paciente
- **THEN** no puede cargar ni dar de baja documentos, y sí puede consultar y descargar los documentos ya cargados

#### Scenario: Aviso de modo solo lectura

- **GIVEN** una cuenta con permiso `read` sobre `pacientes` y ningún otro nivel
- **WHEN** la cuenta abre la pantalla de pacientes
- **THEN** la pantalla informa que está en modo solo lectura sobre ese módulo, tanto en la vista de listado como en la de ficha

#### Scenario: Cuenta con permiso de escritura sobre el módulo

- **GIVEN** una cuenta con permiso `write` sobre `pacientes`
- **WHEN** la cuenta recorre el listado, la ficha, el formulario, el CUD, las direcciones, las personas a cargo y los documentos
- **THEN** todas las acciones de escritura se pueden activar con normalidad, y la pantalla no muestra aviso de solo lectura

#### Scenario: Rol admin sin filas en la matriz de permisos

- **GIVEN** una cuenta con rol `admin` y ninguna fila en la matriz de permisos
- **WHEN** la cuenta abre la pantalla de pacientes
- **THEN** todas las acciones de escritura se pueden activar, replicando el short-circuit de `modulos.tiene_permiso()` del servidor

#### Scenario: Permiso sobre otro módulo no habilita este

- **GIVEN** una cuenta con permiso `write` sobre `obra_social` y solo `read` sobre `pacientes`
- **WHEN** la cuenta abre la pantalla de pacientes
- **THEN** queda en modo solo lectura, porque el gateo se resuelve contra el módulo de la ruta y no contra cualquier permiso de escritura de la cuenta

## MODIFIED Requirements

### Requirement: El control de permisos del cliente no sustituye a la RLS
El sistema SHALL tratar la comprobación de permisos del cliente como una mejora de experiencia de uso, no como frontera de seguridad. La documentación del código MUST dejar constancia de que la autorización efectiva la impone la Row Level Security del servidor a través de `modulos.tiene_permiso()`.

Esto MUST aplicar por igual al gateo de **lectura** (qué módulos se muestran en la navegación y a qué rutas se puede entrar) y al gateo de **escritura** (qué acciones y campos quedan activables dentro de una pantalla): la autorización efectiva de escritura la impone la RLS mediante `modulos.tiene_permiso(modulo, 'write')`.

La jerarquía de niveles usada por el cliente para cualquiera de los dos gateos MUST ser exactamente la misma función pura `tienePermiso` ya especificada por esta capability, sin reimplementarla ni derivar una variante propia, de modo que no pueda divergir de la semántica del servidor.

#### Scenario: Acceso forzado a datos sin permiso
- **WHEN** una petición alcanza una tabla de dominio sobre la que la cuenta no tiene permiso, sorteando el control del cliente
- **THEN** la RLS del servidor no devuelve filas, independientemente de lo que haya decidido el frontend

#### Scenario: Escritura forzada sorteando el gateo del cliente

- **WHEN** una escritura alcanza una tabla de dominio sobre la que la cuenta no tiene nivel `write`, sorteando el gateo de la interfaz
- **THEN** la RLS del servidor rechaza la operación, independientemente de lo que haya decidido el frontend

#### Scenario: Una sola implementación de la jerarquía de niveles

- **WHEN** se audita cómo la interfaz decide si una acción de escritura está permitida
- **THEN** la decisión proviene de la misma función `tienePermiso` que ya usan el guard de ruta y el filtrado de navegación, sin una segunda implementación de la jerarquía `read < write < admin`
