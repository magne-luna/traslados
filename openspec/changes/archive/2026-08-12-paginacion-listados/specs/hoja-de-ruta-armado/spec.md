## MODIFIED Requirements

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
