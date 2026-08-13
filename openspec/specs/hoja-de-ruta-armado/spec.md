# Hoja de Ruta Armado

## Purpose
Define los requisitos del armado de la hoja de ruta diaria: selección de fecha, agrupación de pasajeros por vehículo/conductor respetando disponibilidad (RN-VE-02) y capacidad, y estados de carga/vacío/error contra `HojaDeRutaRepository`.
## Requirements
### Requirement: Armado de la hoja de ruta del día agrupando por vehículo/conductor
El sistema SHALL proveer una pantalla que arme la hoja de ruta de un día (selector de fecha, franja horaria aprox. 8:00-20:00) agrupando pasajeros por vehículo/conductor según capacidad, combinando traslados (US-700, RF-700 a RF-708, `07_flujos_principales.md §Flujo 2`), con estados de carga, vacío y error contra `HojaDeRutaRepository`.

La carga del día MUST resolverse consultando **esa fecha** vía `HojaDeRutaRepository.getByFecha(fecha)`. La pantalla NEVER debe traer todas las hojas de ruta con sus recorridos y paradas para después quedarse con una por filtrado en memoria: el agregado incluye un embed de tres niveles (hoja → recorridos → paradas) y su costo crece con cada día operado, mientras que la pantalla muestra un único día. Este requisito ya estaba enunciado y la implementación no lo cumplía; pasa a ser verificable con un test que cuente qué consulta se emite.

El comportamiento de recarga silenciosa posterior a cada mutación MUST preservarse: el refetch que sigue a crear o actualizar un recorrido NEVER debe volver a activar el estado de carga de pantalla completa, porque eso desmonta los recorridos en edición y saca a la operadora del modo edición (regresión ya corregida una vez, 2026-08-11). La carga inicial y la recarga explícita sí muestran el indicador de carga.

#### Scenario: Selección del día
- **WHEN** la operadora elige una fecha
- **THEN** la pantalla carga (o crea) la hoja de ruta de ese día vía `getByFecha`/`create` y muestra sus recorridos agrupados por vehículo/conductor

#### Scenario: Una sola consulta acotada a la fecha
- **WHEN** la pantalla resuelve el día seleccionado
- **THEN** se consulta únicamente la hoja de ruta de esa fecha, y el volumen de datos leído no depende de cuántos días haya operado la empresa históricamente

#### Scenario: Día sin hoja de ruta cargada
- **WHEN** la fecha elegida no tiene hoja de ruta
- **THEN** `getByFecha` resuelve `null` sin lanzar excepción y la pantalla muestra el estado vacío del día

#### Scenario: Cambio de fecha
- **WHEN** la operadora cambia la fecha seleccionada
- **THEN** se consulta la hoja de ruta de la nueva fecha y se descarta la anterior, sin acumular en memoria las hojas de ruta ya visitadas

#### Scenario: Estado vacío del día
- **WHEN** un día no tiene recorridos cargados todavía
- **THEN** la pantalla muestra un estado vacío explícito (no una pantalla en blanco) invitando a agregar el primer recorrido

#### Scenario: Estado de carga y de error
- **WHEN** el repository está resolviendo o falla
- **THEN** la pantalla muestra un indicador de carga o un mensaje de error visible, sin quedar en loading infinito

#### Scenario: La mutación no saca a la operadora del modo edición
- **WHEN** la operadora sugiere orden, sube/baja o quita una parada mientras un recorrido está en modo edición
- **THEN** el cambio se persiste y la vista se refresca sin pasar por el estado de carga de pantalla completa, conservando el recorrido en edición
</content>

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

