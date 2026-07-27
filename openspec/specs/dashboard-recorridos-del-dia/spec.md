## ADDED Requirements

### Requirement: Hoja de ruta del día en primer plano
El sistema SHALL mostrar en la parte superior del dashboard la hoja de ruta correspondiente a la fecha de referencia, obtenida con `HojaDeRutaRepository.getByFecha(fecha)` (US-800, RF-800). El panel MUST ser de solo lectura: no permite crear, editar ni reordenar recorridos ni paradas.

#### Scenario: Recorridos del día visibles al abrir el sistema
- **WHEN** la usuaria autenticada abre la ruta raíz y existe una hoja de ruta cargada para hoy
- **THEN** el panel de recorridos del día se muestra por encima de las tarjetas de resumen y de los reportes

#### Scenario: Panel de solo lectura
- **WHEN** se renderiza el panel de recorridos del día
- **THEN** no ofrece ninguna acción de creación, edición, borrado ni reordenamiento, y no invoca ningún método de escritura de ningún repositorio

### Requirement: Resumen agregado del día
El sistema SHALL calcular con la función pura `resumenDelDia(hojaDeRuta)` la cantidad de recorridos, la cantidad total de paradas y la cantidad de pacientes distintos de la jornada.

#### Scenario: Conteos de la jornada
- **WHEN** la hoja de ruta del día tiene tres recorridos con paradas cargadas
- **THEN** el panel informa la cantidad de recorridos, el total de paradas sumando todos los recorridos, y la cantidad de pacientes distintos

#### Scenario: Pacientes contados una sola vez
- **WHEN** un mismo paciente aparece en la parada de ida y en la de vuelta del mismo recorrido, o en dos recorridos distintos
- **THEN** se cuenta una sola vez en la cantidad de pacientes distintos, aunque sus paradas se cuenten todas

#### Scenario: Hoja de ruta sin recorridos
- **WHEN** existe una hoja de ruta para hoy pero sin ningún recorrido cargado
- **THEN** el resumen informa cero en los tres conteos, sin lanzar error

### Requirement: Detalle por recorrido con vehículo y conductor
El sistema SHALL listar cada recorrido de la jornada identificando su vehículo y su conductor, y la cantidad de paradas del recorrido.

#### Scenario: Identificación legible del recorrido
- **WHEN** se lista un recorrido
- **THEN** se muestra la patente o identificación del vehículo y el nombre del conductor, resueltos desde los repositorios de vehículos y conductores por su id, no el id crudo

#### Scenario: Referencia inexistente
- **WHEN** un recorrido referencia un vehículo o un conductor que no se pudo resolver
- **THEN** el recorrido se muestra igual con un texto indicando que la referencia no está disponible, sin romper el panel ni omitir el recorrido

#### Scenario: Recorrido manual señalizado
- **WHEN** un recorrido está marcado como manual
- **THEN** se identifica como tal en la lista, para distinguirlo de los recorridos con frecuencia habitual

### Requirement: Enlace al módulo de hojas de ruta
El sistema SHALL ofrecer desde el panel un enlace a la pantalla de hojas de ruta, para operar el detalle completo de la jornada.

#### Scenario: Navegación al detalle
- **WHEN** la usuaria activa el enlace del panel
- **THEN** navega a la pantalla de hojas de ruta mediante el router, sin recargar la página

### Requirement: Estados del panel del día
El sistema SHALL manejar de forma explícita los estados de carga, error y ausencia de hoja de ruta para el día.

#### Scenario: Sin hoja de ruta cargada para hoy
- **WHEN** `getByFecha` resuelve `null` para la fecha de referencia
- **THEN** el panel muestra un estado vacío indicando que no hay hoja de ruta cargada para hoy, con el enlace para ir a armarla, en vez de un área en blanco o un error

#### Scenario: Error de lectura acotado al panel
- **WHEN** falla la lectura de la hoja de ruta del día
- **THEN** el panel muestra su propio mensaje de error y el resto del dashboard (tarjetas y reportes) sigue funcionando
