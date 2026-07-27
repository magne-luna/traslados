## ADDED Requirements

### Requirement: Edición manual de recorridos con reacomodo del resto
El sistema SHALL permitir editar recorridos individuales de la hoja de ruta: agregar o quitar un pasajero y reacomodar los demás, sin perder los recorridos ya cargados (US-700, RF-702).

#### Scenario: Quitar un pasajero reacomoda el resto
- **WHEN** la operadora quita una parada de un recorrido
- **THEN** la parada se elimina, el `orden` de las paradas restantes se reacomoda de forma consistente y el resto de los recorridos del día permanece intacto

#### Scenario: Agregar un pasajero a un recorrido existente
- **WHEN** la operadora agrega un paciente compatible a un recorrido con capacidad disponible
- **THEN** se crea una nueva `ParadaRecorrido` con `id` estable y se persiste como parte del agregado de la hoja de ruta

#### Scenario: La edición no pierde recorridos ya cargados
- **WHEN** se edita un recorrido del día
- **THEN** los demás recorridos de la misma hoja de ruta se conservan sin cambios tras persistir

### Requirement: Notas al pie de la hoja de ruta
El sistema SHALL permitir agregar notas al pie con aclaraciones o detalles (ej. combinaciones entre pasajeros), a nivel de la hoja de ruta y/o de un recorrido (RF-703).

#### Scenario: Nota al pie persistida
- **WHEN** la operadora escribe una nota al pie
- **THEN** la nota se guarda en `HojaDeRuta.notas` (o `Recorrido.notas`) y se muestra en la vista y en la exportación

### Requirement: Recorridos manuales sin turno fijo (RN-HR-03)
El sistema SHALL admitir el armado de recorridos manuales sin frecuencia fija ni turno asignado (ej. traslados puntuales a hospitales), sin generarse automáticamente desde una agenda (RN-HR-03).

#### Scenario: Alta de recorrido manual
- **WHEN** la operadora crea un recorrido marcándolo como manual
- **THEN** el `Recorrido` se guarda con `manual === true` sin depender de ninguna frecuencia/turno preexistente (RN-HR-03)

### Requirement: Direcciones de ida y vuelta independientes por tramo (RN-HR-02)
El sistema SHALL contemplar la dirección de ida y la de vuelta como datos independientes por tramo, verificables en cada traslado, sin asumir que la vuelta es el trayecto inverso de la ida (RN-HR-02).

#### Scenario: Ida y vuelta como paradas independientes
- **WHEN** un paciente tiene tramo de ida y de vuelta en el día
- **THEN** cada tramo es una `ParadaRecorrido` con su propio `tramo`, `direccionOrigenId` y `direccionDestinoId`, y la UI nunca deriva la vuelta invirtiendo la ida (RN-HR-02)

### Requirement: Vista global del día para reasignar ante imprevistos
El sistema SHALL ofrecer una vista global de todos los recorridos del día para detectar conflictos (vehículo/conductor que cae fuera de servicio) y reasignar pasajeros (US-700, RF-705).

#### Scenario: Reasignación ante vehículo/conductor fuera de servicio
- **WHEN** en la vista global un recorrido quedó con un vehículo o conductor fuera de servicio
- **THEN** la vista lo señala y permite reasignar sus pasajeros a otro recorrido con vehículo habilitado y conductor operando, respetando capacidad (RN-VE-02) y compatibilidad de accesorios (RN-VE-01)
