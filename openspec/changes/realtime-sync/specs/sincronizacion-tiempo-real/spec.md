## Purpose

Que los cambios hechos por otra sesión (otra computadora, otra pestaña, misma o distinta cuenta) sobre datos operativos compartidos se reflejen en las pantallas abiertas sin recargar, sin que nadie vea datos que su permiso por módulo no le habilita.

## ADDED Requirements

### Requirement: Cambios remotos se reflejan sin recargar

Mientras haya una sesión autenticada, el sistema SHALL actualizar las pantallas abiertas cuando otra sesión cree, modifique o elimine registros de los dominios operativos compartidos: hojas de ruta (incluidos recorridos y paradas), recorridos habituales, pacientes (incluida toda su ficha: direcciones, CUD, datos clínicos, personas a cargo, prestaciones, accesorios, coberturas), vehículos (incluidos mantenimiento, habilitaciones y accesorios), conductores (incluida su asignación a vehículos), presupuestos y autorizaciones. La actualización MUST ocurrir sin F5 y sin que la pestaña pierda y recupere el foco.

#### Scenario: La hoja de ruta del día se actualiza en la otra computadora

- **GIVEN** las sesiones A y B tienen abierta la hoja de ruta del mismo día
- **WHEN** A agrega una parada a un recorrido y guarda
- **THEN** B ve la parada nueva en pocos segundos, sin recargar ni cambiar de ventana

#### Scenario: Un cambio solo en una sub-tabla de la ficha también se propaga

- **GIVEN** B tiene abierto el listado o la ficha de un paciente
- **WHEN** A modifica únicamente la dirección (o el CUD) de ese paciente
- **THEN** B ve el dato actualizado

#### Scenario: Un alta en otro dominio compartido se ve en un selector abierto

- **GIVEN** B tiene abierta una pantalla con el selector de vehículos
- **WHEN** A da de alta un vehículo
- **THEN** el vehículo aparece en el selector de B

#### Scenario: Una baja se refleja

- **WHEN** A elimina un recorrido de la hoja de ruta que B está mirando
- **THEN** el recorrido desaparece de la pantalla de B

### Requirement: Lo que se muestra sale siempre de la lectura normal, nunca del aviso de cambio

El aviso de cambio recibido en tiempo real MUST usarse solo para saber QUÉ dominio cambió. El sistema MUST NOT mostrar, guardar en caché ni procesar el contenido del registro que viaja en el aviso; los datos en pantalla SHALL provenir exclusivamente de la misma lectura al servidor que ya usa cada pantalla, sujeta a los permisos por módulo de la sesión que mira. El sistema MUST usar únicamente la clave pública (anon) con la sesión de la usuaria; MUST NOT usar credenciales que salteen RLS.

#### Scenario: El aviso dispara una relectura, no un pintado directo

- **WHEN** llega un aviso de cambio de un paciente
- **THEN** la pantalla vuelve a pedir los pacientes al servidor y muestra lo que esa lectura devuelve, aunque el aviso traiga campos distintos

### Requirement: Respeto de permisos por módulo

Una sesión SHALL recibir avisos de alta y modificación solo de registros que su permiso de lectura del módulo correspondiente le permite ver. Los avisos de eliminación, que solo identifican el registro eliminado, MAY llegar a sesiones sin permiso de lectura; en ese caso MUST NOT producir ningún dato visible ni error.

#### Scenario: Usuario sin permiso del módulo no ve cambios de ese módulo

- **GIVEN** la sesión B no tiene permiso de lectura del módulo Presupuestos
- **WHEN** A crea un presupuesto
- **THEN** B no recibe datos de ese presupuesto y su pantalla no cambia

#### Scenario: Una eliminación ajena no filtra datos

- **GIVEN** la sesión B no tiene permiso de lectura del módulo Pacientes
- **WHEN** A elimina un registro de la ficha de un paciente
- **THEN** B no muestra ningún dato de pacientes ni ningún error

### Requirement: Ráfagas de cambios se agrupan

Cuando una sola operación (o varias seguidas en un intervalo corto) produce múltiples avisos sobre el mismo dominio, el sistema SHALL agruparlos y releer cada dominio afectado una sola vez por intervalo.

#### Scenario: Guardar una ficha completa provoca una sola relectura

- **WHEN** A guarda una ficha de paciente que modifica paciente, direcciones, CUD y prestaciones en el mismo guardado
- **THEN** B relee los pacientes una sola vez, no una vez por tabla

#### Scenario: Cambios en dominios distintos releen cada dominio

- **WHEN** en el mismo intervalo A modifica un vehículo y un conductor
- **THEN** B relee vehículos y conductores, una vez cada uno

### Requirement: Recuperación tras un corte de conexión

Si la conexión de tiempo real se interrumpe y se restablece, el sistema SHALL releer todos los datos activos, porque los cambios ocurridos durante el corte no se reciben. El refresco al volver el foco a la pestaña SHALL mantenerse como respaldo.

#### Scenario: Corte de red y vuelta

- **GIVEN** B pierde la conexión de red durante un minuto, en el que A modifica una hoja de ruta
- **WHEN** la conexión de tiempo real de B se restablece
- **THEN** B relee los datos de las pantallas abiertas y ve el cambio de A

#### Scenario: La conexión inicial no provoca relecturas extra

- **WHEN** B inicia sesión y la conexión de tiempo real se establece por primera vez
- **THEN** no se dispara una relectura adicional a la carga normal de la pantalla

### Requirement: La escucha vive solo mientras hay sesión

El sistema SHALL escuchar cambios únicamente mientras haya una sesión autenticada. Al cerrar sesión MUST dejar de escuchar y descartar cualquier relectura pendiente; al cambiar de usuario MUST volver a escuchar con la identidad nueva.

#### Scenario: Logout corta la escucha

- **WHEN** B cierra sesión
- **THEN** la escucha se cierra y ningún aviso posterior provoca relecturas

#### Scenario: Pantalla de login no escucha

- **GIVEN** no hay sesión iniciada
- **WHEN** se muestra la pantalla de login (o la sesión todavía se está restaurando)
- **THEN** no se abre ninguna escucha de cambios

#### Scenario: Cambio de usuario re-suscribe

- **WHEN** en la misma pestaña se cierra la sesión de un usuario y se inicia la de otro
- **THEN** la escucha anterior se cierra y se abre una nueva con los permisos del usuario nuevo

### Requirement: Las escrituras propias no rompen nada

Una sesión que realiza un cambio MAY recibir el aviso de su propio cambio; en ese caso la relectura adicional SHALL ser inocua (sin parpadeo de estado de carga ni pérdida de lo que se está editando en otro formulario).

#### Scenario: Aviso del propio guardado

- **WHEN** A guarda un vehículo y luego recibe el aviso de ese mismo cambio
- **THEN** A ve el dato guardado, sin estado de carga ni error

### Requirement: Fuera de alcance explícito

La sincronización MUST NOT intentar resolver ediciones concurrentes del mismo registro: si dos sesiones guardan el mismo registro, prevalece la última escritura (comportamiento previo). Esta capacidad no incluye seguimiento de ubicación de vehículos (GPS).

#### Scenario: Dos personas guardan la misma ficha

- **WHEN** A y B editan la misma ficha y guardan uno después del otro
- **THEN** queda lo guardado último y ambas sesiones terminan mostrando ese valor
