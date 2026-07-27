## ADDED Requirements

### Requirement: Listado de vehículos
El sistema SHALL mostrar un listado de los vehículos existentes obtenido a través de `VehiculoRepository.list()`, con estados de carga, vacío y error visibles (US-500, RF-500). Cada fila MUST mostrar al menos patente, modelo, capacidad y estado (habilitado / fuera de servicio).

#### Scenario: Carga inicial del listado
- **WHEN** el usuario abre la pantalla de vehículos
- **THEN** se muestra un indicador de carga mientras `list()` está pendiente y luego la lista de vehículos

#### Scenario: Listado vacío
- **WHEN** no hay vehículos cargados
- **THEN** se muestra un estado vacío con la acción de crear el primer vehículo

#### Scenario: Distinción visual del estado fuera de servicio
- **WHEN** un vehículo está marcado como fuera de servicio
- **THEN** la fila lo indica con texto e ícono además de color (no solo color), para no depender del color como único canal

### Requirement: Alta y edición de vehículo
El sistema SHALL permitir crear y editar un vehículo capturando patente, modelo, tipo, capacidad (hasta 6), accesorios de movilidad compatibles, estado y kilometraje, usando `VehiculoRepository.create()` / `update()` (US-500, RF-500 a RF-504).

#### Scenario: Alta exitosa
- **WHEN** el usuario completa los campos requeridos y confirma
- **THEN** el vehículo se persiste vía `create()` y aparece en el listado

#### Scenario: Validación de campos requeridos
- **WHEN** el usuario intenta guardar sin patente o con capacidad fuera del rango permitido (1 a 6)
- **THEN** el formulario bloquea el guardado y señala los campos inválidos

#### Scenario: Manejo de error del repository
- **WHEN** una operación de create/update falla en el repository
- **THEN** la UI muestra un mensaje de error y no deja la pantalla en un estado de carga infinito

### Requirement: Selector de accesorios de movilidad compatibles
El sistema SHALL ofrecer un selector de accesorios de movilidad compatibles del vehículo, restringido al conjunto cerrado de `AccesorioMovilidad`, permitiendo seleccionar cero o más (RN-VE-01, RF-501).

#### Scenario: Selección múltiple de accesorios
- **WHEN** el usuario marca uno o más accesorios compatibles y guarda
- **THEN** el vehículo persiste exactamente esos accesorios en `accesoriosCompatibles`

### Requirement: Toggle habilitado / fuera de servicio
El sistema SHALL permitir alternar el estado del vehículo entre habilitado y fuera de servicio, persistiendo el cambio vía `update()` (RN-VE-02, RF-503).

#### Scenario: Marcar fuera de servicio
- **WHEN** el usuario marca un vehículo como fuera de servicio y confirma
- **THEN** el estado se persiste y el vehículo queda señalado como no disponible para hojas de ruta (la exclusión efectiva la aplica FE-5)

### Requirement: Actualización manual de kilometraje
El sistema SHALL permitir actualizar manualmente el kilometraje del vehículo (US-500, RF-505), persistiendo el nuevo valor vía `update()`.

#### Scenario: Actualización de kilometraje
- **WHEN** el usuario ingresa un kilometraje nuevo mayor o igual al registrado y confirma
- **THEN** el kilometraje se persiste y las alertas de mantenimiento se recalculan sobre el nuevo valor
