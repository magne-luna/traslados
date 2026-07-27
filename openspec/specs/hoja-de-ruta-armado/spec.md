## ADDED Requirements

### Requirement: Armado de la hoja de ruta del día agrupando por vehículo/conductor
El sistema SHALL proveer una pantalla que arme la hoja de ruta de un día (selector de fecha, franja horaria aprox. 8:00-20:00) agrupando pasajeros por vehículo/conductor según capacidad, combinando traslados (US-700, RF-700 a RF-708, `07_flujos_principales.md §Flujo 2`), con estados de carga, vacío y error contra `HojaDeRutaRepository`.

#### Scenario: Selección del día
- **WHEN** la operadora elige una fecha
- **THEN** la pantalla carga (o crea) la hoja de ruta de ese día vía `getByFecha`/`create` y muestra sus recorridos agrupados por vehículo/conductor

#### Scenario: Estado vacío del día
- **WHEN** un día no tiene recorridos cargados todavía
- **THEN** la pantalla muestra un estado vacío explícito (no una pantalla en blanco) invitando a agregar el primer recorrido

#### Scenario: Estado de carga y de error
- **WHEN** el repository está resolviendo o falla
- **THEN** la pantalla muestra un indicador de carga o un mensaje de error visible, sin quedar en loading infinito

### Requirement: Solo vehículos habilitados y conductores operando disponibles (RN-VE-02)
El sistema SHALL ofrecer para asignar únicamente vehículos con estado `habilitado` y conductores con estado `operando`, excluyendo los que están `fuera-de-servicio`, mediante funciones puras `vehiculosDisponibles` y `conductoresDisponibles` (RN-VE-02).

#### Scenario: Vehículo fuera de servicio excluido
- **WHEN** un vehículo tiene `estado === 'fuera-de-servicio'`
- **THEN** `vehiculosDisponibles` lo excluye y no aparece en el selector de vehículos de la hoja de ruta (RN-VE-02)

#### Scenario: Conductor fuera de servicio excluido
- **WHEN** un conductor tiene `estado === 'fuera-de-servicio'`
- **THEN** `conductoresDisponibles` lo excluye y no aparece en el selector de conductores

#### Scenario: Funciones de disponibilidad puras y testeables
- **WHEN** se invocan `vehiculosDisponibles`/`conductoresDisponibles` con una lista dada
- **THEN** el resultado depende solo de los argumentos (sin red ni `localStorage`), permitiendo tests deterministas de RN-VE-02

### Requirement: Respeto de la capacidad del vehículo al agrupar
El sistema SHALL impedir asignar a un recorrido más pasajeros que la `capacidad` del vehículo, mediante una función pura `capacidadDisponible(vehiculo, recorrido)`, alertando en UI cuando se intenta superar el cupo.

#### Scenario: Vehículo lleno
- **WHEN** un recorrido ya tiene tantos pasajeros como la `capacidad` del vehículo y se intenta agregar otro
- **THEN** `capacidadDisponible` devuelve que no hay lugar y la UI bloquea/alerta la asignación con un mensaje visible

#### Scenario: Lugar disponible
- **WHEN** la cantidad de pasajeros de un recorrido es menor que la `capacidad` del vehículo
- **THEN** `capacidadDisponible` devuelve que hay lugar y la asignación procede
